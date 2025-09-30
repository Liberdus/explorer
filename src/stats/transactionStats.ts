/* eslint-disable no-empty */
import { config } from '../config'
import * as db from '../storage/sqlite3storage'
import { transactionStatsDatabase } from '.'
import { DailyTransactionStats } from './dailyTransactionStats'
import { TransactionType } from '../types/transaction'

// Utility type to convert snake_case to PascalCase
type SnakeToPascal<S extends string> = S extends `${infer T}_${infer U}`
  ? `${Capitalize<T>}${SnakeToPascal<U>}`
  : Capitalize<S>

// Utility type to generate total field names from TransactionType enum
type TotalTxFieldName<T extends TransactionType> = `total${SnakeToPascal<T>}Txs`

// Generate BaseTxStats interface from TransactionType enum
export type BaseTxStats = {
  [K in TransactionType as TotalTxFieldName<K>]: number
}

// Cache for ordered transaction types
// Avoids rebuilding the array on every call since enum values never change at runtime
// Used frequently by convertBaseTxStatsAsArray, convertBaseTxStatsFromArray, createEmptyBaseTxStats, and generateTransactionStatsSchema
let orderedTransactionTypesCache: TransactionType[] | null = null

// Cache for transaction type to property name mappings
// Avoids repeated string splitting and transformation for each transaction type
// Called many times in loops when processing transaction stats (e.g., every transaction type in convertBaseTxStatsAsArray)
const transactionTypeToPropertyNameCache = new Map<TransactionType, keyof BaseTxStats>()

// Cache for empty base tx stats
// Avoids recreating the same empty object structure on every call since the result is always the same
// Returns the same immutable object reference for efficiency
let emptyBaseTxStatsCache: BaseTxStats | null = null

// Helper function to convert snake_case enum value to totalPascalCaseTxs property name
export function transactionTypeToPropertyName(transactionType: TransactionType): keyof BaseTxStats {
  if (transactionTypeToPropertyNameCache.has(transactionType)) {
    return transactionTypeToPropertyNameCache.get(transactionType)!
  }

  const snakeToPascal = (str: string): string => {
    return str
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join('')
  }
  const propertyName = `total${snakeToPascal(transactionType)}Txs` as keyof BaseTxStats
  transactionTypeToPropertyNameCache.set(transactionType, propertyName)
  return propertyName
}

// Get ordered list of transaction types
export function getOrderedTransactionTypes(): TransactionType[] {
  if (orderedTransactionTypesCache === null) {
    orderedTransactionTypesCache = Object.values(TransactionType)
  }
  return orderedTransactionTypesCache
}

export function convertBaseTxStatsAsArray(stats: TransactionStats | DailyTransactionStats): number[] {
  const orderedTypes = getOrderedTransactionTypes()
  return orderedTypes.map((type) => {
    const propertyName = transactionTypeToPropertyName(type)
    return stats[propertyName] || 0
  })
}

export function convertBaseTxStatsFromArray(arr: number[]): BaseTxStats {
  const orderedTypes = getOrderedTransactionTypes()
  const result = {} as BaseTxStats

  orderedTypes.forEach((type, index) => {
    const propertyName = transactionTypeToPropertyName(type)
    result[propertyName] = arr[index]
  })

  return result
}

export function createEmptyBaseTxStats(): BaseTxStats {
  if (emptyBaseTxStatsCache === null) {
    const orderedTypes = getOrderedTransactionTypes()
    const result = {} as BaseTxStats

    orderedTypes.forEach((type) => {
      const propertyName = transactionTypeToPropertyName(type)
      result[propertyName] = 0
    })

    emptyBaseTxStatsCache = result
  }
  return emptyBaseTxStatsCache
}

export function generateTransactionStatsSchema(): string {
  const orderedTypes = getOrderedTransactionTypes()
  const dynamicColumns = orderedTypes
    .map((type) => {
      const propertyName = transactionTypeToPropertyName(type)
      return `${propertyName} NUMBER NOT NULL DEFAULT 0`
    })
    .join(',\n      ')

  return dynamicColumns
}

export interface TransactionStats extends BaseTxStats {
  timestamp: number
  cycle: number
  totalTxs: number
}

export async function insertTransactionStats(transactionStats: TransactionStats): Promise<void> {
  try {
    const fields = Object.keys(transactionStats).join(', ')
    const placeholders = Object.keys(transactionStats).fill('?').join(', ')
    const values = db.extractValues(transactionStats)
    const sql = 'INSERT OR REPLACE INTO transactions (' + fields + ') VALUES (' + placeholders + ')'
    await db.run(transactionStatsDatabase, sql, values)
    console.log('Successfully inserted TransactionStats', transactionStats.cycle)
  } catch (e) {
    console.log(e)
    console.log(
      'Unable to insert transactionStats or it is already stored in to database',
      transactionStats.cycle
    )
  }
}

export async function bulkInsertTransactionsStats(transactionsStats: TransactionStats[]): Promise<void> {
  try {
    const fields = Object.keys(transactionsStats[0]).join(', ')
    const placeholders = Object.keys(transactionsStats[0]).fill('?').join(', ')
    const values = db.extractValuesFromArray(transactionsStats)
    let sql = 'INSERT OR REPLACE INTO transactions (' + fields + ') VALUES (' + placeholders + ')'
    for (let i = 1; i < transactionsStats.length; i++) {
      sql = sql + ', (' + placeholders + ')'
    }
    await db.run(transactionStatsDatabase, sql, values)
    const addedCycles = transactionsStats.map((v) => v.cycle)
    console.log(
      'Successfully bulk inserted TransactionsStats',
      transactionsStats.length,
      'for cycles',
      addedCycles
    )
  } catch (e) {
    console.log(e)
    console.log('Unable to bulk insert TransactionsStats', transactionsStats.length)
  }
}

export async function queryLatestTransactionStats(count: number): Promise<TransactionStats[]> {
  try {
    const sql = `SELECT * FROM transactions ORDER BY cycle DESC LIMIT ${count ? count : 100}`
    const transactionsStats: TransactionStats[] = await db.all(transactionStatsDatabase, sql)
    if (config.verbose) console.log('transactionStats count', transactionsStats)
    return transactionsStats
  } catch (e) {
    console.log(e)
  }
}

export async function queryTransactionStatsBetween(
  startCycle: number,
  endCycle: number
): Promise<TransactionStats[]> {
  try {
    const sql = `SELECT * FROM transactions WHERE cycle BETWEEN ? AND ? ORDER BY cycle ASC`
    const transactionsStats: TransactionStats[] = await db.all(transactionStatsDatabase, sql, [
      startCycle,
      endCycle,
    ])
    if (config.verbose) console.log('transactionStats between', transactionsStats)
    return transactionsStats
  } catch (e) {
    console.log(e)
  }
}
