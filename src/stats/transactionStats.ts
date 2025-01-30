/* eslint-disable no-empty */
import { config } from '../config'
import * as db from '../storage/sqlite3storage'
import { transactionStatsDatabase } from '.'

export interface TransactionStats {
  timestamp: number
  totalTxs: number
  totalInternalTxs: number
  totalStakeTxs: number
  totalUnstakeTxs: number
  totalSetGlobalCodeBytesTxs: number
  totalInitNetworkTxs: number
  totalNodeRewardTxs: number
  totalChangeConfigTxs: number
  totalApplyChangeConfigTxs: number
  totalSetCertTimeTxs: number
  totalInitRewardTimesTxs: number
  totalClaimRewardTxs: number
  totalChangeNetworkParamTxs: number
  totalApplyNetworkParamTxs: number
  totalPenaltyTxs: number
  cycle: number
}

export async function insertTransactionStats(transactionStats: TransactionStats): Promise<void> {
  try {
    const fields = Object.keys(transactionStats).join(', ')
    const placeholders = Object.keys(transactionStats).fill('?').join(', ')
    const values = db.extractValues(transactionStats)
    const sql = 'INSERT OR REPLACE INTO transactions (' + fields + ') VALUES (' + placeholders + ')'
    await db.run(transactionStatsDatabase, sql, values)
    console.log('Successfully inserted TransactionStats', transactionStats.cycle)
  } catch (e) {
    console.log(e)
    console.log(
      'Unable to insert transactionStats or it is already stored in to database',
      transactionStats.cycle
    )
  }
}

export async function bulkInsertTransactionsStats(transactionsStats: TransactionStats[]): Promise<void> {
  try {
    const fields = Object.keys(transactionsStats[0]).join(', ')
    const placeholders = Object.keys(transactionsStats[0]).fill('?').join(', ')
    const values = db.extractValuesFromArray(transactionsStats)
    let sql = 'INSERT OR REPLACE INTO transactions (' + fields + ') VALUES (' + placeholders + ')'
    for (let i = 1; i < transactionsStats.length; i++) {
      sql = sql + ', (' + placeholders + ')'
    }
    await db.run(transactionStatsDatabase, sql, values)
    const addedCycles = transactionsStats.map((v) => v.cycle)
    console.log(
      'Successfully bulk inserted TransactionsStats',
      transactionsStats.length,
      'for cycles',
      addedCycles
    )
  } catch (e) {
    console.log(e)
    console.log('Unable to bulk insert TransactionsStats', transactionsStats.length)
  }
}

export async function queryLatestTransactionStats(count: number): Promise<TransactionStats[]> {
  try {
    const sql = `SELECT * FROM transactions ORDER BY cycle DESC LIMIT ${count ? count : 100}`
    const transactionsStats: TransactionStats[] = await db.all(transactionStatsDatabase, sql)
    if (config.verbose) console.log('transactionStats count', transactionsStats)
    if (transactionsStats.length > 0) {
      transactionsStats.sort((a, b) => (a.timestamp > b.timestamp ? 1 : -1))
    }
    return transactionsStats
  } catch (e) {
    console.log(e)
  }
}

export async function queryTransactionStatsBetween(
  startCycle: number,
  endCycle: number
): Promise<TransactionStats[]> {
  try {
    const sql = `SELECT * FROM transactions WHERE cycle BETWEEN ? AND ? ORDER BY cycle DESC LIMIT 100`
    const transactionsStats: TransactionStats[] = await db.all(transactionStatsDatabase, sql, [startCycle, endCycle])
    if (config.verbose) console.log('transactionStats between', transactionsStats)
    if (transactionsStats.length > 0) {
      transactionsStats.sort((a, b) => (a.timestamp > b.timestamp ? 1 : -1))
    }
    return transactionsStats
  } catch (e) {
    console.log(e)
  }
}
