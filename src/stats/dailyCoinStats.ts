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

export type DailyCoinStatsSummary = Omit<DailyCoinStats, 'dateStartTime'> &
  DailyCoinStatsSummaryDerivedValues &
  TotalCoinStats

export interface DailyCoinStatsSummaryDerivedValues {
  newBurntFee: number // total burnt fee in the last 24 hours ( transaction fee + network fee + penalty amount )
  newNetworkExpense: number // total network expense ( minted coin + realized node rewards )  in the last 24 hours
  newSupply: number // total LIB supply created in the last 24 hours
}

export interface TotalCoinStats {
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

export async function queryDailyCoinStatsSummary(): Promise<DailyCoinStatsSummary | undefined> {
  try {
    const last2DaysResult = await queryLatestDailyCoinStats(2)
    const dailyCoinStat = last2DaysResult[0]

    if (!dailyCoinStat) {
      return
    }

    const aggregatedCoinStats: DailyCoinStats = await queryAggregatedDailyCoinStats()

    const totalSupply =
      config.genesisLIBSupply +
      calculateTotalSupplyChange(
        aggregatedCoinStats.mintedCoin,
        aggregatedCoinStats.rewardAmountRealized,
        aggregatedCoinStats.transactionFee,
        aggregatedCoinStats.networkFee,
        aggregatedCoinStats.penaltyAmount
      )

    const totalStake = calculateTotalStakeChange(
      aggregatedCoinStats.stakeAmount,
      aggregatedCoinStats.unStakeAmount,
      aggregatedCoinStats.penaltyAmount
    )
    const newBurntFee = dailyCoinStat.transactionFee + dailyCoinStat.networkFee + dailyCoinStat.penaltyAmount

    const newNetworkExpense = dailyCoinStat.mintedCoin + dailyCoinStat.rewardAmountRealized

    const newSupply =
      dailyCoinStat.mintedCoin +
      dailyCoinStat.rewardAmountRealized -
      dailyCoinStat.transactionFee -
      dailyCoinStat.networkFee -
      dailyCoinStat.penaltyAmount

    return {
      ...dailyCoinStat,
      newBurntFee,
      newNetworkExpense,
      newSupply,
      totalSupply,
      totalStake,
    }
  } catch (e) {
    console.log(e)
    return
  }
}

export async function queryAggregatedDailyCoinStats(): Promise<DailyCoinStats | undefined> {
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
    const dailyCoinStats: DailyCoinStats = await db.get(dailyCoinStatsDatabase, sql)
    if (config.verbose) console.log('aggregated daily coin stats', dailyCoinStats)
    return dailyCoinStats
  } catch (e) {
    console.log(e)
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
