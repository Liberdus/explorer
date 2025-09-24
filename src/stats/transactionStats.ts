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

// Helper function to convert snake_case enum value to totalPascalCaseTxs property name
function transactionTypeToPropertyName(transactionType: TransactionType): keyof BaseTxStats {
  const snakeToPascal = (str: string): string => {
    return str
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join('')
  }
  return `total${snakeToPascal(transactionType)}Txs` as keyof BaseTxStats
}

// Get ordered list of transaction types
function getOrderedTransactionTypes(): TransactionType[] {
  return Object.values(TransactionType)
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
  const orderedTypes = getOrderedTransactionTypes()
  const result = {} as BaseTxStats

  orderedTypes.forEach((type) => {
    const propertyName = transactionTypeToPropertyName(type)
    result[propertyName] = 0
  })

  return result
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
