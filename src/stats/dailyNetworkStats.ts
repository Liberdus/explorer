import { config } from '../config'
import * as db from '../storage/sqlite3storage'
import { dailyNetworkStatsDatabase } from '.'

export interface BaseDailyNetworkStats {
  dateStartTime: number
  stabilityFactorStr: string
  transactionFeeUsdStr: string
  stakeRequiredUsdStr: string
  nodeRewardAmountUsdStr: string
  nodePenaltyUsdStr: string
  defaultTollUsdStr: string
  minTollUsdStr: string
  activeNodes: number // The active nodes count from the cycle records ( activated + active - removed - apoptosized )
  standbyNodes: number // The non-active nodes count from the cycle records (standby + syncing nodes)
}

export interface DailyNetworkStatsSummary extends BaseDailyNetworkStats {
  stabilityFactorStrChange: number
  transactionFeeUsdStrChange: number
  stakeRequiredUsdStrChange: number
  nodeRewardAmountUsdStrChange: number
  nodePenaltyUsdStrChange: number
  defaultTollUsdStrChange: number
  minTollUsdStrChange: number
  activeNodesChange: number
  standbyNodesChange: number
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

export async function queryDailyNetworkStatsSummary(): Promise<DailyNetworkStatsSummary | undefined> {
  try {
    const last2DaysResult = await queryLatestDailyNetworkStats(2)
    const dailyNetworkStats = last2DaysResult[0]

    if (!dailyNetworkStats) {
      return
    }

    const previous = last2DaysResult[1]

    const calculatePercentageChange = (currentValue: number, previousValue: number): number => {
      if (previousValue === 0) {
        if (currentValue === 0) return 0
        return currentValue > 0 ? 100 : -100
      }
      return ((currentValue - previousValue) / previousValue) * 100
    }

    const summary: DailyNetworkStatsSummary = {
      dateStartTime: dailyNetworkStats.dateStartTime ?? 0,
      stabilityFactorStr: dailyNetworkStats.stabilityFactorStr ?? '0',
      transactionFeeUsdStr: dailyNetworkStats.transactionFeeUsdStr ?? '0',
      stakeRequiredUsdStr: dailyNetworkStats.stakeRequiredUsdStr ?? '0',
      nodeRewardAmountUsdStr: dailyNetworkStats.nodeRewardAmountUsdStr ?? '0',
      nodePenaltyUsdStr: dailyNetworkStats.nodePenaltyUsdStr ?? '0',
      defaultTollUsdStr: dailyNetworkStats.defaultTollUsdStr ?? '0',
      minTollUsdStr: dailyNetworkStats.minTollUsdStr ?? '0',
      activeNodes: dailyNetworkStats.activeNodes ?? 0,
      standbyNodes: dailyNetworkStats.standbyNodes ?? 0,
      stabilityFactorStrChange: calculatePercentageChange(
        parseFloat(dailyNetworkStats.stabilityFactorStr),
        parseFloat(previous?.stabilityFactorStr)
      ),
      transactionFeeUsdStrChange: calculatePercentageChange(
        parseFloat(dailyNetworkStats.transactionFeeUsdStr),
        parseFloat(previous?.transactionFeeUsdStr)
      ),
      stakeRequiredUsdStrChange: calculatePercentageChange(
        parseFloat(dailyNetworkStats.stakeRequiredUsdStr),
        parseFloat(previous?.stakeRequiredUsdStr)
      ),
      nodeRewardAmountUsdStrChange: calculatePercentageChange(
        parseFloat(dailyNetworkStats.nodeRewardAmountUsdStr),
        parseFloat(previous?.nodeRewardAmountUsdStr)
      ),
      nodePenaltyUsdStrChange: calculatePercentageChange(
        parseFloat(dailyNetworkStats.nodePenaltyUsdStr),
        parseFloat(previous?.nodePenaltyUsdStr)
      ),
      defaultTollUsdStrChange: calculatePercentageChange(
        parseFloat(dailyNetworkStats.defaultTollUsdStr),
        parseFloat(previous?.defaultTollUsdStr)
      ),
      minTollUsdStrChange: calculatePercentageChange(
        parseFloat(dailyNetworkStats.minTollUsdStr),
        parseFloat(previous?.minTollUsdStr)
      ),
      activeNodesChange: calculatePercentageChange(dailyNetworkStats.activeNodes, previous?.activeNodes),
      standbyNodesChange: calculatePercentageChange(dailyNetworkStats.standbyNodes, previous?.standbyNodes),
    }

    return summary
  } catch (e) {
    console.log('Error fetching daily network stats summary:', e)
    return
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
