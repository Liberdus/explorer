import * as db from './sqlite3storage'
import { accountHistoryStateDatabase } from '.'
import { config } from '../config/index'
import { Account, AccountType } from '../types'
import * as ReceiptDB from './receipt'

export interface AccountHistoryState {
  accountId: string
  beforeStateHash: string
  afterStateHash: string
  timestamp: number
  receiptId: string
  balance: number
}

const ACCOUNT_HISTORY_STATE_COLUMNS: readonly (keyof AccountHistoryState)[] = [
  'accountId',
  'beforeStateHash',
  'afterStateHash',
  'timestamp',
  'receiptId',
  'balance',
] as const

export interface BalanceChange {
  accountId: string
  before: number
  after: number
}

export async function insertAccountHistoryState(accountHistoryState: AccountHistoryState): Promise<void> {
  try {
    const fields = `(${ACCOUNT_HISTORY_STATE_COLUMNS.join(', ')})`
    // Create placeholders for one row
    const placeholders = `(${ACCOUNT_HISTORY_STATE_COLUMNS.map(() => '?').join(', ')})`
    // Map the `accountHistoryState` object to match the columns
    const values = ACCOUNT_HISTORY_STATE_COLUMNS.map((column) => accountHistoryState[column])

    const sql = `INSERT OR REPLACE INTO accountHistoryState ${fields} VALUES ${placeholders}`
    await db.run(accountHistoryStateDatabase, sql, values)
    if (config.verbose)
      console.log(
        'Successfully inserted AccountHistoryState',
        accountHistoryState.accountId,
        accountHistoryState.receiptId
      )
  } catch (e) {
    console.log(e)
    console.log(
      'Unable to insert AccountHistoryState or it is already stored in to database',
      accountHistoryState.accountId,
      accountHistoryState.receiptId
    )
  }
}

export async function bulkInsertAccountHistoryStates(
  accountHistoryStates: AccountHistoryState[]
): Promise<void> {
  try {
    const fields = `(${ACCOUNT_HISTORY_STATE_COLUMNS.join(', ')})`
    // Create placeholders for one row
    const placeholders = `(${ACCOUNT_HISTORY_STATE_COLUMNS.map(() => '?').join(', ')})`
    // Create multiple placeholder groups for bulk insert
    const allPlaceholders = Array(accountHistoryStates.length).fill(placeholders).join(', ')

    // Flatten the `accountHistoryStates` array into a single list of values
    const values = accountHistoryStates.flatMap((state) =>
      ACCOUNT_HISTORY_STATE_COLUMNS.map((column) => state[column])
    )

    const sql = `INSERT OR REPLACE INTO accountHistoryState ${fields} VALUES ${allPlaceholders}`
    // Serialize write through storage-level queue + transaction for atomicity
    await db.executeDbWriteWithTransaction(accountHistoryStateDatabase, sql, values)
    console.log('Successfully bulk inserted AccountHistoryStates', accountHistoryStates.length)
  } catch (e) {
    console.log(e)
    console.log('Unable to bulk insert AccountHistoryStates', accountHistoryStates.length)
  }
}

export async function queryAccountHistoryState(
  _accountId: string,
  beforeTimestamp?: string
): Promise<Omit<Account, 'createdTimestamp'> | null> {
  try {
    let sql = `SELECT * FROM accountHistoryState WHERE accountId=? `
    const values = [_accountId]
    if (beforeTimestamp) {
      sql = db.updateSqlStatementClause(sql, values)
      sql += `timestamp < ?`
      values.push(beforeTimestamp)
    }
    sql += ` ORDER BY timestamp DESC LIMIT 1`
    const accountHistoryState = (await db.get(
      accountHistoryStateDatabase,
      sql,
      values
    )) as AccountHistoryState
    if (accountHistoryState) {
      if (config.verbose) console.log('AccountHistoryState', accountHistoryState)
      const receipt = await ReceiptDB.queryReceiptByReceiptId(accountHistoryState.receiptId)
      if (!receipt) {
        console.log('Unable to find receipt for AccountHistoryState', accountHistoryState.receiptId)
        return null
      }
      const filterAccount = receipt.afterStates.filter((account) => account.accountId === _accountId)
      if (filterAccount.length === 0) {
        console.log(
          'Unable to find account in receipt for AccountHistoryState',
          accountHistoryState.receiptId
        )
        return null
      }
      const account = filterAccount[0]
      const accountType = account.data.type as AccountType // be sure to update with the correct field with the account type defined in the dapp
      const accObj: Omit<Account, 'createdTimestamp'> = {
        accountId: account.accountId,
        cycleNumber: receipt.cycle,
        timestamp: account.timestamp,
        data: account.data,
        hash: account.hash,
        accountType,
        isGlobal: account.isGlobal,
      }
      return accObj
    }
  } catch (e) {
    console.log(e)
  }
  return null
}

export async function queryAccountHistoryStateCount(): Promise<number> {
  let accountHistoryStates: { 'COUNT(*)': number } = { 'COUNT(*)': 0 }
  try {
    const sql = `SELECT COUNT(*) FROM accountHistoryState`
    accountHistoryStates = (await db.get(accountHistoryStateDatabase, sql, [])) as { 'COUNT(*)': number }
  } catch (e) {
    console.log(e)
  }
  if (config.verbose) console.log('AccountHistoryState count', accountHistoryStates)
  return accountHistoryStates['COUNT(*)'] || 0
}

export async function queryActiveBalanceAccountsCount(beforeTimestamp: number): Promise<number> {
  let count: { count: number } = { count: 0 }
  try {
    // Get the latest state for each account before the given timestamp and count those with balance > 0
    const sql = `
      SELECT COUNT(DISTINCT accountId) as count
      FROM (
        SELECT accountId, balance
        FROM accountHistoryState
        WHERE (accountId, timestamp) IN (
          SELECT accountId, MAX(timestamp)
          FROM accountHistoryState
          WHERE timestamp < ?
          GROUP BY accountId
        )
      )
      WHERE balance > 0
    `
    count = (await db.get(accountHistoryStateDatabase, sql, [beforeTimestamp])) as { count: number }
  } catch (e) {
    console.log(e)
  }
  if (config.verbose) console.log('Active balance accounts count from history', count)
  return count?.count || 0
}

export async function queryNewActiveBalanceAccountsCount(
  beforeTimestamp: number,
  afterTimestamp: number
): Promise<number> {
  let count: { count: number } = { count: 0 }
  try {
    // Count accounts whose latest balance state within the 24-hour period is > 0
    const sql = `
      SELECT COUNT(DISTINCT accountId) as count
      FROM accountHistoryState
      WHERE (accountId, timestamp) IN (
        SELECT accountId, MAX(timestamp)
        FROM accountHistoryState
        WHERE timestamp > ? AND timestamp < ?
        GROUP BY accountId
      )
      AND balance > 0
    `
    count = (await db.get(accountHistoryStateDatabase, sql, [afterTimestamp, beforeTimestamp])) as {
      count: number
    }
  } catch (e) {
    console.log(e)
  }
  if (config.verbose) console.log('New active balance accounts count from history', count)
  return count?.count || 0
}

export async function queryBalanceChangesByReceiptId(receiptId: string): Promise<BalanceChange[]> {
  try {
    // Optimized join-based query for fastest lookup
    const sql = `
      SELECT
        current.accountId,
        current.balance AS after,
        COALESCE(prev.balance, 0) AS before
      FROM accountHistoryState AS current
      LEFT JOIN accountHistoryState AS prev
          ON prev.accountId = current.accountId
         AND prev.afterStateHash = current.beforeStateHash
      WHERE current.receiptId = ?
        AND (current.balance > 0 OR COALESCE(prev.balance, 0) > 0)
    `

    const results = (await db.all(accountHistoryStateDatabase, sql, [receiptId])) as BalanceChange[]
    return results
  } catch (e) {
    console.log('Error querying balance changes by receiptId', receiptId, e)
    return []
  }
}
