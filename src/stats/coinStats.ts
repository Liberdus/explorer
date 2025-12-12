import { config } from '../config/index'
import * as db from '../storage/sqlite3storage'
import { coinStatsDatabase } from '.'

export interface CoinStats {
  cycle: number
  timestamp: number
  totalSupplyChange: number
  totalStakeChange: number
  transactionFee: number
  networkCommission: number
}

const COIN_STATS_COLUMNS: readonly (keyof CoinStats)[] = [
  'cycle',
  'timestamp',
  'totalSupplyChange',
  'totalStakeChange',
  'transactionFee',
  'networkCommission',
] as const

export async function insertCoinStats(coinStats: CoinStats): Promise<void> {
  try {
    const fields = `(${COIN_STATS_COLUMNS.join(', ')})`
    // Create placeholders for one row
    const placeholders = `(${COIN_STATS_COLUMNS.map(() => '?').join(', ')})`
    // Map the `coinStats` object to match the columns
    const values = COIN_STATS_COLUMNS.map((column) => coinStats[column])

    const sql = `INSERT OR REPLACE INTO coin_stats ${fields} VALUES ${placeholders}`
    await db.run(coinStatsDatabase, sql, values)
    console.log('Successfully inserted coinStats', coinStats.cycle)
  } catch (e) {
    console.log('Unable to insert coinStats or it is already stored in to database', coinStats.cycle, e)
  }
}

export async function bulkInsertCoinsStats(coinStats: CoinStats[]): Promise<void> {
  try {
    const fields = `(${COIN_STATS_COLUMNS.join(', ')})`
    // Create placeholders for one row
    const placeholders = `(${COIN_STATS_COLUMNS.map(() => '?').join(', ')})`
    // Create multiple placeholder groups for bulk insert
    const allPlaceholders = Array(coinStats.length).fill(placeholders).join(', ')

    // Flatten the `coinStats` array into a single list of values
    const values = coinStats.flatMap((stat) => COIN_STATS_COLUMNS.map((column) => stat[column]))

    const sql = `INSERT OR REPLACE INTO coin_stats ${fields} VALUES ${allPlaceholders}`
    await db.run(coinStatsDatabase, sql, values)
    const addedCycles = coinStats.map((v) => v.cycle)
    console.log('Successfully inserted CoinStats', coinStats.length, 'for cycles', addedCycles)
  } catch (e) {
    console.log(e)
    console.log('Unable to bulk insert CoinStats', coinStats.length)
  }
}

export async function queryLatestCoinStats(
  count?: number,
  select: keyof CoinStats | (keyof CoinStats)[] | 'all' = 'all'
): Promise<CoinStats[]> {
  try {
    // Build SELECT clause
    let selectClause = '*'
    if (select !== 'all') {
      const fields = Array.isArray(select) ? select : [select]
      selectClause = fields.join(', ')
    }
    const sql = `SELECT ${selectClause} FROM coin_stats ORDER BY cycle DESC LIMIT ${count ? count : 100}`
    const coinStats: CoinStats[] = await db.all(coinStatsDatabase, sql)
    if (config.verbose) console.log('coinStats count', coinStats)
    return coinStats
  } catch (e) {
    console.log('Unable to retrieve latest coinStats from the database', e)
  }
}

export async function queryAggregatedCoinStats(): Promise<{
  totalSupplyChange: number
  totalStakeChange: number
  transactionFee: number
  networkCommission: number
}> {
  try {
    const sql = `SELECT IFNULL(sum(totalSupplyChange), 0) as totalSupplyChange, IFNULL(sum(totalStakeChange), 0) as totalStakeChange, IFNULL(sum(transactionFee), 0) as transactionFee, IFNULL(sum(networkCommission), 0) as networkCommission FROM coin_stats`
    const coinStats: {
      totalSupplyChange: number
      totalStakeChange: number
      transactionFee: number
      networkCommission: number
    } = await db.get(coinStatsDatabase, sql)
    if (config.verbose) console.log('aggregated coin stats', coinStats)
    return coinStats
  } catch (e) {
    console.log('Unable to retrieve aggregated coin stats', e)
  }
}
