/* eslint-disable no-empty */
import { config } from '../config'
import * as db from '../storage/sqlite3storage'
import { dailyAccountStatsDatabase } from '.'

export interface BaseDailyAccountStats {
  dateStartTime: number
  newAccounts: number
  activeAccounts: number
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
