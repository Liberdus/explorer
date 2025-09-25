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

export async function insertCoinStats(coinStats: CoinStats): Promise<void> {
  try {
    const fields = Object.keys(coinStats).join(', ')
    const placeholders = Object.keys(coinStats).fill('?').join(', ')
    const values = db.extractValues(coinStats)
    const sql = 'INSERT OR REPLACE INTO coin_stats (' + fields + ') VALUES (' + placeholders + ')'
    await db.run(coinStatsDatabase, sql, values)
    console.log('Successfully inserted coinStats', coinStats.cycle)
  } catch (e) {
    console.log('Unable to insert coinStats or it is already stored in to database', coinStats.cycle, e)
  }
}

export async function bulkInsertCoinsStats(coinStats: CoinStats[]): Promise<void> {
  try {
    const fields = Object.keys(coinStats[0]).join(', ')
    const placeholders = Object.keys(coinStats[0]).fill('?').join(', ')
    const values = db.extractValuesFromArray(coinStats)
    let sql = 'INSERT OR REPLACE INTO coin_stats (' + fields + ') VALUES (' + placeholders + ')'
    for (let i = 1; i < coinStats.length; i++) {
      sql = sql + ', (' + placeholders + ')'
    }
    await db.run(coinStatsDatabase, sql, values)
    const addedCycles = coinStats.map((v) => v.cycle)
    console.log('Successfully inserted CoinStats', coinStats.length, 'for cycles', addedCycles)
  } catch (e) {
    console.log(e)
    console.log('Unable to bulk insert CoinStats', coinStats.length)
  }
}

export async function queryLatestCoinStats(count?: number): Promise<CoinStats[]> {
  try {
    const sql = `SELECT * FROM coin_stats ORDER BY cycle DESC LIMIT ${count ? count : 100}`
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
