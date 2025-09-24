/* eslint-disable no-empty */
import { config } from '../config'
import * as db from '../storage/sqlite3storage'
import { dailyTransactionStatsDatabase } from '.'
import { BaseTxStats } from './transactionStats'

export interface BaseDailyTransactionStats {
  dateStartTime: number
  totalTxs: number
}

export type DailyTransactionStats = BaseDailyTransactionStats & BaseTxStats

export type DbDailyTransactionStats = BaseDailyTransactionStats & {
  txsByType: string
}

export async function insertDailyTransactionStats(
  dailyTransactionStats: DbDailyTransactionStats
): Promise<void> {
  try {
    const fields = Object.keys(dailyTransactionStats).join(', ')
    const placeholders = Object.keys(dailyTransactionStats).fill('?').join(', ')
    const values = db.extractValues(dailyTransactionStats)
    const sql = 'INSERT OR REPLACE INTO daily_transactions (' + fields + ') VALUES (' + placeholders + ')'
    await db.run(dailyTransactionStatsDatabase, sql, values)
    console.log('Successfully inserted DailyTransactionStats', dailyTransactionStats.dateStartTime)
  } catch (e) {
    console.log(e)
    console.log(
      'Unable to insert dailyTransactionStats or it is already stored in to database',
      dailyTransactionStats.dateStartTime
    )
  }
}

export async function bulkInsertTransactionsStats(
  dailyTransactionsStats: DbDailyTransactionStats[]
): Promise<void> {
  try {
    const fields = Object.keys(dailyTransactionsStats[0]).join(', ')
    const placeholders = Object.keys(dailyTransactionsStats[0]).fill('?').join(', ')
    const values = db.extractValuesFromArray(dailyTransactionsStats)
    let sql = 'INSERT OR REPLACE INTO daily_transactions (' + fields + ') VALUES (' + placeholders + ')'
    for (let i = 1; i < dailyTransactionsStats.length; i++) {
      sql = sql + ', (' + placeholders + ')'
    }
    await db.run(dailyTransactionStatsDatabase, sql, values)
    const addedCycles = dailyTransactionsStats.map((v) => v)
    console.log(
      'Successfully bulk inserted DailyTransactionStats',
      dailyTransactionsStats.length,
      'for cycles',
      addedCycles
    )
  } catch (e) {
    console.log(e)
    console.log('Unable to bulk insert dailyTransactionStats', dailyTransactionsStats.length)
  }
}

export async function queryLatestDailyTransactionStats(count: number): Promise<DailyTransactionStats[]> {
  try {
    const sql = `SELECT * FROM daily_transactions ORDER BY dateStartTime DESC ${
      count ? 'LIMIT ' + count : ''
    }`
    const dailyTransactionsStats: DbDailyTransactionStats[] = await db.all(dailyTransactionStatsDatabase, sql)
    if (config.verbose) console.log('dailyTransactionStats count', dailyTransactionsStats)
    return parseDailyTransactionStats(dailyTransactionsStats)
  } catch (e) {
    console.log(e)
    return []
  }
}

export async function queryDailyTransactionStatsBetween(
  startTimestamp: number,
  endTimestamp: number
): Promise<DailyTransactionStats[]> {
  try {
    const sql = `SELECT * FROM daily_transactions WHERE dateStartTime BETWEEN ? AND ? ORDER BY dateStartTime ASC`
    const dailyTransactionsStats: DbDailyTransactionStats[] = await db.all(
      dailyTransactionStatsDatabase,
      sql,
      [startTimestamp, endTimestamp]
    )
    if (config.verbose) console.log('dailyTransactionStats between', dailyTransactionsStats)
    return parseDailyTransactionStats(dailyTransactionsStats)
  } catch (e) {
    console.log(e)
  }
}

export function parseDailyTransactionStats(stats: DbDailyTransactionStats[]): DailyTransactionStats[] {
  if (!stats || !stats.length) return []
  return stats.map((stat) => {
    const txsByType = JSON.parse(stat.txsByType) as BaseTxStats
    // Ensure all required fields from BaseTxStats and DailyTransactionStats (except txsByType) are present
    return {
      dateStartTime: stat.dateStartTime,
      totalTxs: stat.totalTxs,
      ...txsByType,
    } as DailyTransactionStats
  })
}
