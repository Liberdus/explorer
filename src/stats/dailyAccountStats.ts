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

export type DailyAccountStatsSummary = BaseDailyAccountStats &
  TotalAccountStats &
  TotalAccountMetricChanges &
  DailyAccountMetricChanges

export interface TotalAccountStats {
  totalAccounts: number
  totalUserAccounts: number
}

export interface TotalAccountMetricChanges {
  totalAccountsChange: number // percentage change: today's new accounts / yesterday's cumulative total * 100
  totalUserAccountsChange: number // percentage change: today's new user accounts / yesterday's cumulative total * 100
}

export interface DailyAccountMetricChanges {
  newAccountsChange: number // percentage change in new accounts (day-to-day comparison)
  newUserAccountsChange: number // percentage change in new user accounts (day-to-day comparison)
  activeAccountsChange: number // percentage change in active accounts (day-to-day comparison)
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
    const last2DaysResult = await queryLatestDailyAccountStats(2)
    const dailyAccountStat = last2DaysResult[0]

    if (!dailyAccountStat) {
      return []
    }

    const totalsResult: TotalAccountStats = await queryAggregatedDailyAccountStats()

    let totalChanges: TotalAccountMetricChanges
    let metricChanges: DailyAccountMetricChanges

    if (last2DaysResult.length === 2 && totalsResult) {
      totalChanges = await calculateTotalMetricChange(totalsResult, dailyAccountStat)
      metricChanges = await calculateMetricChange(last2DaysResult)
    }

    return {
      dateStartTime: dailyAccountStat.dateStartTime,
      totalAccounts: totalsResult?.totalAccounts || 0,
      newAccounts: dailyAccountStat?.newAccounts || 0,
      totalUserAccounts: totalsResult?.totalUserAccounts || 0,
      newUserAccounts: dailyAccountStat?.newUserAccounts || 0,
      totalAccountsChange: totalChanges.totalAccountsChange || 0,
      newAccountsChange: metricChanges.newAccountsChange || 0,
      totalUserAccountsChange: totalChanges.totalUserAccountsChange || 0,
      newUserAccountsChange: metricChanges.newUserAccountsChange || 0,
      activeAccounts: dailyAccountStat?.activeAccounts || 0,
      activeAccountsChange: metricChanges.activeAccountsChange || 0,
    }
  } catch (e) {
    console.log(e)
    return []
  }
}

/**
 * Calculates the percentage change between the cumulative total of metrics on the most recent day
 * and the cumulative total up to the previous day. This is useful for "total" style metrics that grow over time.
 */
async function calculateTotalMetricChange(
  totalAccountStats: TotalAccountStats,
  latestDailyAccountStats: DbDailyAccountStats
): Promise<TotalAccountMetricChanges> {
  const res = {
    totalAccountsChange: 0,
    totalUserAccountsChange: 0,
  }
  try {
    const { newAccounts, newUserAccounts } = latestDailyAccountStats

    const previousNewAccountsTotal = totalAccountStats.totalAccounts - newAccounts || 0
    const previousNewUserAccountsTotal = totalAccountStats.totalUserAccounts - newUserAccounts || 0

    const totalAccountsChange =
      previousNewAccountsTotal === 0
        ? newAccounts > 0
          ? 100
          : 0
        : (newAccounts / previousNewAccountsTotal) * 100

    const totalUserAccountsChange =
      previousNewUserAccountsTotal === 0
        ? newUserAccounts > 0
          ? 100
          : 0
        : (newUserAccounts / previousNewUserAccountsTotal) * 100

    return {
      totalAccountsChange,
      totalUserAccountsChange,
    }
  } catch (e) {
    console.log('Error calculating total change metrics:', e)
    return res
  }
}

/**
 * Calculates the day-over-day percentage change for metrics by comparing the latest value
 * with the previous day's value. This is useful for daily counts or rates.
 */
async function calculateMetricChange(
  dailyAccountsStats: DailyAccountStats[]
): Promise<DailyAccountMetricChanges> {
  const res = {
    newAccountsChange: 0,
    newUserAccountsChange: 0,
    activeAccountsChange: 0,
  }
  try {
    const [current, previous] = dailyAccountsStats
    const calculatePercentageChange = (currentValue: number, previousValue: number): number => {
      if (previousValue === 0) return currentValue > 0 ? 100 : 0
      return ((currentValue - previousValue) / previousValue) * 100
    }

    const newAccountsChange = calculatePercentageChange(current.newAccounts ?? 0, previous.newAccounts ?? 0)
    const newUserAccountsChange = calculatePercentageChange(
      current.newUserAccounts ?? 0,
      previous.newUserAccounts ?? 0
    )
    const activeAccountsChange = calculatePercentageChange(
      current.activeAccounts ?? 0,
      previous.activeAccounts ?? 0
    )

    return {
      newAccountsChange,
      newUserAccountsChange,
      activeAccountsChange,
    }
  } catch (e) {
    console.log('Error calculating daily change metrics:', e)
    return res
  }
}

export async function queryAggregatedDailyAccountStats(): Promise<TotalAccountStats | undefined> {
  try {
    const sql = `
      SELECT
        SUM(newAccounts) as totalAccounts,
        SUM(newUserAccounts) as totalUserAccounts
      FROM daily_accounts
    `
    const totalAccountStats: TotalAccountStats = await db.get(dailyAccountStatsDatabase, sql)
    if (config.verbose) console.log('aggregated daily account stats', totalAccountStats)
    return totalAccountStats
  } catch (e) {
    console.log(e)
  }
}
