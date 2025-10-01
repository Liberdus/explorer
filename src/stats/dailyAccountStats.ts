/* eslint-disable no-empty */
import { config } from '../config'
import * as db from '../storage/sqlite3storage'
import { dailyAccountStatsDatabase } from '.'

export interface BaseDailyAccountStats {
  dateStartTime: number
  newAccounts: number
  newUserAccounts: number
  activeAccounts: number // user accounts that make at least one transaction with txFee > 0
  activeBalanceAccounts: number // user accounts with balance > 0
}

export type DailyAccountStats = BaseDailyAccountStats

export type DbDailyAccountStats = BaseDailyAccountStats

export async function insertDailyAccountStats(dailyAccountStats: DbDailyAccountStats): Promise<void> {
  try {
    const fields = Object.keys(dailyAccountStats).join(', ')
    const placeholders = Object.keys(dailyAccountStats).fill('?').join(', ')
    const values = db.extractValues(dailyAccountStats)
    const sql = 'INSERT OR REPLACE INTO daily_accounts (' + fields + ') VALUES (' + placeholders + ')'
    await db.run(dailyAccountStatsDatabase, sql, values)
    console.log('Successfully inserted DailyAccountStats', dailyAccountStats.dateStartTime)
  } catch (e) {
    console.log(e)
    console.log(
      'Unable to insert dailyAccountStats or it is already stored in to database',
      dailyAccountStats.dateStartTime
    )
  }
}

export async function bulkInsertAccountsStats(dailyAccountsStats: DbDailyAccountStats[]): Promise<void> {
  try {
    const fields = Object.keys(dailyAccountsStats[0]).join(', ')
    const placeholders = Object.keys(dailyAccountsStats[0]).fill('?').join(', ')
    const values = db.extractValuesFromArray(dailyAccountsStats)
    let sql = 'INSERT OR REPLACE INTO daily_accounts (' + fields + ') VALUES (' + placeholders + ')'
    for (let i = 1; i < dailyAccountsStats.length; i++) {
      sql = sql + ', (' + placeholders + ')'
    }
    await db.run(dailyAccountStatsDatabase, sql, values)
    const addedCycles = dailyAccountsStats.map((v) => v)
    console.log(
      'Successfully bulk inserted DailyAccountStats',
      dailyAccountsStats.length,
      'for cycles',
      addedCycles
    )
  } catch (e) {
    console.log(e)
    console.log('Unable to bulk insert dailyAccountStats', dailyAccountsStats.length)
  }
}

export async function queryLatestDailyAccountStats(count: number): Promise<DailyAccountStats[]> {
  try {
    const sql = `SELECT * FROM daily_accounts ORDER BY dateStartTime DESC ${count ? 'LIMIT ' + count : ''}`
    const dailyAccountsStats: DbDailyAccountStats[] = await db.all(dailyAccountStatsDatabase, sql)
    if (config.verbose) console.log('dailyAccountStats count', dailyAccountsStats)
    return dailyAccountsStats
  } catch (e) {
    console.log(e)
    return []
  }
}

export async function queryDailyAccountStatsBetween(
  startTimestamp: number,
  endTimestamp: number
): Promise<DailyAccountStats[]> {
  try {
    const sql = `SELECT * FROM daily_accounts WHERE dateStartTime BETWEEN ? AND ? ORDER BY dateStartTime ASC`
    const dailyAccountsStats: DbDailyAccountStats[] = await db.all(dailyAccountStatsDatabase, sql, [
      startTimestamp,
      endTimestamp,
    ])
    if (config.verbose) console.log('dailyAccountStats between', dailyAccountsStats)
    return dailyAccountsStats
  } catch (e) {
    console.log(e)
  }
}

export async function queryAccountStats(): Promise<{
  totalAccounts: number
  totalNewAccounts: number
  totalAccountsChange: number
  totalNewAccountsChange: number
}> {
  try {
    // Get sum of all newAccounts from daily_accounts table
    const totalSql = 'SELECT SUM(newAccounts) as totalAccounts FROM daily_accounts'
    const totalResult: { totalAccounts: number } = await db.get(dailyAccountStatsDatabase, totalSql)

    // Get the newAccounts from the latest entry (most recent entry by dateStartTime)
    const latestSql =
      'SELECT newAccounts as totalNewAccounts FROM daily_accounts ORDER BY dateStartTime DESC LIMIT 1'
    const latestResult: { totalNewAccounts: number } = await db.get(dailyAccountStatsDatabase, latestSql)

    // Calculate percentage changes
    const totalAccountsChange = await calculateTotalAccountsChange()
    const totalNewAccountsChange = await calculateNewAccountsChange()

    return {
      totalAccounts: totalResult?.totalAccounts || 0,
      totalNewAccounts: latestResult?.totalNewAccounts || 0,
      totalAccountsChange,
      totalNewAccountsChange,
    }
  } catch (e) {
    console.log(e)
    return {
      totalAccounts: 0,
      totalNewAccounts: 0,
      totalAccountsChange: 0,
      totalNewAccountsChange: 0,
    }
  }
}

async function calculateTotalAccountsChange(): Promise<number> {
  try {
    // // Get total accounts for the last 7 days and previous 7 days to compare
    // const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000)
    // const fourteenDaysAgo = Date.now() - (14 * 24 * 60 * 60 * 1000)

    // Get total accounts for the last 1 days and previous 1 days to compare
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    const fourteenDaysAgo = Date.now() - 14 * 24 * 60 * 60 * 1000

    const last7DaysSql = 'SELECT SUM(newAccounts) as total FROM daily_accounts WHERE dateStartTime >= ?'
    const previous7DaysSql =
      'SELECT SUM(newAccounts) as total FROM daily_accounts WHERE dateStartTime >= ? AND dateStartTime < ?'

    const last7DaysResult: { total: number } = await db.get(dailyAccountStatsDatabase, last7DaysSql, [
      sevenDaysAgo,
    ])
    const previous7DaysResult: { total: number } = await db.get(dailyAccountStatsDatabase, previous7DaysSql, [
      fourteenDaysAgo,
      sevenDaysAgo,
    ])

    const current = last7DaysResult?.total || 0
    const previous = previous7DaysResult?.total || 0

    if (previous === 0) return current > 0 ? 100 : 0
    return ((current - previous) / previous) * 100
  } catch (e) {
    console.log('Error calculating total accounts change:', e)
    return 0
  }
}

async function calculateNewAccountsChange(): Promise<number> {
  try {
    // Compare latest day's newAccounts with the previous day
    const latestTwoDaysSql = 'SELECT newAccounts FROM daily_accounts ORDER BY dateStartTime DESC LIMIT 2'
    const results: { newAccounts: number }[] = await db.all(dailyAccountStatsDatabase, latestTwoDaysSql)

    if (results.length < 2) return 0

    const current = results[0]?.newAccounts || 0
    const previous = results[1]?.newAccounts || 0

    if (previous === 0) return current > 0 ? 100 : 0
    return ((current - previous) / previous) * 100
  } catch (e) {
    console.log('Error calculating new accounts change:', e)
    return 0
  }
}
