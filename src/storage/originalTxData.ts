import * as db from './sqlite3storage'
import { originalTxDataDatabase } from '.'
import { config } from '../config/index'
import { TransactionType, OriginalTxData, TransactionSearchType } from '../types'
import { Utils as StringUtils } from '@shardus/types'

type DbOriginalTxData = OriginalTxData & {
  originalTxData: string
}

const ORIGINAL_TX_DATA_COLUMNS: readonly (keyof OriginalTxData)[] = [
  'txId',
  'timestamp',
  'cycle',
  'originalTxData',
  'transactionType',
  'txFrom',
  'txTo',
] as const

export const originalTxsMap: Map<string, number> = new Map()

export async function insertOriginalTxData(originalTxData: OriginalTxData): Promise<void> {
  try {
    const fields = `(${ORIGINAL_TX_DATA_COLUMNS.join(', ')})`
    // Create placeholders for one row
    const placeholders = `(${ORIGINAL_TX_DATA_COLUMNS.map(() => '?').join(', ')})`

    // Map the `originalTxData` object to match the columns
    const values = ORIGINAL_TX_DATA_COLUMNS.map((column) =>
      typeof originalTxData[column] === 'object'
        ? StringUtils.safeStringify(originalTxData[column]) // Serialize objects to JSON
        : originalTxData[column]
    )

    const sql = `INSERT OR REPLACE INTO originalTxsData ${fields} VALUES ${placeholders}`
    await db.run(originalTxDataDatabase, sql, values)
    if (config.verbose) console.log(`Successfully inserted OriginalTxData`, originalTxData.txId)
  } catch (e) {
    console.log(e)
    console.log(`Unable to insert originalTxsData or it is already stored in to database`, originalTxData)
  }
}

export async function bulkInsertOriginalTxsData(originalTxsData: OriginalTxData[]): Promise<void> {
  try {
    const fields = `(${ORIGINAL_TX_DATA_COLUMNS.join(', ')})`
    // Create placeholders for one row
    const placeholders = `(${ORIGINAL_TX_DATA_COLUMNS.map(() => '?').join(', ')})`
    // Create multiple placeholder groups for bulk insert
    const allPlaceholders = Array(originalTxsData.length).fill(placeholders).join(', ')

    // Flatten the `originalTxsData` array into a single list of values
    const values = originalTxsData.flatMap((originalTxData) =>
      ORIGINAL_TX_DATA_COLUMNS.map((column) =>
        typeof originalTxData[column] === 'object'
          ? StringUtils.safeStringify(originalTxData[column]) // Serialize objects to JSON
          : originalTxData[column]
      )
    )

    const sql = `INSERT OR REPLACE INTO originalTxsData ${fields} VALUES ${allPlaceholders}`
    // Serialize write through storage-level queue + transaction for atomicity
    await db.executeDbWriteWithTransaction(originalTxDataDatabase, sql, values)
    console.log(`Successfully bulk inserted OriginalTxsData`, originalTxsData.length)
  } catch (e) {
    console.log(e)
    console.log(`Unable to bulk insert OriginalTxsData`, originalTxsData.length)
    throw e // check with Achal/Jai
  }
}

export async function processOriginalTxData(
  originalTxsData: OriginalTxData[],
  saveOnlyNewData = false
): Promise<void> {
  if (originalTxsData && originalTxsData.length <= 0) return
  const bucketSize = 1000
  let combineOriginalTxsData: OriginalTxData[] = []
  for (const originalTxData of originalTxsData) {
    const { txId, timestamp } = originalTxData
    if (originalTxsMap.has(txId) && originalTxsMap.get(txId) === timestamp) continue
    originalTxsMap.set(txId, timestamp)
    /* prettier-ignore */ if (config.verbose) console.log('originalTxData', originalTxData)
    if (saveOnlyNewData) {
      const originalTxDataExist = await queryOriginalTxDataByTxId(txId)
      if (originalTxDataExist) continue
    }
    if (!config.processData.indexOriginalTxData) combineOriginalTxsData.push(originalTxData)
    else {
      try {
        const transactionType = originalTxData.originalTxData.tx.type as TransactionType // be sure to update with the correct field with the transaction type defined in the dapp
        const txFrom = originalTxData.originalTxData.tx.from // be sure to update with the correct field of the tx sender
        const txTo = originalTxData.originalTxData.tx.to // be sure to update with the correct field of the tx recipient
        combineOriginalTxsData.push({
          ...originalTxData,
          transactionType,
          txFrom,
          txTo,
        })
      } catch (e) {
        console.log('Error in processing original Tx data', originalTxData.txId, e)
      }
    }
    if (combineOriginalTxsData.length >= bucketSize) {
      await bulkInsertOriginalTxsData(combineOriginalTxsData)
      combineOriginalTxsData = []
    }
  }
  if (combineOriginalTxsData.length > 0) await bulkInsertOriginalTxsData(combineOriginalTxsData)
}

type QueryOriginalTxDataCountParams = {
  accountId?: string
  startCycle?: number
  endCycle?: number
  txType?: TransactionSearchType
  afterTimestamp?: number
}

type QueryOriginalTxsDataParams = QueryOriginalTxDataCountParams & {
  skip?: number
  limit?: number /* default 10, set 0 for all */
}

export async function queryOriginalTxDataCount(
  query: QueryOriginalTxDataCountParams | null = null
): Promise<number> {
  const { accountId, startCycle, endCycle, txType, afterTimestamp } = query ?? {}
  let originalTxsData: { 'COUNT(*)': number } = { 'COUNT(*)': 0 }
  try {
    let sql = `SELECT COUNT(*) FROM originalTxsData`
    const values: unknown[] = []
    if (accountId) {
      sql = db.updateSqlStatementClause(sql, values)
      sql += `txFrom=? OR txTo=?`
      values.push(accountId, accountId)
    }
    if (txType) {
      sql = db.updateSqlStatementClause(sql, values)
      sql += `transactionType=?`
      values.push(txType)
    }
    if (startCycle || endCycle) {
      sql = db.updateSqlStatementClause(sql, values)
      sql += `cycle BETWEEN ? AND ?`
      values.push(startCycle, endCycle)
    }
    if (afterTimestamp) {
      sql = db.updateSqlStatementClause(sql, values)
      sql += `timestamp>?`
      values.push(afterTimestamp)
    }
    originalTxsData = (await db.get(originalTxDataDatabase, sql, values)) as { 'COUNT(*)': number }
  } catch (e) {
    console.log(e)
  }
  if (config.verbose) console.log('OriginalTxData count', originalTxsData)
  return originalTxsData['COUNT(*)'] || 0
}

export async function queryOriginalTxsData(query: QueryOriginalTxsDataParams): Promise<OriginalTxData[]> {
  const { skip = 0, limit = 10, accountId, startCycle, endCycle, txType, afterTimestamp } = query
  let originalTxsData: DbOriginalTxData[] = []
  try {
    let sql = `SELECT * FROM originalTxsData`
    const values: unknown[] = []
    if (accountId) {
      sql = db.updateSqlStatementClause(sql, values)
      sql += `txFrom=? OR txTo=?`
      values.push(accountId, accountId)
    }
    if (txType) {
      sql = db.updateSqlStatementClause(sql, values)
      sql += `transactionType=?`
      values.push(txType)
    }
    if (startCycle || endCycle) {
      sql = db.updateSqlStatementClause(sql, values)
      sql += `cycle BETWEEN ? AND ?`
      values.push(startCycle, endCycle)
    }
    if (afterTimestamp) {
      sql = db.updateSqlStatementClause(sql, values)
      sql += `timestamp>?`
      values.push(afterTimestamp)
    }
    if (startCycle || endCycle) {
      sql += ` ORDER BY cycle ASC, timestamp ASC`
    } else {
      sql += ` ORDER BY cycle DESC, timestamp DESC`
    }
    if (limit > 0) {
      sql += ` LIMIT ${limit}`
    }
    if (skip > 0) {
      sql += ` OFFSET ${skip}`
    }
    originalTxsData = (await db.all(originalTxDataDatabase, sql, values)) as DbOriginalTxData[]
    originalTxsData.forEach((originalTxData: DbOriginalTxData) => deserializeDbOriginalTxData(originalTxData))
  } catch (e) {
    console.log(e)
  }
  if (config.verbose) console.log('OriginalTxData originalTxsData', originalTxsData)
  return originalTxsData as unknown as OriginalTxData[]
}

export async function queryOriginalTxDataByTxId(txId: string): Promise<OriginalTxData | null> {
  try {
    const sql = `SELECT * FROM originalTxsData WHERE txId=?`
    const originalTxData = (await db.get(originalTxDataDatabase, sql, [txId])) as DbOriginalTxData
    if (originalTxData) deserializeDbOriginalTxData(originalTxData)
    if (config.verbose) console.log('OriginalTxData txId', originalTxData)
    return originalTxData as unknown as OriginalTxData
  } catch (e) {
    console.log(e)
  }
  return null
}

export async function queryOriginalTxDataCountByCycles(
  start: number,
  end: number
): Promise<{ originalTxsData: number; cycle: number }[]> {
  let originalTxsData: { cycle: number; 'COUNT(*)': number }[] = []
  try {
    const sql = `SELECT cycle, COUNT(*) FROM originalTxsData GROUP BY cycle HAVING cycle BETWEEN ? AND ? ORDER BY cycle ASC`
    originalTxsData = (await db.all(originalTxDataDatabase, sql, [start, end])) as {
      cycle: number
      'COUNT(*)': number
    }[]
  } catch (e) {
    console.log(e)
  }
  if (config.verbose) console.log('OriginalTxData count by cycles', originalTxsData)

  return originalTxsData.map((originalTxData) => {
    return {
      originalTxsData: originalTxData['COUNT(*)'],
      cycle: originalTxData.cycle,
    }
  })
}

export function deserializeDbOriginalTxData(originalTxData: DbOriginalTxData): void {
  originalTxData.originalTxData &&= StringUtils.safeJsonParse(originalTxData.originalTxData)
}

export function cleanOldOriginalTxsMap(timestamp: number): void {
  for (const [key, value] of originalTxsMap) {
    if (value < timestamp) {
      originalTxsMap.delete(key)
    }
  }
  if (config.verbose) console.log('Clean Old OriginalTxs map!', timestamp, originalTxsMap)
}
