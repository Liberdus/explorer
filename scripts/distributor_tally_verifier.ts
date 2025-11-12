import axios from 'axios'
import * as crypto from '@shardus/crypto-utils'
import { config, DISTRIBUTOR_URL } from '../src/config'
import { queryFromDistributor, DataType } from '../src/class/DataSync'
crypto.init(config.hashKey)

const startCycle = 0
const endCycle = 0

// Choose data type to verify
const data_type: DataType = DataType.RECEIPT // DataType.RECEIPT or DataType.ORIGINALTX

// Choose comparison mode:
// 'tally' - Compare tally endpoint vs cycle-based pagination
// 'full' - Compare full data endpoint vs cycle-based pagination
const comparisonMode: 'tally' | 'full' = 'tally'

interface TallyItem {
  cycle: number
  receipts?: number
  originalTxsData?: number
  originalTxs?: number
}

interface MismatchResult {
  cycle: number
  tallyCount: number
  actualCount: number
}

interface TransactionIdDetails {
  cycle: number
  fullDataIds: string[]
  cycleBasedIds: string[]
}

/**
 * Fetch tally counts from distributor (aggregated counts per cycle)
 */
const fetchTallyCounts = async (
  cycleStart: number,
  cycleEnd: number
): Promise<Map<number, number>> => {
  const tallyMap = new Map<number, number>()

  const response = await queryFromDistributor(data_type, {
    startCycle: cycleStart,
    endCycle: cycleEnd,
    type: 'tally',
  })

  if (!response?.data) {
    console.warn(`No tally data returned for cycles ${cycleStart}-${cycleEnd}`)
    return tallyMap
  }

  const tallyData: TallyItem[] =
    data_type === DataType.RECEIPT ? response.data.receipts || [] : response.data.originalTxs || []

  for (const item of tallyData) {
    const count =
      data_type === DataType.RECEIPT
        ? item.receipts ?? 0
        : item.originalTxsData ?? item.originalTxs ?? 0
    tallyMap.set(item.cycle, count)
  }

  return tallyMap
}

/**
 * Fetch full data from distributor without tally (fetches actual records and counts them)
 * Uses pagination to fetch all data across multiple pages
 */
const fetchFullDataCounts = async (
  cycleStart: number,
  cycleEnd: number
): Promise<{ counts: Map<number, number>; ids: Map<number, string[]> }> => {
  const countsMap = new Map<number, number>()
  const idsMap = new Map<number, string[]>()

  let page = 1
  let hasMorePages = true
  const maxLimit = config.requestLimits.MAX_RECEIPTS_PER_REQUEST

  while (hasMorePages) {
    const response = await queryFromDistributor(data_type, {
      startCycle: cycleStart,
      endCycle: cycleEnd,
      page: page,
      // No 'type: tally' - fetch actual data
    })

    if (!response?.data) {
      console.warn(`No data returned for cycles ${cycleStart}-${cycleEnd} page ${page}`)
      break
    }

    const items =
      data_type === DataType.RECEIPT ? response.data.receipts || [] : response.data.originalTxs || []

    if (items.length === 0) {
      break // No more data
    }

    // Count items per cycle and collect IDs
    for (const item of items) {
      const cycle = item.cycle
      const txId = data_type === DataType.RECEIPT ? item.receiptId : item.txId

      countsMap.set(cycle, (countsMap.get(cycle) || 0) + 1)

      if (!idsMap.has(cycle)) {
        idsMap.set(cycle, [])
      }
      idsMap.get(cycle)!.push(txId)
    }

    console.log(
      `Fetched page ${page} for cycles ${cycleStart}-${cycleEnd}: ${items.length} items, total cycles tracked: ${countsMap.size}`
    )

    // Check if we need to fetch more pages
    if (items.length < maxLimit) {
      hasMorePages = false
    } else {
      page++
    }
  }

  return { counts: countsMap, ids: idsMap }
}

/**
 * Fetch actual data from distributor using cycle-based pagination
 * (Same method used in ParallelDataSync)
 */
const fetchActualDataCounts = async (
  cycleStart: number,
  cycleEnd: number
): Promise<{ counts: Map<number, number>; ids: Map<number, string[]> }> => {
  const actualCountsMap = new Map<number, number>()
  const actualIdsMap = new Map<number, string[]>()

  let currentCycle = cycleStart
  let afterTimestamp = 0
  let afterTxId = ''
  const limit = config.requestLimits.MAX_RECEIPTS_PER_REQUEST

  const url =
    data_type === DataType.RECEIPT
      ? `${DISTRIBUTOR_URL}/receipt/cycle`
      : `${DISTRIBUTOR_URL}/originalTx/cycle`

  while (currentCycle <= cycleEnd) {
    const requestData = {
      startCycle: currentCycle,
      endCycle: cycleEnd,
      afterTimestamp,
      afterTxId,
      limit,
      sender: config.collectorInfo.publicKey,
      sign: undefined,
    }

    crypto.signObj(requestData, config.collectorInfo.secretKey, config.collectorInfo.publicKey)

    const response = await axios.post(url, requestData)

    const items =
      data_type === DataType.RECEIPT
        ? response.data?.receipts || []
        : response.data?.originalTxs || []

    if (items.length === 0) {
      break // No more data
    }

    // Count items per cycle and collect IDs
    for (const item of items) {
      const cycle = item.cycle
      const txId = data_type === DataType.RECEIPT ? item.receiptId : item.txId

      actualCountsMap.set(cycle, (actualCountsMap.get(cycle) || 0) + 1)

      if (!actualIdsMap.has(cycle)) {
        actualIdsMap.set(cycle, [])
      }
      actualIdsMap.get(cycle)!.push(txId)
    }

    // Update pagination cursors
    const lastItem = items[items.length - 1]
    currentCycle = lastItem.cycle
    afterTimestamp = lastItem.timestamp
    afterTxId = data_type === DataType.RECEIPT ? lastItem.receiptId : lastItem.txId

    console.log(
      `Fetched ${items.length} items, last in cycle ${currentCycle}, total cycles tracked: ${actualCountsMap.size}`
    )

    // If we got less than limit, we've exhausted the range
    if (items.length < limit) {
      break
    }
  }

  return { counts: actualCountsMap, ids: actualIdsMap }
}

const chunkArray = <T>(array: T[], chunkSize: number): T[][] => {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize))
  }
  return chunks
}

const runProgram = async (): Promise<void> => {
  const limit = 100
  const concurrency = 10

  const batches: Array<{ start: number; end: number }> = []

  // Create batches without overlapping boundaries
  let currentStart = startCycle
  while (currentStart <= endCycle) {
    const batchEnd = Math.min(currentStart + limit - 1, endCycle)
    batches.push({ start: currentStart, end: batchEnd })
    currentStart = batchEnd + 1
  }

  const dataTypeName = data_type === DataType.RECEIPT ? 'Receipts' : 'OriginalTxs'
  const modeName =
    comparisonMode === 'tally'
      ? 'Tally vs Cycle-Based Pagination'
      : 'Full Data vs Cycle-Based Pagination'

  console.log(`\n${'='.repeat(70)}`)
  console.log(`Distributor Verifier - ${dataTypeName}`)
  console.log(`${'='.repeat(70)}`)
  console.log(`Comparison Mode: ${modeName}`)
  console.log(`Cycle Range: ${startCycle} to ${endCycle}`)
  console.log(`Batches: ${batches.length}`)
  console.log(`Concurrency: ${concurrency}`)
  console.log(`${'='.repeat(70)}\n`)

  const batchChunks = chunkArray(batches, concurrency)

  // Step 1: Fetch first dataset (tally or full data)
  const firstDataLabel = comparisonMode === 'tally' ? 'tally' : 'full data'
  console.log(`Fetching ${firstDataLabel} counts from distributor...`)

  const firstDataCountsMap = new Map<number, number>()
  const firstDataIdsMap = new Map<number, string[]>()

  if (comparisonMode === 'tally') {
    // Tally mode: only fetch counts (no IDs available)
    const tallyMaps: Map<number, number>[] = []
    for (const chunk of batchChunks) {
      const chunkResults = await Promise.all(
        chunk.map((batch) => {
          console.log(`Fetching ${firstDataLabel} for cycles ${batch.start} to ${batch.end}`)
          return fetchTallyCounts(batch.start, batch.end)
        })
      )
      tallyMaps.push(...chunkResults)
    }
    // Merge tally counts
    for (const map of tallyMaps) {
      for (const [cycle, count] of map.entries()) {
        firstDataCountsMap.set(cycle, (firstDataCountsMap.get(cycle) || 0) + count)
      }
    }
  } else {
    // Full data mode: fetch counts and IDs
    const fullDataResults: Array<{ counts: Map<number, number>; ids: Map<number, string[]> }> = []
    for (const chunk of batchChunks) {
      const chunkResults = await Promise.all(
        chunk.map((batch) => {
          console.log(`Fetching ${firstDataLabel} for cycles ${batch.start} to ${batch.end}`)
          return fetchFullDataCounts(batch.start, batch.end)
        })
      )
      fullDataResults.push(...chunkResults)
    }
    // Merge full data counts and IDs
    for (const result of fullDataResults) {
      for (const [cycle, count] of result.counts.entries()) {
        firstDataCountsMap.set(cycle, (firstDataCountsMap.get(cycle) || 0) + count)
      }
      for (const [cycle, ids] of result.ids.entries()) {
        if (!firstDataIdsMap.has(cycle)) {
          firstDataIdsMap.set(cycle, [])
        }
        firstDataIdsMap.get(cycle)!.push(...ids)
      }
    }
  }

  console.log(`\n${firstDataLabel} counts fetched: ${firstDataCountsMap.size} cycles\n`)

  // Step 2: Fetch cycle-based pagination data (always with IDs)
  console.log('Fetching data using cycle-based pagination...')
  const cycleBasedResults: Array<{ counts: Map<number, number>; ids: Map<number, string[]> }> = []

  for (const chunk of batchChunks) {
    const chunkResults = await Promise.all(
      chunk.map((batch) => {
        console.log(`Fetching cycle-based data for cycles ${batch.start} to ${batch.end}`)
        return fetchActualDataCounts(batch.start, batch.end)
      })
    )
    cycleBasedResults.push(...chunkResults)
  }

  // Merge cycle-based counts and IDs
  const cycleBasedCountsMap = new Map<number, number>()
  const cycleBasedIdsMap = new Map<number, string[]>()

  for (const result of cycleBasedResults) {
    for (const [cycle, count] of result.counts.entries()) {
      cycleBasedCountsMap.set(cycle, (cycleBasedCountsMap.get(cycle) || 0) + count)
    }
    for (const [cycle, ids] of result.ids.entries()) {
      if (!cycleBasedIdsMap.has(cycle)) {
        cycleBasedIdsMap.set(cycle, [])
      }
      cycleBasedIdsMap.get(cycle)!.push(...ids)
    }
  }

  console.log(`\nCycle-based pagination counts fetched: ${cycleBasedCountsMap.size} cycles\n`)

  // Compare first dataset vs cycle-based counts
  const mismatches: MismatchResult[] = []
  const allCycles = new Set([...firstDataCountsMap.keys(), ...cycleBasedCountsMap.keys()])

  for (const cycle of allCycles) {
    const firstDataCount = firstDataCountsMap.get(cycle) || 0
    const cycleBasedCount = cycleBasedCountsMap.get(cycle) || 0

    if (firstDataCount !== cycleBasedCount) {
      mismatches.push({
        cycle,
        tallyCount: firstDataCount,
        actualCount: cycleBasedCount,
      })
    }
  }

  // Sort mismatches by cycle
  mismatches.sort((a, b) => a.cycle - b.cycle)

  // Print results
  const firstColumnLabel = comparisonMode === 'tally' ? 'Tally Count' : 'Full Data Count'
  const secondColumnLabel = 'Cycle-Based Count'

  console.log(`\n${'='.repeat(70)}`)
  console.log(`Verification Results - ${dataTypeName}`)
  console.log(`${'='.repeat(70)}`)
  console.log(`Comparison Mode: ${modeName}`)
  console.log(`Total cycles checked: ${allCycles.size}`)
  console.log(`Cycles with ${firstDataLabel} data: ${firstDataCountsMap.size}`)
  console.log(`Cycles with cycle-based data: ${cycleBasedCountsMap.size}`)
  console.log(`Mismatches found: ${mismatches.length}`)
  console.log(`${'='.repeat(70)}\n`)

  if (mismatches.length > 0) {
    console.log(`\n${'='.repeat(70)}`)
    console.log(`Mismatched Cycles:`)
    console.log(`${'='.repeat(70)}`)
    console.log(
      `${'Cycle'.padEnd(10)} | ${firstColumnLabel.padEnd(18)} | ${secondColumnLabel.padEnd(18)} | ${'Difference'}`
    )
    console.log(`${'-'.repeat(70)}`)

    for (const mismatch of mismatches) {
      const diff = mismatch.actualCount - mismatch.tallyCount
      console.log(
        `${String(mismatch.cycle).padEnd(10)} | ${String(mismatch.tallyCount).padEnd(18)} | ${String(
          mismatch.actualCount
        ).padEnd(18)} | ${diff > 0 ? '+' : ''}${diff}`
      )
    }
    console.log(`${'='.repeat(70)}\n`)
  } else {
    console.log(`✅ All cycles match! ${firstDataLabel} and cycle-based data are consistent.\n`)
  }

  // Calculate total counts
  let totalFirstData = 0
  let totalCycleBased = 0
  for (const count of firstDataCountsMap.values()) {
    totalFirstData += count
  }
  for (const count of cycleBasedCountsMap.values()) {
    totalCycleBased += count
  }

  console.log(`Total ${dataTypeName} from ${firstDataLabel}: ${totalFirstData}`)
  console.log(`Total ${dataTypeName} from cycle-based: ${totalCycleBased}`)
  console.log(`Difference: ${totalCycleBased - totalFirstData}`)

  // Display transaction IDs for mismatched cycles (if available in full mode)
  if (mismatches.length > 0 && firstDataIdsMap.size > 0) {
    console.log(`\n${'='.repeat(70)}`)
    console.log(`Transaction IDs for Mismatched Cycles:`)
    console.log(`${'='.repeat(70)}\n`)

    for (const mismatch of mismatches.slice(0, 10)) {
      // Show first 10 mismatches
      console.log(`Cycle ${mismatch.cycle}:`)

      const fullDataIds = firstDataIdsMap.get(mismatch.cycle) || []
      const cycleBasedIds = cycleBasedIdsMap.get(mismatch.cycle) || []

      console.log(`  Full Data IDs (${fullDataIds.length}):`)
      if (fullDataIds.length > 0) {
        fullDataIds.slice(0, 5).forEach((id) => console.log(`    - ${id}`))
        if (fullDataIds.length > 5) {
          console.log(`    ... and ${fullDataIds.length - 5} more`)
        }
      } else {
        console.log(`    (none)`)
      }

      console.log(`  Cycle-Based IDs (${cycleBasedIds.length}):`)
      if (cycleBasedIds.length > 0) {
        cycleBasedIds.slice(0, 5).forEach((id) => console.log(`    - ${id}`))
        if (cycleBasedIds.length > 5) {
          console.log(`    ... and ${cycleBasedIds.length - 5} more`)
        }
      } else {
        console.log(`    (none)`)
      }

      // Find IDs that are in one set but not the other
      const fullDataSet = new Set(fullDataIds)
      const cycleBasedSet = new Set(cycleBasedIds)

      const onlyInFullData = fullDataIds.filter((id) => !cycleBasedSet.has(id))
      const onlyInCycleBased = cycleBasedIds.filter((id) => !fullDataSet.has(id))

      if (onlyInFullData.length > 0) {
        console.log(`  Only in Full Data (${onlyInFullData.length}):`)
        onlyInFullData.slice(0, 3).forEach((id) => console.log(`    - ${id}`))
        if (onlyInFullData.length > 3) {
          console.log(`    ... and ${onlyInFullData.length - 3} more`)
        }
      }

      if (onlyInCycleBased.length > 0) {
        console.log(`  Only in Cycle-Based (${onlyInCycleBased.length}):`)
        onlyInCycleBased.slice(0, 3).forEach((id) => console.log(`    - ${id}`))
        if (onlyInCycleBased.length > 3) {
          console.log(`    ... and ${onlyInCycleBased.length - 3} more`)
        }
      }

      console.log()
    }

    if (mismatches.length > 10) {
      console.log(`... and ${mismatches.length - 10} more mismatched cycles\n`)
    }
  }
}

runProgram()
