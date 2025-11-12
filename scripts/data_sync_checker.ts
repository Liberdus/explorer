import axios from 'axios'
import * as crypto from '@shardus/crypto-utils'
import { config } from '../src/config'
import { queryFromDistributor, DataType } from '../src/class/DataSync'
import { isDeepStrictEqual } from 'util'
import { writeFileSync } from 'fs'
crypto.init(config.hashKey)

const API_SERVER_URL = 'http:/127.0.0.1:6001'

const startCycle = 0
const endCycle = 0
const saveToFile = false

const data_type: any = DataType.RECEIPT // DataType.RECEIPT // DataType.CYCLE // DataType.ORIGINALTX
const api_url =
  data_type === DataType.RECEIPT ? 'receipt' : data_type === DataType.CYCLE ? 'cycleinfo' : 'originalTx'

interface MismatchResult {
  cycle: number
  distributorCount: number
  collectorCount: number
}

interface TallyItem {
  cycle: number
  receipts?: number
  originalTxsData?: number
  originalTxs?: number
}

const fetchBatch = async (
  cycleStart: number,
  cycleEnd: number
): Promise<{ distributor: TallyItem[]; api: TallyItem[] }> => {
  const distributor_data =
    data_type === DataType.CYCLE
      ? {
          start: cycleStart,
          end: cycleEnd,
        }
      : {
          startCycle: cycleStart,
          endCycle: cycleEnd,
          type: 'tally',
        }
  const api_data =
    data_type === DataType.CYCLE
      ? `?start=${cycleStart}&end=${cycleEnd}`
      : `?startCycle=${cycleStart}&endCycle=${cycleEnd}&tally=true`

  const [res1, res2] = await Promise.all([
    queryFromDistributor(data_type, distributor_data),
    axios.get(`${API_SERVER_URL}/api/${api_url}${api_data}`),
  ])

  let distributorData: TallyItem[] = []
  let apiData: TallyItem[] = []

  switch (data_type) {
    case DataType.RECEIPT:
      distributorData = res1.data.receipts || []
      apiData = res2.data.totalReceipts || []
      break
    case DataType.CYCLE:
      distributorData = res1.data.cycleInfo || []
      apiData = res2.data.cycles || []
      break
    case DataType.ORIGINALTX:
      distributorData = res1.data.originalTxs || []
      apiData = res2.data.totalOriginalTxs || []
      break
  }

  return { distributor: distributorData, api: apiData }
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
  const concurrency = 100

  const batches: Array<{ start: number; end: number }> = []

  // Create batches without overlapping boundaries
  let currentStart = startCycle
  while (currentStart <= endCycle) {
    const batchEnd = Math.min(currentStart + limit - 1, endCycle)
    batches.push({ start: currentStart, end: batchEnd })
    currentStart = batchEnd + 1
  }

  console.log(`Fetching ${batches.length} batches in parallel (concurrency: ${concurrency})...`)

  // Process batches in chunks to limit concurrency
  const batchChunks = chunkArray(batches, concurrency)
  const allResults: Array<{ distributor: TallyItem[]; api: TallyItem[] }> = []

  for (const chunk of batchChunks) {
    console.log(`Processing ${chunk.length} batches in parallel...`)
    const chunkResults = await Promise.all(
      chunk.map((batch) => {
        console.log(`Fetching cycles ${batch.start} to ${batch.end}`)
        return fetchBatch(batch.start, batch.end)
      })
    )
    allResults.push(...chunkResults)
  }

  // Combine results
  let distributor_responses: TallyItem[] = []
  let api_responses: TallyItem[] = []

  for (const result of allResults) {
    distributor_responses = [...distributor_responses, ...result.distributor]
    api_responses = [...api_responses, ...result.api]
  }

  console.log(
    '\nDISTRIBUTOR RESPONSES:',
    distributor_responses.length,
    'API SERVER RESPONSES:',
    api_responses.length
  )

  // Compare and find mismatches
  const mismatches: MismatchResult[] = []

  if (data_type === DataType.RECEIPT || data_type === DataType.ORIGINALTX) {
    // Create maps for easy lookup
    const distributorMap = new Map<number, number>()
    const apiMap = new Map<number, number>()

    for (const item of distributor_responses) {
      const count =
        data_type === DataType.RECEIPT
          ? item.receipts ?? 0
          : data_type === DataType.ORIGINALTX
          ? item.originalTxsData ?? item.originalTxs ?? 0
          : 0
      distributorMap.set(item.cycle, count)
    }

    for (const item of api_responses) {
      const count =
        data_type === DataType.RECEIPT
          ? item.receipts ?? 0
          : data_type === DataType.ORIGINALTX
          ? item.originalTxsData ?? item.originalTxs ?? 0
          : 0
      apiMap.set(item.cycle, count)
    }

    // Find all unique cycles
    const allCycles = new Set([...distributorMap.keys(), ...apiMap.keys()])

    for (const cycle of allCycles) {
      const distributorCount = distributorMap.get(cycle) || 0
      const apiCount = apiMap.get(cycle) || 0

      if (distributorCount !== apiCount) {
        mismatches.push({
          cycle,
          distributorCount,
          collectorCount: apiCount,
        })
      }
    }

    // Sort mismatches by cycle
    mismatches.sort((a, b) => a.cycle - b.cycle)
  }

  // Print mismatches
  if (mismatches.length > 0) {
    console.log(`\n${'='.repeat(70)}`)
    console.log(`Found ${mismatches.length} mismatched cycles:`)
    console.log(`${'='.repeat(70)}`)
    console.log(
      `${'Cycle'.padEnd(10)} | ${'Distributor'.padEnd(15)} | ${'Collector'.padEnd(15)} | ${'Difference'}`
    )
    console.log(`${'-'.repeat(70)}`)

    for (const mismatch of mismatches) {
      const diff = mismatch.collectorCount - mismatch.distributorCount
      console.log(
        `${String(mismatch.cycle).padEnd(10)} | ${String(mismatch.distributorCount).padEnd(15)} | ${String(
          mismatch.collectorCount
        ).padEnd(15)} | ${diff > 0 ? '+' : ''}${diff}`
      )
    }
    console.log(`${'='.repeat(70)}\n`)
  } else {
    console.log('\n✅ No mismatches found! All cycles match.')
  }

  // Deep comparison for cycles
  if (data_type === DataType.CYCLE) {
    const isEqual = isDeepStrictEqual(distributor_responses, api_responses)
    console.log('\nDeep comparison result:', isEqual ? '✅ MATCH' : '❌ MISMATCH')
  }

  // Save to file
  if (saveToFile) {
    writeFileSync(
      `distributor_${data_type}_${startCycle}_${endCycle}.json`,
      JSON.stringify(distributor_responses, null, 4)
    )
    writeFileSync(
      `api_server_${data_type}_${startCycle}_${endCycle}.json`,
      JSON.stringify(api_responses, null, 4)
    )
    console.log('\n📁 Results saved to files')
  }
}
runProgram()
