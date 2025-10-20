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

export type DailyCoinStatsSummary = DailyCoinStats &
  TotalCoinStats &
  DailyCoinDerivedMetrics &
  TotalCoinMetricChanges &
  DailyCoinMetricChanges

export interface DailyCoinDerivedMetrics {
  newBurntFee: number // total burnt fee in the last 24 hours ( transaction fee + network fee + penalty amount )
  newNetworkExpense: number // total network expense ( minted coin + realized node rewards )  in the last 24 hours
  newSupply: number // total LIB supply created in the last 24 hours
}

export interface TotalCoinStats {
  totalSupply: number
  totalStake: number
}

export interface AggregatedDailyCoinStats {
  totalMintedCoin: number
  totalTransactionFee: number
  totalNetworkFee: number
  totalStakeAmount: number
  totalUnStakeAmount: number
  totalRewardAmountRealized: number
  totalRewardAmountUnrealized: number
  totalPenaltyAmount: number
}

export interface TotalCoinMetricChanges {
  totalSupplyChange: number // percentage change: today's supply change / yesterday's cumulative total * 100
  totalStakeChange: number // percentage change: today's stake change / yesterday's cumulative total * 100
}

export interface DailyCoinMetricChanges {
  transactionFeeChange: number // percentage change in transaction fee (day-to-day comparison)
  newBurntFeeChange: number // percentage change in burnt fee (day-to-day comparison)
  newNetworkExpenseChange: number // percentage change in network expense (day-to-day comparison)
  newSupplyChange: number // percentage change in supply (day-to-day comparison)
}

export interface DailyCoinStatsWithPrice extends DailyCoinStats {
  stabilityFactorStr: string
}

export type DbDailyCoinStats = DailyCoinStats

const DAILY_COIN_STATS_COLUMNS: readonly (keyof DailyCoinStats)[] = [
  'dateStartTime',
  'mintedCoin',
  'transactionFee',
  'networkFee',
  'stakeAmount',
  'unStakeAmount',
  'rewardAmountRealized',
  'rewardAmountUnrealized',
  'penaltyAmount',
] as const

export async function insertDailyCoinStats(dailyCoinStats: DbDailyCoinStats): Promise<void> {
  try {
    const fields = `(${DAILY_COIN_STATS_COLUMNS.join(', ')})`
    // Create placeholders for one row
    const placeholders = `(${DAILY_COIN_STATS_COLUMNS.map(() => '?').join(', ')})`
    // Map the `dailyCoinStats` object to match the columns
    const values = DAILY_COIN_STATS_COLUMNS.map((column) => dailyCoinStats[column])

    const sql = `INSERT OR REPLACE INTO daily_coin_stats ${fields} VALUES ${placeholders}`
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
    const fields = `(${DAILY_COIN_STATS_COLUMNS.join(', ')})`
    // Create placeholders for one row
    const placeholders = `(${DAILY_COIN_STATS_COLUMNS.map(() => '?').join(', ')})`
    // Create multiple placeholder groups for bulk insert
    const allPlaceholders = Array(dailyCoinStats.length).fill(placeholders).join(', ')

    // Flatten the `dailyCoinStats` array into a single list of values
    const values = dailyCoinStats.flatMap((stat) => DAILY_COIN_STATS_COLUMNS.map((column) => stat[column]))

    const sql = `INSERT OR REPLACE INTO daily_coin_stats ${fields} VALUES ${allPlaceholders}`
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

    const aggregatedCoinStats: AggregatedDailyCoinStats = await queryAggregatedDailyCoinStats()

    const {
      totalMintedCoin,
      totalRewardAmountRealized,
      totalTransactionFee,
      totalNetworkFee,
      totalPenaltyAmount,
      totalStakeAmount,
      totalUnStakeAmount,
    } = aggregatedCoinStats

    const totalSupply =
      config.genesisLIBSupply +
      calculateTotalSupplyChange(
        totalMintedCoin,
        totalRewardAmountRealized,
        totalTransactionFee,
        totalNetworkFee,
        totalPenaltyAmount
      )

    const totalStake = calculateTotalStakeChange(totalStakeAmount, totalUnStakeAmount, totalPenaltyAmount)

    const {
      mintedCoin,
      transactionFee,
      networkFee,
      stakeAmount,
      unStakeAmount,
      rewardAmountRealized,
      penaltyAmount,
    } = dailyCoinStat

    const newBurntFee = calculateNewBurntFee(transactionFee, networkFee, penaltyAmount)

    const newNetworkExpense = calculateNewNetworkExpense(mintedCoin, rewardAmountRealized)

    const newSupply = calculateNewSupply(
      mintedCoin,
      rewardAmountRealized,
      transactionFee,
      networkFee,
      penaltyAmount
    )

    const newStake = calculateTotalStakeChange(stakeAmount, unStakeAmount, penaltyAmount)

    let totalChanges: TotalCoinMetricChanges = {
      totalSupplyChange: 0,
      totalStakeChange: 0,
    }
    let metricChanges: DailyCoinMetricChanges = {
      transactionFeeChange: 0,
      newBurntFeeChange: 0,
      newNetworkExpenseChange: 0,
      newSupplyChange: 0,
    }

    if (last2DaysResult.length === 2) {
      totalChanges = await calculateTotalCoinMetricChange(totalSupply, totalStake, newSupply, newStake)
      metricChanges = await calculateCoinMetricChange(last2DaysResult)
    }

    return {
      ...dailyCoinStat,
      newBurntFee,
      newNetworkExpense,
      newSupply,
      totalSupply,
      totalStake,
      ...totalChanges,
      ...metricChanges,
    }
  } catch (e) {
    console.log(e)
    return
  }
}

/**
 * Calculates the percentage change between the cumulative total of metrics on the most recent day
 * and the cumulative total up to the previous day. This is useful for "total" style metrics that grow over time.
 */
async function calculateTotalCoinMetricChange(
  totalSupply: number,
  totalStake: number,
  latestNewSupply: number,
  latestNewStake: number
): Promise<TotalCoinMetricChanges> {
  const res: TotalCoinMetricChanges = {
    totalSupplyChange: 0,
    totalStakeChange: 0,
  }
  try {
    const previousSupplyTotal = totalSupply - latestNewSupply || 0
    const previousStakeTotal = totalStake - latestNewStake || 0

    const totalSupplyChange =
      previousSupplyTotal === 0
        ? latestNewSupply > 0
          ? 100
          : latestNewSupply < 0
          ? -100
          : 0
        : (latestNewSupply / previousSupplyTotal) * 100

    const totalStakeChange =
      previousStakeTotal === 0
        ? latestNewStake > 0
          ? 100
          : latestNewStake < 0
          ? -100
          : 0
        : (latestNewStake / previousStakeTotal) * 100

    return {
      totalSupplyChange,
      totalStakeChange,
    }
  } catch (e) {
    console.log('Error calculating total coin change metrics:', e)
    return res
  }
}

/**
 * Calculates the day-over-day percentage change for metrics by comparing the latest value
 * with the previous day's value. This is useful for daily counts or rates.
 */
async function calculateCoinMetricChange(dailyCoinStats: DailyCoinStats[]): Promise<DailyCoinMetricChanges> {
  const res: DailyCoinMetricChanges = {
    transactionFeeChange: 0,
    newBurntFeeChange: 0,
    newNetworkExpenseChange: 0,
    newSupplyChange: 0,
  }
  try {
    const [current, previous] = dailyCoinStats
    const calculatePercentageChange = (currentValue: number, previousValue: number): number => {
      if (previousValue === 0) {
        if (currentValue > 0) return 100
        if (currentValue < 0) return -100
        return 0
      }
      return ((currentValue - previousValue) / Math.abs(previousValue)) * 100
    }

    // Calculate current day's derived values using helper functions
    const currentNewBurntFee = calculateNewBurntFee(
      current.transactionFee,
      current.networkFee,
      current.penaltyAmount
    )
    const currentNewNetworkExpense = calculateNewNetworkExpense(
      current.mintedCoin,
      current.rewardAmountRealized
    )
    const currentNewSupply = calculateNewSupply(
      current.mintedCoin,
      current.rewardAmountRealized,
      current.transactionFee,
      current.networkFee,
      current.penaltyAmount
    )

    // Calculate previous day's derived values using helper functions
    const previousNewBurntFee = calculateNewBurntFee(
      previous.transactionFee,
      previous.networkFee,
      previous.penaltyAmount
    )
    const previousNewNetworkExpense = calculateNewNetworkExpense(
      previous.mintedCoin,
      previous.rewardAmountRealized
    )
    const previousNewSupply = calculateNewSupply(
      previous.mintedCoin,
      previous.rewardAmountRealized,
      previous.transactionFee,
      previous.networkFee,
      previous.penaltyAmount
    )

    const transactionFeeChange = calculatePercentageChange(
      current.transactionFee ?? 0,
      previous.transactionFee ?? 0
    )
    const newBurntFeeChange = calculatePercentageChange(currentNewBurntFee ?? 0, previousNewBurntFee ?? 0)
    const newNetworkExpenseChange = calculatePercentageChange(
      currentNewNetworkExpense ?? 0,
      previousNewNetworkExpense ?? 0
    )
    const newSupplyChange = calculatePercentageChange(currentNewSupply ?? 0, previousNewSupply ?? 0)

    return {
      transactionFeeChange,
      newBurntFeeChange,
      newNetworkExpenseChange,
      newSupplyChange,
    }
  } catch (e) {
    console.log('Error calculating daily coin change metrics:', e)
    return res
  }
}

export async function queryAggregatedDailyCoinStats(): Promise<AggregatedDailyCoinStats | undefined> {
  try {
    const sql = `SELECT
      IFNULL(sum(mintedCoin), 0) as totalMintedCoin,
      IFNULL(sum(transactionFee), 0) as totalTransactionFee,
      IFNULL(sum(networkFee), 0) as totalNetworkFee,
      IFNULL(sum(stakeAmount), 0) as totalStakeAmount,
      IFNULL(sum(unStakeAmount), 0) as totalUnStakeAmount,
      IFNULL(sum(rewardAmountRealized), 0) as totalRewardAmountRealized,
      IFNULL(sum(rewardAmountUnrealized), 0) as totalRewardAmountUnrealized,
      IFNULL(sum(penaltyAmount), 0) as totalPenaltyAmount
      FROM daily_coin_stats`
    const aggregatedCoinStats: AggregatedDailyCoinStats = await db.get(dailyCoinStatsDatabase, sql)
    if (config.verbose) console.log('aggregated daily coin stats', aggregatedCoinStats)
    return aggregatedCoinStats
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

export function calculateNewBurntFee(
  transactionFee: number,
  networkFee: number,
  penaltyAmount: number
): number {
  return transactionFee + networkFee + penaltyAmount
}

export function calculateNewNetworkExpense(mintedCoin: number, rewardAmountRealized: number): number {
  return mintedCoin + rewardAmountRealized
}

export function calculateNewSupply(
  mintedCoin: number,
  rewardAmountRealized: number,
  transactionFee: number,
  networkFee: number,
  penaltyAmount: number
): number {
  return mintedCoin + rewardAmountRealized - transactionFee - networkFee - penaltyAmount
}
