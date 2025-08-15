import { config } from '../config/index'
import * as db from '../storage/sqlite3storage'
import { totalAccountBalanceDatabase } from '.'

export interface TotalAccountBalance {
  cycleNumber: number
  timestamp: number
  totalBalance: string
  calculatedSupply: string
  difference: string
  differencePercentage: number
  isWithinTolerance: boolean
  accountsProcessed: number
}

export async function insertTotalAccountBalance(totalAccountBalance: TotalAccountBalance): Promise<void> {
  try {
    const fields = Object.keys(totalAccountBalance).join(', ')
    const placeholders = Object.keys(totalAccountBalance).fill('?').join(', ')
    const values = db.extractValues(totalAccountBalance)
    const sql = 'INSERT OR REPLACE INTO total_account_balances (' + fields + ') VALUES (' + placeholders + ')'
    await db.run(totalAccountBalanceDatabase, sql, values)
    if (config.verbose)
      console.log('Successfully inserted TotalAccountBalance', totalAccountBalance.cycleNumber)
  } catch (e) {
    console.log(e)
    console.log(
      'Unable to insert TotalAccountBalance or it is already stored in database',
      totalAccountBalance.cycleNumber
    )
  }
}

export async function queryTotalAccountBalances(
  skip = 0,
  limit = 100,
  cycle?: number
): Promise<TotalAccountBalance[]> {
  let totalAccountBalances: TotalAccountBalance[] = []
  try {
    let sql = `SELECT * FROM total_account_balances`
    const values: unknown[] = []
    if (cycle !== undefined) {
      sql += ` WHERE cycleNumber = ?`
      values.push(cycle)
    }
    sql += ` ORDER BY cycleNumber DESC, timestamp DESC LIMIT ${limit} OFFSET ${skip}`
    totalAccountBalances = (await db.all(totalAccountBalanceDatabase, sql, values)) as TotalAccountBalance[]
  } catch (e) {
    console.log(e)
  }
  if (config.verbose)
    console.log(
      'TotalAccountBalance records',
      totalAccountBalances ? totalAccountBalances.length : totalAccountBalances,
      'skip',
      skip
    )

  return totalAccountBalances
}
