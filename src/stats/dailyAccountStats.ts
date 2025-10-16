/* eslint-disable no-empty */
import { config } from '../config'
import * as db from '../storage/sqlite3storage'
import { dailyAccountStatsDatabase } from '.'

export interface BaseDailyAccountStats {
  dateStartTime: number
  newAccounts: number // new accounts created in the 24 hour period
  newUserAccounts: number // new user accounts created in the 24 hour period
  activeAccounts: number // user accounts that make at least one transaction with txFee > 0 in the 24 hour period
  // activeBalanceAccounts: number // user accounts with balance > 0
  // newActiveBalanceAccounts: number // user accounts that were involved in transactions in the last 24 hours and have latest balance > 0
}

export interface DailyAccountStatsSummary extends Omit<BaseDailyAccountStats, 'dateStartTime'> {
  totalAccounts: number
  totalUserAccounts: number // cumulative user accounts created
  newAccountsChange: number // percentage change in new accounts (day-to-day comparison)
  newUserAccountsChange: number // percentage change in new user accounts (day-to-day comparison)
  activeAccountsChange: number // percentage change in active accounts (day-to-day comparison)
  totalAccountsChange: number // percentage change: today's new accounts / yesterday's cumulative total * 100
  totalUserAccountsChange: number // percentage change: today's new user accounts / yesterday's cumulative total * 100
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

export async function queryDailyAccountStatsSummary(): Promise<DailyAccountStatsSummary | []> {
  try {
    const totalsSql = `
      SELECT
        SUM(newAccounts) as totalAccounts,
        SUM(newUserAccounts) as totalUserAccounts
      FROM daily_accounts
    `
    const totalsResult: { totalAccounts: number; totalUserAccounts: number } = await db.get(
      dailyAccountStatsDatabase,
      totalsSql
    )

    const latestDailyAccountStats = await queryLatestDailyAccountStats(1)
    const latestResult = latestDailyAccountStats[0]

    const totalAccountsChange = await calculateTotalMetricChange('newAccounts')
    const totalUserAccountsChange = await calculateTotalMetricChange('newUserAccounts')
    const newAccountsChange = await calculateMetricChange('newAccounts')
    const newUserAccountsChange = await calculateMetricChange('newUserAccounts')
    const activeAccountsChange = await calculateMetricChange('activeAccounts')

    return {
      totalAccounts: totalsResult?.totalAccounts || 0,
      newAccounts: latestResult?.newAccounts || 0,
      totalUserAccounts: totalsResult?.totalUserAccounts || 0,
      newUserAccounts: latestResult?.newUserAccounts || 0,
      totalAccountsChange,
      newAccountsChange,
      totalUserAccountsChange,
      newUserAccountsChange,
      activeAccounts: latestResult?.activeAccounts || 0,
      activeAccountsChange,
    }
  } catch (e) {
    console.log(e)
    return []
  }
}

/**
 * Calculates the percentage change between the cumulative total of a metric on the most recent day
 * and the cumulative total up to the previous day. This is useful for "total" style metrics that grow over time.
 */
async function calculateTotalMetricChange(fieldName: keyof DailyAccountStats): Promise<number> {
  try {
    const sql = `
      SELECT ${fieldName} as currentValue,
             (
               SELECT COALESCE(SUM(${fieldName}), 0)
               FROM daily_accounts
               WHERE dateStartTime < d.dateStartTime
             ) as previousTotal
      FROM daily_accounts d
      ORDER BY dateStartTime DESC
      LIMIT 1
    `
    const result: { currentValue: number; previousTotal: number } = await db.get(
      dailyAccountStatsDatabase,
      sql
    )

    if (!result) return 0

    const currentValue = result.currentValue || 0
    const previousTotal = result.previousTotal || 0

    if (previousTotal === 0) return currentValue > 0 ? 100 : 0
    return (currentValue / previousTotal) * 100
  } catch (e) {
    console.log(`Error calculating total change for ${fieldName}:`, e)
    return 0
  }
}

/**
 * Calculates the day-over-day percentage change for a metric by comparing the latest value
 * with the previous day's value. This is useful for daily counts or rates.
 */
async function calculateMetricChange(fieldName: keyof DailyAccountStats): Promise<number> {
  try {
    const latestTwoDaysSql = `SELECT ${fieldName} as value FROM daily_accounts ORDER BY dateStartTime DESC LIMIT 2`
    const results: { value: number }[] = await db.all(dailyAccountStatsDatabase, latestTwoDaysSql)

    if (results.length < 2) return 0

    const current = results[0]?.value || 0
    const previous = results[1]?.value || 0

    if (previous === 0) return current > 0 ? 100 : 0
    return ((current - previous) / previous) * 100
  } catch (e) {
    console.log(`Error calculating change for ${fieldName}:`, e)
    return 0
  }
}
