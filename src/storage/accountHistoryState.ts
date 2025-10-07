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

export async function insertAccountHistoryState(accountHistoryState: AccountHistoryState): Promise<void> {
  try {
    const fields = Object.keys(accountHistoryState).join(', ')
    const placeholders = Object.keys(accountHistoryState).fill('?').join(', ')
    const values = db.extractValues(accountHistoryState)
    const sql = 'INSERT OR REPLACE INTO accountHistoryState (' + fields + ') VALUES (' + placeholders + ')'
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
    const fields = Object.keys(accountHistoryStates[0]).join(', ')
    const placeholders = Object.keys(accountHistoryStates[0]).fill('?').join(', ')
    const values = db.extractValuesFromArray(accountHistoryStates)
    let sql = 'INSERT OR REPLACE INTO accountHistoryState (' + fields + ') VALUES (' + placeholders + ')'
    for (let i = 1; i < accountHistoryStates.length; i++) {
      sql = sql + ', (' + placeholders + ')'
    }
    await db.run(accountHistoryStateDatabase, sql, values)
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
