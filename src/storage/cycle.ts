import * as db from './sqlite3storage'
import { cycleDatabase } from '.'
import { Cycle } from '../types'
import { config } from '../config/index'
import { cleanOldReceiptsMap } from './receipt'
import { cleanOldOriginalTxsMap } from './originalTxData'
import { Utils as StringUtils } from '@shardus/types'
import { checkAndSyncDataByCycle } from '../class/DataSync'

type DbCycle = Cycle & {
  cycleRecord: string
}

const CYCLE_COLUMNS: readonly (keyof Cycle)[] = ['cycleMarker', 'counter', 'start', 'cycleRecord'] as const

export function isCycle(obj: Cycle): obj is Cycle {
  return (obj as Cycle).cycleRecord !== undefined && (obj as Cycle).cycleMarker !== undefined
}

export async function insertCycle(cycle: Cycle): Promise<void> {
  try {
    const fields = `(${CYCLE_COLUMNS.join(', ')})`
    // Create placeholders for one row
    const placeholders = `(${CYCLE_COLUMNS.map(() => '?').join(', ')})`

    // Map the `cycle` object to match the columns
    const values = CYCLE_COLUMNS.map((column) =>
      typeof cycle[column] === 'object'
        ? StringUtils.safeStringify(cycle[column]) // Serialize objects to JSON
        : cycle[column]
    )

    const sql = `INSERT OR REPLACE INTO cycles ${fields} VALUES ${placeholders}`
    await db.run(cycleDatabase, sql, values)
    if (config.verbose)
      console.log('Successfully inserted Cycle', cycle.cycleRecord.counter, cycle.cycleMarker)
  } catch (e) {
    console.log(e)
    console.log(
      'Unable to insert cycle or it is already stored in to database',
      cycle.cycleRecord.counter,
      cycle.cycleMarker
    )
  }
}

export async function bulkInsertCycles(cycles: Cycle[]): Promise<void> {
  try {
    const fields = `(${CYCLE_COLUMNS.join(', ')})`
    // Create placeholders for one row
    const placeholders = `(${CYCLE_COLUMNS.map(() => '?').join(', ')})`
    // Create multiple placeholder groups for bulk insert
    const allPlaceholders = Array(cycles.length).fill(placeholders).join(', ')

    // Flatten the `cycles` array into a single list of values
    const values = cycles.flatMap((cycle) =>
      CYCLE_COLUMNS.map((column) =>
        typeof cycle[column] === 'object'
          ? StringUtils.safeStringify(cycle[column]) // Serialize objects to JSON
          : cycle[column]
      )
    )

    const sql = `INSERT OR REPLACE INTO cycles ${fields} VALUES ${allPlaceholders}`
    // Serialize write through storage-level queue + transaction for atomicity
    await db.executeDbWriteWithTransaction(cycleDatabase, sql, values)
    console.log('Successfully bulk inserted Cycles', cycles.length)
  } catch (e) {
    console.log(e)
    console.log('Unable to bulk insert Cycles', cycles.length)
  }
}

export async function updateCycle(marker: string, cycle: Cycle): Promise<void> {
  try {
    const sql = `UPDATE cycles SET counter = $counter, cycleRecord = $cycleRecord, start = $start WHERE cycleMarker = $marker `
    await db.run(cycleDatabase, sql, {
      $counter: cycle.counter,
      $cycleRecord: cycle.cycleRecord && StringUtils.safeStringify(cycle.cycleRecord),
      $start: cycle.start,
      $marker: marker,
    })
    if (config.verbose) console.log('Updated cycle for counter', cycle.cycleRecord.counter, cycle.cycleMarker)
  } catch (e) {
    console.log(e)
    console.log('Unable to update Cycle', cycle.cycleMarker)
  }
}

export async function insertOrUpdateCycle(cycle: Cycle): Promise<void> {
  if (cycle && cycle.cycleRecord && cycle.cycleMarker) {
    const cycleInfo: Cycle = {
      counter: cycle.cycleRecord.counter,
      cycleRecord: cycle.cycleRecord,
      cycleMarker: cycle.cycleMarker,
      start: cycle.cycleRecord.start, // Extract start timestamp from cycleRecord.start
    }
    const cycleExist = await queryCycleByMarker(cycle.cycleMarker)
    if (config.verbose) console.log('cycleExist', cycleExist)
    if (cycleExist) {
      if (StringUtils.safeStringify(cycleInfo) !== StringUtils.safeStringify(cycleExist))
        await updateCycle(cycleInfo.cycleMarker, cycleInfo)
    } else {
      await insertCycle(cycleInfo)
      // Clean up receipts map that are older than 5 minutes
      const CLEAN_UP_TIMESTMAP_MS = Date.now() - 5 * 60 * 1000
      cleanOldReceiptsMap(CLEAN_UP_TIMESTMAP_MS)
      cleanOldOriginalTxsMap(CLEAN_UP_TIMESTMAP_MS)
    }

    // Trigger cycle-based synchronization check when new cycle data is received
    if (cycleInfo.counter > 0) {
      // Run sync in background
      checkAndSyncDataByCycle(cycleInfo.counter).catch((error) => {
        console.error('Error in checkAndSyncDataByCycle:', error)
      })
    }
  } else {
    console.log('No cycleRecord or cycleMarker in cycle,', cycle)
  }
}

export async function queryLatestCycleRecords(count: number): Promise<Cycle[]> {
  try {
    const sql = `SELECT * FROM cycles ORDER BY counter DESC LIMIT ${count}`
    const cycleRecords = (await db.all(cycleDatabase, sql)) as DbCycle[]
    if (cycleRecords.length > 0) {
      cycleRecords.forEach((cycleRecord: DbCycle) => {
        if (cycleRecord.cycleRecord)
          cycleRecord.cycleRecord = StringUtils.safeJsonParse(cycleRecord.cycleRecord)
      })
    }
    if (config.verbose) console.log('cycle latest', cycleRecords)
    return cycleRecords as unknown as Cycle[]
  } catch (e) {
    console.log(e)
  }

  return []
}

export async function queryCycleRecordsBetween(start: number, end: number): Promise<Cycle[]> {
  try {
    const sql = `SELECT * FROM cycles WHERE counter BETWEEN ? AND ? ORDER BY counter ASC`
    const cycles = (await db.all(cycleDatabase, sql, [start, end])) as DbCycle[]
    if (cycles.length > 0) {
      cycles.forEach((cycleRecord: DbCycle) => {
        if (cycleRecord.cycleRecord)
          cycleRecord.cycleRecord = StringUtils.safeJsonParse(cycleRecord.cycleRecord)
      })
    }
    if (config.verbose) console.log('cycle between', cycles)
    return cycles as unknown as Cycle[]
  } catch (e) {
    console.log(e)
  }
  return []
}

export async function queryCycleByMarker(marker: string): Promise<Cycle | null> {
  try {
    const sql = `SELECT * FROM cycles WHERE cycleMarker=? LIMIT 1`
    const cycleRecord = (await db.get(cycleDatabase, sql, [marker])) as DbCycle
    if (cycleRecord) {
      if (cycleRecord.cycleRecord)
        cycleRecord.cycleRecord = StringUtils.safeJsonParse(cycleRecord.cycleRecord)
    }
    if (config.verbose) console.log('cycle marker', cycleRecord)
    return cycleRecord as unknown as Cycle
  } catch (e) {
    console.log(e)
  }

  return null
}

export async function queryCycleByCounter(counter: number): Promise<Cycle | null> {
  try {
    const sql = `SELECT * FROM cycles WHERE counter=? LIMIT 1`
    const cycleRecord = (await db.get(cycleDatabase, sql, [counter])) as DbCycle
    if (cycleRecord) {
      if (cycleRecord.cycleRecord)
        cycleRecord.cycleRecord = StringUtils.safeJsonParse(cycleRecord.cycleRecord)
    }
    if (config.verbose) console.log('cycle counter', cycleRecord)
    return cycleRecord as unknown as Cycle
  } catch (e) {
    console.log(e)
  }

  return null
}

export async function queryCycleCount(): Promise<number> {
  let cycles: { 'COUNT(*)': number } = { 'COUNT(*)': 0 }
  try {
    const sql = `SELECT COUNT(*) FROM cycles`
    cycles = (await db.get(cycleDatabase, sql, [])) as { 'COUNT(*)': number }
  } catch (e) {
    console.log(e)
  }
  if (config.verbose) console.log('Cycle count', cycles)

  return cycles['COUNT(*)'] || 0
}

export async function queryLatestCycleNumber(): Promise<number> {
  const latestCycleRecords = await queryLatestCycleRecords(1)
  const latestCycleNumber = latestCycleRecords.length > 0 ? latestCycleRecords[0].counter : 0
  return latestCycleNumber
}

export async function queryCycleRecordsByTimestamp(
  afterTimestampInSeconds: number,
  beforeTimestampInSeconds: number
): Promise<Cycle[]> {
  try {
    const sql = `SELECT * FROM cycles WHERE start > ? AND start < ? ORDER BY counter ASC`
    const cycles = (await db.all(cycleDatabase, sql, [
      afterTimestampInSeconds,
      beforeTimestampInSeconds,
    ])) as DbCycle[]

    if (cycles.length > 0) {
      cycles.forEach((cycleRecord: DbCycle) => {
        if (cycleRecord.cycleRecord)
          cycleRecord.cycleRecord = StringUtils.safeJsonParse(cycleRecord.cycleRecord)
      })
    }

    console.log('cycles by timestamp', cycles.length)
    return cycles as unknown as Cycle[]
  } catch (e) {
    console.log('Error querying cycles by timestamp:', e)
    return []
  }
}

export interface CycleGap {
  startCycle: number
  endCycle: number
  gapSize: number
}

/**
 * Efficiently query for missing cycle ranges
 * Returns ranges of missing cycles from 0 to targetCycle
 * Uses LEFT JOIN to find gaps between consecutive cycles - O(N) complexity
 */
export async function queryMissingCycleRanges(targetCycle: number): Promise<CycleGap[]> {
  try {
    // Get first and last cycle for edge gap detection
    const firstCycleResult = (await db.get(
      cycleDatabase,
      'SELECT MIN(counter) as first_cycle FROM cycles',
      []
    )) as { first_cycle: number } | undefined

    const lastCycleResult = (await db.get(
      cycleDatabase,
      'SELECT MAX(counter) as last_cycle FROM cycles WHERE counter <= ?',
      [targetCycle]
    )) as { last_cycle: number } | undefined

    const firstCycle = firstCycleResult?.first_cycle ?? 0
    const lastCycle = lastCycleResult?.last_cycle ?? -1

    const ranges: CycleGap[] = []

    // Check for gap at the beginning (0 to firstCycle - 1)
    if (firstCycle > 0) {
      ranges.push({
        startCycle: 0,
        endCycle: firstCycle - 1,
        gapSize: firstCycle,
      })
    }

    // Find gaps in the middle using LEFT JOIN
    // For each cycle c1, check if the next cycle (c1.counter + 1) exists
    // If not, find where the gap ends by looking for the next existing cycle
    const sql = `
      SELECT
        c1.counter + 1 AS startCycle,
        (SELECT MIN(c2.counter) - 1
         FROM cycles c2
         WHERE c2.counter > c1.counter AND c2.counter <= ?) AS endCycle
      FROM cycles c1
      WHERE NOT EXISTS (
        SELECT 1 FROM cycles c3
        WHERE c3.counter = c1.counter + 1
      )
      AND c1.counter < ?
      ORDER BY c1.counter
    `

    const middleGaps = (await db.all(cycleDatabase, sql, [targetCycle, targetCycle])) as {
      startCycle: number
      endCycle: number
    }[]

    // Add middle gaps with calculated gapSize (filter out null endCycle values)
    for (const gap of middleGaps) {
      if (gap.endCycle !== null && gap.endCycle >= gap.startCycle) {
        ranges.push({
          startCycle: gap.startCycle,
          endCycle: gap.endCycle,
          gapSize: gap.endCycle - gap.startCycle + 1,
        })
      }
    }

    // Check for gap at the end (lastCycle + 1 to targetCycle)
    if (lastCycle >= 0 && lastCycle < targetCycle) {
      ranges.push({
        startCycle: lastCycle + 1,
        endCycle: targetCycle,
        gapSize: targetCycle - lastCycle,
      })
    }

    if (config.verbose) console.log(`Found ${ranges.length} missing cycle ranges`)
    return ranges
  } catch (e) {
    console.log('Error querying missing cycle ranges:', e)
    throw e
  }
}
