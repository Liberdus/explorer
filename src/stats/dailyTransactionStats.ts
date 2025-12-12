import { config } from '../config'
import * as db from '../storage/sqlite3storage'
import { dailyTransactionStatsDatabase } from '.'
import { BaseTxStats } from './transactionStats'

export interface BaseDailyTransactionStats {
  dateStartTime: number
  totalTxs: number
  totalUserTxs: number
}

export type DailyTransactionStats = BaseDailyTransactionStats & BaseTxStats

export type DbDailyTransactionStats = BaseDailyTransactionStats & {
  txsByType: string
  txsWithFeeByType: string
}

const DAILY_TRANSACTION_STATS_COLUMNS: readonly (keyof DbDailyTransactionStats)[] = [
  'dateStartTime',
  'totalTxs',
  'totalUserTxs',
  'txsByType',
  'txsWithFeeByType',
] as const

export async function insertDailyTransactionStats(
  dailyTransactionStats: DbDailyTransactionStats
): Promise<void> {
  try {
    const fields = `(${DAILY_TRANSACTION_STATS_COLUMNS.join(', ')})`
    // Create placeholders for one row
    const placeholders = `(${DAILY_TRANSACTION_STATS_COLUMNS.map(() => '?').join(', ')})`
    // Map the `dailyTransactionStats` object to match the columns
    const values = DAILY_TRANSACTION_STATS_COLUMNS.map((column) => dailyTransactionStats[column])

    const sql = `INSERT OR REPLACE INTO daily_transactions ${fields} VALUES ${placeholders}`
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
    const fields = `(${DAILY_TRANSACTION_STATS_COLUMNS.join(', ')})`
    // Create placeholders for one row
    const placeholders = `(${DAILY_TRANSACTION_STATS_COLUMNS.map(() => '?').join(', ')})`
    // Create multiple placeholder groups for bulk insert
    const allPlaceholders = Array(dailyTransactionsStats.length).fill(placeholders).join(', ')

    // Flatten the `dailyTransactionsStats` array into a single list of values
    const values = dailyTransactionsStats.flatMap((stat) =>
      DAILY_TRANSACTION_STATS_COLUMNS.map((column) => stat[column])
    )

    const sql = `INSERT OR REPLACE INTO daily_transactions ${fields} VALUES ${allPlaceholders}`
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

export async function queryLatestDailyTransactionStats(
  count: number,
  txsWithFee = false,
  select: keyof DbDailyTransactionStats | (keyof DbDailyTransactionStats)[] | 'all' = 'all'
): Promise<DailyTransactionStats[]> {
  try {
    // Build SELECT clause
    let selectClause = '*'
    if (select !== 'all') {
      const fields = Array.isArray(select) ? select : [select]
      selectClause = fields.join(', ')
    }
    const sql = `SELECT ${selectClause} FROM daily_transactions ORDER BY dateStartTime DESC ${
      count ? 'LIMIT ' + count : ''
    }`
    const dailyTransactionsStats: DbDailyTransactionStats[] = await db.all(dailyTransactionStatsDatabase, sql)
    if (config.verbose) console.log('dailyTransactionStats count', dailyTransactionsStats)

    // Only parse JSON fields if they were selected
    const shouldParse = select === 'all' ||
      (Array.isArray(select) && (select.includes('txsByType') || select.includes('txsWithFeeByType'))) ||
      select === 'txsByType' || select === 'txsWithFeeByType'

    if (shouldParse) {
      return parseDailyTransactionStats(dailyTransactionsStats, txsWithFee)
    }

    // Return raw results without parsing if JSON fields not selected
    return dailyTransactionsStats as unknown as DailyTransactionStats[]
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

export function parseDailyTransactionStats(
  stats: DbDailyTransactionStats[],
  txsWithFee = false
): DailyTransactionStats[] {
  if (!stats || !stats.length) return []
  return stats.map((stat) => {
    const txsByType = txsWithFee
      ? JSON.parse(stat.txsWithFeeByType)
      : (JSON.parse(stat.txsByType) as BaseTxStats)
    // Ensure all required fields from BaseTxStats and DailyTransactionStats (except txsByType, txsWithFeeByType) are present
    return {
      dateStartTime: stat.dateStartTime,
      totalTxs: stat.totalTxs,
      totalUserTxs: stat.totalUserTxs,
      ...txsByType,
    } as DailyTransactionStats
  })
}

export async function queryTransactionStats(query = { userTxs: false }): Promise<{
  totalTransactions: number
  newTransactions: number
  totalTransactionsChange: number
  newTransactionsChange: number
}> {
  try {
    const { userTxs } = query
    // Get sum of all transactions from daily_transactions table
    const totalTxs = userTxs ? 'totalUserTxs' : 'totalTxs'
    const totalSql = `SELECT SUM(${totalTxs}) as totalTransactions FROM daily_transactions`
    const totalResult: { totalTransactions: number } = await db.get(dailyTransactionStatsDatabase, totalSql)

    // Get the totalTxs from the latest entry (most recent entry by dateStartTime)
    const latestTxs = userTxs ? 'totalUserTxs' : 'totalTxs'
    const latestSql = `SELECT ${latestTxs} as newTransactions FROM daily_transactions ORDER BY dateStartTime DESC LIMIT 1`
    const latestResult: { newTransactions: number } = await db.get(dailyTransactionStatsDatabase, latestSql)

    // Calculate percentage changes
    const totalTransactionsChange = await calculateTotalTransactionsChange(query.userTxs)
    const newTransactionsChange = await calculateNewTransactionsChange(query.userTxs)

    return {
      totalTransactions: totalResult?.totalTransactions || 0,
      newTransactions: latestResult?.newTransactions || 0,
      totalTransactionsChange,
      newTransactionsChange,
    }
  } catch (e) {
    console.log(e)
    return {
      totalTransactions: 0,
      newTransactions: 0,
      totalTransactionsChange: 0,
      newTransactionsChange: 0,
    }
  }
}

async function calculateTotalTransactionsChange(userTxs = false): Promise<number> {
  try {
    // Get total transactions for the last 7 days and previous 7 days to compare
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    const fourteenDaysAgo = Date.now() - 14 * 24 * 60 * 60 * 1000

    const txsColumn = userTxs ? 'totalUserTxs' : 'totalTxs'
    const last7DaysSql = `SELECT SUM(${txsColumn}) as total FROM daily_transactions WHERE dateStartTime >= ?`
    const previous7DaysSql = `SELECT SUM(${txsColumn}) as total FROM daily_transactions WHERE dateStartTime >= ? AND dateStartTime < ?`

    const last7DaysResult: { total: number } = await db.get(dailyTransactionStatsDatabase, last7DaysSql, [
      sevenDaysAgo,
    ])
    const previous7DaysResult: { total: number } = await db.get(
      dailyTransactionStatsDatabase,
      previous7DaysSql,
      [fourteenDaysAgo, sevenDaysAgo]
    )

    const current = last7DaysResult?.total || 0
    const previous = previous7DaysResult?.total || 0

    if (previous === 0) return current > 0 ? 100 : 0
    return ((current - previous) / previous) * 100
  } catch (e) {
    console.log('Error calculating total transactions change:', e)
    return 0
  }
}

async function calculateNewTransactionsChange(userTxs = false): Promise<number> {
  try {
    // Compare latest day's totalTxs with the previous day
    const txsColumn = userTxs ? 'totalUserTxs' : 'totalTxs'
    const latestTwoDaysSql = `SELECT ${txsColumn} as txs FROM daily_transactions ORDER BY dateStartTime DESC LIMIT 2`
    const results: { txs: number }[] = await db.all(dailyTransactionStatsDatabase, latestTwoDaysSql)

    if (results.length < 2) return 0

    const current = results[0]?.txs || 0
    const previous = results[1]?.txs || 0

    if (previous === 0) return current > 0 ? 100 : 0
    return ((current - previous) / previous) * 100
  } catch (e) {
    console.log('Error calculating new transactions change:', e)
    return 0
  }
}
