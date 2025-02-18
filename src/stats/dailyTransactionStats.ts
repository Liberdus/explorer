/* eslint-disable no-empty */
import { config } from '../config'
import * as db from '../storage/sqlite3storage'
import { dailyTransactionStatsDatabase } from '.'

export interface DailyTransactionStats {
  dateStartTime: number
  totalTxs: number
  totalTransferTxs: number
  totalMessageTxs: number
  totalDepositStakeTxs: number
  totalWithdrawStakeTxs: number
}

export async function insertDailyTransactionStats(
  dailyTransactionStats: DailyTransactionStats
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
  dailyTransactionsStats: DailyTransactionStats[]
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
      'Successfully bulk inserted TransactionsStats',
      dailyTransactionsStats.length,
      'for cycles',
      addedCycles
    )
  } catch (e) {
    console.log(e)
    console.log('Unable to bulk insert TransactionsStats', dailyTransactionsStats.length)
  }
}

export async function queryLatestDailyTransactionStats(count: number): Promise<DailyTransactionStats[]> {
  try {
    const sql = `SELECT * FROM daily_transactions ORDER BY dateStartTime DESC LIMIT ${count ? count : 100}`
    const dailyTransactionsStats: DailyTransactionStats[] = await db.all(dailyTransactionStatsDatabase, sql)
    if (config.verbose) console.log('dailyTransactionStats count', dailyTransactionsStats)
    return dailyTransactionsStats
  } catch (e) {
    console.log(e)
  }
}

export async function queryDailyTransactionStatsBetween(
  startTimestamp: number,
  endTimestamp: number
): Promise<DailyTransactionStats[]> {
  try {
    const sql = `SELECT * FROM daily_transactions WHERE dateStartTime BETWEEN ? AND ? ORDER BY dateStartTime ASC`
    const dailyTransactionsStats: DailyTransactionStats[] = await db.all(dailyTransactionStatsDatabase, sql, [
      startTimestamp,
      endTimestamp,
    ])
    if (config.verbose) console.log('dailyTransactionStats between', dailyTransactionsStats)
    return dailyTransactionsStats
  } catch (e) {
    console.log(e)
  }
}
