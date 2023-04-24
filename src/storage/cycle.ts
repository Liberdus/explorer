import * as db from './sqlite3storage'
import { extractValues, extractValuesFromArray } from './sqlite3storage'
import { config } from '../config/index'
import { P2P, StateManager } from '@shardus/types'
import { checkIfAnyReceiptsMissing } from '../class/DataSync'

export let Collection: unknown

export interface Cycle {
  counter: number
  cycleRecord: P2P.CycleCreatorTypes.CycleRecord
  cycleMarker: StateManager.StateMetaDataTypes.CycleMarker
}

export interface DbCycle {
  counter: number
  cycleRecord: string
  cycleMarker: string
}

export function isCycle(obj: Cycle): obj is Cycle {
  return (obj as Cycle).cycleRecord !== undefined && (obj as Cycle).cycleMarker !== undefined
}

export async function insertCycle(cycle: Cycle) {
  try {
    const fields = Object.keys(cycle).join(', ')
    const placeholders = Object.keys(cycle).fill('?').join(', ')
    const values = extractValues(cycle)
    const sql = 'INSERT OR REPLACE INTO cycles (' + fields + ') VALUES (' + placeholders + ')'
    await db.run(sql, values)
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

export async function bulkInsertCycles(cycles: Cycle[]) {
  try {
    const fields = Object.keys(cycles[0]).join(', ')
    const placeholders = Object.keys(cycles[0]).fill('?').join(', ')
    const values = extractValuesFromArray(cycles)
    let sql = 'INSERT OR REPLACE INTO cycles (' + fields + ') VALUES (' + placeholders + ')'
    for (let i = 1; i < cycles.length; i++) {
      sql = sql + ', (' + placeholders + ')'
    }
    await db.run(sql, values)
    console.log('Successfully bulk inserted Cycles', cycles.length)
  } catch (e) {
    console.log(e)
    console.log('Unable to bulk insert Cycles', cycles.length)
  }
}

export async function updateCycle(marker: string, cycle: Cycle) {
  try {
    const sql = `UPDATE cycles SET counter = $counter, cycleRecord = $cycleRecord WHERE cycleMarker = $marker `
    await db.run(sql, {
      $counter: cycle.counter,
      $cycleRecord: cycle.cycleRecord && JSON.stringify(cycle.cycleRecord),
      $marker: marker,
    })
    if (config.verbose) console.log('Updated cycle for counter', cycle.cycleRecord.counter, cycle.cycleMarker)
  } catch (e) {
    console.log(e)
    console.log('Unable to update Cycle', cycle.cycleMarker)
  }
}

export async function insertOrUpdateCycle(cycle: Cycle) {
  if (cycle && cycle.cycleRecord && cycle.cycleMarker) {
    const cycleInfo: Cycle = {
      counter: cycle.cycleRecord.counter,
      cycleRecord: cycle.cycleRecord,
      cycleMarker: cycle.cycleMarker,
    }
    const cycleExist = await queryCycleByMarker(cycle.cycleMarker)
    if (config.verbose) console.log('cycleExist', cycleExist)
    if (cycleExist) {
      if (JSON.stringify(cycleInfo) !== JSON.stringify(cycleExist))
        await updateCycle(cycleInfo.cycleMarker, cycleInfo)
    } else {
      await insertCycle(cycleInfo)
      await checkIfAnyReceiptsMissing(cycleInfo.counter)
    }
  } else {
    console.log('No cycleRecord or cycleMarker in cycle,', cycle)
  }
}

export async function queryLatestCycleRecords(count: number) {
  try {
    const sql = `SELECT * FROM cycles ORDER BY counter DESC LIMIT ${count ? count : 100}`
    const cycleRecords: DbCycle[] = await db.all(sql)
    if (cycleRecords.length > 0) {
      cycleRecords.forEach((cycleRecord: DbCycle) => {
        if (cycleRecord.cycleRecord) cycleRecord.cycleRecord = JSON.parse(cycleRecord.cycleRecord)
      })
    }
    if (config.verbose) console.log('cycle count', cycleRecords)
    return cycleRecords
  } catch (e) {
    console.log(e)
  }
}

export async function queryCycleRecordsBetween(start: number, end: number): Promise<Cycle[]> {
  try {
    const sql = `SELECT * FROM cycles WHERE counter BETWEEN ? AND ? ORDER BY counter DESC`
    const cycles: DbCycle[] = await db.all(sql, [start, end])
    if (cycles.length > 0) {
      cycles.forEach((cycleRecord: DbCycle) => {
        if (cycleRecord.cycleRecord) cycleRecord.cycleRecord = JSON.parse(cycleRecord.cycleRecord)
      })
    }
    if (config.verbose) console.log('cycle between', cycles)
    return cycles
  } catch (e) {
    console.log(e)
  }
}

export async function queryCycleByMarker(marker: string) {
  try {
    const sql = `SELECT * FROM cycles WHERE cycleMarker=? LIMIT 1`
    const cycleRecord: DbCycle = await db.get(sql, [marker])
    if (cycleRecord) {
      if (cycleRecord.cycleRecord) cycleRecord.cycleRecord = JSON.parse(cycleRecord.cycleRecord)
    }
    if (config.verbose) console.log('cycle marker', cycleRecord)
    return cycleRecord
  } catch (e) {
    console.log(e)
  }
}

export async function queryCycleByCounter(counter: number) {
  try {
    const sql = `SELECT * FROM cycles WHERE counter=? LIMIT 1`
    const cycleRecord: DbCycle = await db.get(sql, [counter])
    if (cycleRecord) {
      if (cycleRecord.cycleRecord) cycleRecord.cycleRecord = JSON.parse(cycleRecord.cycleRecord)
    }
    if (config.verbose) console.log('cycle counter', cycleRecord)
    return cycleRecord
  } catch (e) {
    console.log(e)
  }
}

export async function queryCycleCount(): Promise<number> {
  let cycles: { 'COUNT(*)': number } = { 'COUNT(*)': 0 }
  try {
    const sql = `SELECT COUNT(*) FROM cycles`
    cycles = await db.get(sql, [])
  } catch (e) {
    console.log(e)
  }
  if (config.verbose) console.log('Cycle count', cycles)

  return cycles ? cycles['COUNT(*)'] : 0
}
