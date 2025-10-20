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

const TOTAL_ACCOUNT_BALANCE_COLUMNS: readonly (keyof TotalAccountBalance)[] = [
  'cycleNumber',
  'timestamp',
  'totalBalance',
  'calculatedSupply',
  'difference',
  'differencePercentage',
  'isWithinTolerance',
  'accountsProcessed',
] as const

export async function insertTotalAccountBalance(totalAccountBalance: TotalAccountBalance): Promise<void> {
  try {
    const fields = `(${TOTAL_ACCOUNT_BALANCE_COLUMNS.join(', ')})`
    // Create placeholders for one row
    const placeholders = `(${TOTAL_ACCOUNT_BALANCE_COLUMNS.map(() => '?').join(', ')})`
    // Map the `totalAccountBalance` object to match the columns
    const values = TOTAL_ACCOUNT_BALANCE_COLUMNS.map((column) => totalAccountBalance[column])

    const sql = `INSERT OR REPLACE INTO total_account_balances ${fields} VALUES ${placeholders}`
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
