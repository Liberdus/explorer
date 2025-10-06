/* eslint-disable no-empty */
import { config } from '../config'
import * as db from '../storage/sqlite3storage'
import { dailyCoinStatsDatabase } from '.'

export interface DailyCoinStats {
  dateStartTime: number
  mintedCoin: number
  transactionFee: number
  networkFee: number // Additional other fees not included in transactionFee (e.g. network toll tax )
  stakeAmount: number
  unStakeAmount: number
  rewardAmountRealized: number // Node rewards that have been collected by the nominator ( withdraw_stake tx)
  rewardAmountUnrealized: number // Node rewards that have been accumulated, but yet to be collected by the nominator ( claim_reward tx)
  penaltyAmount: number
}

export interface DailyCoinStatsWithSupply extends DailyCoinStats {
  totalSupply: number
  totalStake: number
}

export interface DailyCoinStatsWithPrice extends DailyCoinStats {
  stabilityFactor: number
}

export type DbDailyCoinStats = DailyCoinStats

export async function insertDailyCoinStats(dailyCoinStats: DbDailyCoinStats): Promise<void> {
  try {
    const fields = Object.keys(dailyCoinStats).join(', ')
    const placeholders = Object.keys(dailyCoinStats).fill('?').join(', ')
    const values = db.extractValues(dailyCoinStats)
    const sql = 'INSERT OR REPLACE INTO daily_coin_stats (' + fields + ') VALUES (' + placeholders + ')'
    await db.run(dailyCoinStatsDatabase, sql, values)
    console.log('Successfully inserted DailyCoinStats', dailyCoinStats.dateStartTime)
  } catch (e) {
    console.log(e)
    console.log(
      'Unable to insert dailyCoinStats or it is already stored in to database',
      dailyCoinStats.dateStartTime
    )
  }
}

export async function bulkInsertCoinStats(dailyCoinStats: DbDailyCoinStats[]): Promise<void> {
  try {
    const fields = Object.keys(dailyCoinStats[0]).join(', ')
    const placeholders = Object.keys(dailyCoinStats[0]).fill('?').join(', ')
    const values = db.extractValuesFromArray(dailyCoinStats)
    let sql = 'INSERT OR REPLACE INTO daily_coin_stats (' + fields + ') VALUES (' + placeholders + ')'
    for (let i = 1; i < dailyCoinStats.length; i++) {
      sql = sql + ', (' + placeholders + ')'
    }
    await db.run(dailyCoinStatsDatabase, sql, values)
    const addedStats = dailyCoinStats.map((v) => v)
    console.log('Successfully bulk inserted DailyCoinStats', dailyCoinStats.length, 'for entries', addedStats)
  } catch (e) {
    console.log(e)
    console.log('Unable to bulk insert dailyCoinStats', dailyCoinStats.length)
  }
}

export async function queryLatestDailyCoinStats(count: number): Promise<DailyCoinStats[]> {
  try {
    const sql = `SELECT * FROM daily_coin_stats ORDER BY dateStartTime DESC ${count ? 'LIMIT ' + count : ''}`
    const dailyCoinStats: DbDailyCoinStats[] = await db.all(dailyCoinStatsDatabase, sql)
    if (config.verbose) console.log('dailyCoinStats count', dailyCoinStats)
    return dailyCoinStats
  } catch (e) {
    console.log(e)
    return []
  }
}

export async function queryAggregatedDailyCoinStats(): Promise<{
  transactionFee: number
  networkFee: number
  stakeAmount: number
  unStakeAmount: number
  penaltyAmount: number
  rewardAmountRealized: number
  rewardAmountUnrealized: number
  mintedCoin: number
}> {
  try {
    const sql = `SELECT
      IFNULL(sum(mintedCoin), 0) as mintedCoin,
      IFNULL(sum(transactionFee), 0) as transactionFee,
      IFNULL(sum(networkFee), 0) as networkFee,
      IFNULL(sum(stakeAmount), 0) as stakeAmount,
      IFNULL(sum(unStakeAmount), 0) as unStakeAmount,
      IFNULL(sum(rewardAmountRealized), 0) as rewardAmountRealized,
      IFNULL(sum(rewardAmountUnrealized), 0) as rewardAmountUnrealized,
      IFNULL(sum(penaltyAmount), 0) as penaltyAmount
      FROM daily_coin_stats`
    const dailyCoinStats: {
      transactionFee: number
      networkFee: number
      stakeAmount: number
      unStakeAmount: number
      penaltyAmount: number
      rewardAmountRealized: number
      rewardAmountUnrealized: number
      mintedCoin: number
    } = await db.get(dailyCoinStatsDatabase, sql)
    if (config.verbose) console.log('aggregated daily coin stats', dailyCoinStats)
    return dailyCoinStats
  } catch (e) {
    console.log(e)
    return {
      transactionFee: 0,
      networkFee: 0,
      stakeAmount: 0,
      unStakeAmount: 0,
      penaltyAmount: 0,
      rewardAmountRealized: 0,
      rewardAmountUnrealized: 0,
      mintedCoin: 0,
    }
  }
}

export function calculateTotalSupplyChange(
  mintedCoin: number,
  rewardAmountRealized: number,
  transactionFee: number,
  burntFee: number,
  penaltyAmount: number
): number {
  return mintedCoin + rewardAmountRealized + transactionFee - burntFee - penaltyAmount
}

export function calculateTotalStakeChange(
  stakeAmount: number,
  unStakeAmount: number,
  penaltyAmount: number
): number {
  return stakeAmount - unStakeAmount - penaltyAmount
}
