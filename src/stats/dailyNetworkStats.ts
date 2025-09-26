/* eslint-disable no-empty */
import { config } from '../config'
import * as db from '../storage/sqlite3storage'
import { dailyNetworkStatsDatabase } from '.'

export interface BaseDailyNetworkStats {
  dateStartTime: number
  transactionFeeUsd: string
  nodeRewardAmountUsd: string
  stakeRequiredUsd: string
  activeNodes: number
}

export type DailyNetworkStats = BaseDailyNetworkStats

export type DbDailyNetworkStats = BaseDailyNetworkStats

export async function insertDailyNetworkStats(dailyNetworkStats: DbDailyNetworkStats): Promise<void> {
  try {
    const fields = Object.keys(dailyNetworkStats).join(', ')
    const placeholders = Object.keys(dailyNetworkStats).fill('?').join(', ')
    const values = db.extractValues(dailyNetworkStats)
    const sql = 'INSERT OR REPLACE INTO daily_network (' + fields + ') VALUES (' + placeholders + ')'
    await db.run(dailyNetworkStatsDatabase, sql, values)
    console.log('Successfully inserted DailyNetworkStats', dailyNetworkStats.dateStartTime)
  } catch (e) {
    console.log(e)
    console.log(
      'Unable to insert dailyNetworkStats or it is already stored in to database',
      dailyNetworkStats.dateStartTime
    )
  }
}

export async function bulkInsertNetworkStats(dailyNetworkStats: DbDailyNetworkStats[]): Promise<void> {
  try {
    const fields = Object.keys(dailyNetworkStats[0]).join(', ')
    const placeholders = Object.keys(dailyNetworkStats[0]).fill('?').join(', ')
    const values = db.extractValuesFromArray(dailyNetworkStats)
    let sql = 'INSERT OR REPLACE INTO daily_network (' + fields + ') VALUES (' + placeholders + ')'
    for (let i = 1; i < dailyNetworkStats.length; i++) {
      sql = sql + ', (' + placeholders + ')'
    }
    await db.run(dailyNetworkStatsDatabase, sql, values)
    const addedStats = dailyNetworkStats.map((v) => v)
    console.log(
      'Successfully bulk inserted DailyNetworkStats',
      dailyNetworkStats.length,
      'for entries',
      addedStats
    )
  } catch (e) {
    console.log(e)
    console.log('Unable to bulk insert dailyNetworkStats', dailyNetworkStats.length)
  }
}

export async function queryLatestDailyNetworkStats(count: number): Promise<DailyNetworkStats[]> {
  try {
    const sql = `SELECT * FROM daily_network ORDER BY dateStartTime DESC ${count ? 'LIMIT ' + count : ''}`
    const dailyNetworkStats: DbDailyNetworkStats[] = await db.all(dailyNetworkStatsDatabase, sql)
    if (config.verbose) console.log('dailyNetworkStats count', dailyNetworkStats)
    return dailyNetworkStats
  } catch (e) {
    console.log(e)
    return []
  }
}

export async function queryDailyNetworkStatsBetween(
  startTimestamp: number,
  endTimestamp: number
): Promise<DailyNetworkStats[]> {
  try {
    const sql = `SELECT * FROM daily_network WHERE dateStartTime BETWEEN ? AND ? ORDER BY dateStartTime ASC`
    const dailyNetworkStats: DbDailyNetworkStats[] = await db.all(dailyNetworkStatsDatabase, sql, [
      startTimestamp,
      endTimestamp,
    ])
    if (config.verbose) console.log('dailyNetworkStats between', dailyNetworkStats)
    return dailyNetworkStats
  } catch (e) {
    console.log(e)
    return []
  }
}

export async function queryNetworkStats(): Promise<{
  transactionFeeUsd: string
  nodeRewardAmountUsd: string
  stakeRequiredUsd: string
  activeNodes: number
}> {
  try {
    // Get the latest entry (most recent entry by dateStartTime)
    const latestSql = `SELECT * FROM daily_network ORDER BY dateStartTime DESC LIMIT 1`
    const latestResult: DbDailyNetworkStats = await db.get(dailyNetworkStatsDatabase, latestSql)

    return {
      transactionFeeUsd: latestResult?.transactionFeeUsd || '0.01',
      nodeRewardAmountUsd: latestResult?.nodeRewardAmountUsd || '1.0',
      stakeRequiredUsd: latestResult?.stakeRequiredUsd || '10.0',
      activeNodes: latestResult?.activeNodes || 0,
    }
  } catch (e) {
    console.log(e)
    return {
      transactionFeeUsd: '0.01',
      nodeRewardAmountUsd: '1.0',
      stakeRequiredUsd: '10.0',
      activeNodes: 0,
    }
  }
}