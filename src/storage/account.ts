import * as db from './sqlite3storage'
import { accountDatabase } from '.'
import { config } from '../config/index'
import { Account, AccountSearchType, AccountType, AccountsCopy } from '../types'
import { Utils as StringUtils } from '@shardus/types'

type DbAccount = Account & {
  data: string
}

export async function insertAccount(account: Account): Promise<void> {
  try {
    const fields = Object.keys(account).join(', ')
    const placeholders = Object.keys(account).fill('?').join(', ')
    const values = db.extractValues(account)
    const sql = `INSERT INTO accounts (${fields}) VALUES (${placeholders})
      ON CONFLICT(accountId) DO UPDATE SET
        cycleNumber = excluded.cycleNumber,
        timestamp = excluded.timestamp,
        data = excluded.data,
        hash = excluded.hash,
        accountType = excluded.accountType,
        isGlobal = excluded.isGlobal,
        createdTimestamp = MIN(accounts.createdTimestamp, excluded.createdTimestamp)
      WHERE excluded.timestamp > accounts.timestamp`
    await db.run(accountDatabase, sql, values)
    if (config.verbose) console.log('Successfully inserted Account', account.accountId)
  } catch (e) {
    console.log(e)
    console.log('Unable to insert Account or it is already stored in to database', account.accountId)
  }
}

export async function bulkInsertAccounts(accounts: Account[]): Promise<void> {
  try {
    const fields = Object.keys(accounts[0]).join(', ')
    const placeholders = Object.keys(accounts[0]).fill('?').join(', ')
    const values = db.extractValuesFromArray(accounts)
    let sql = 'INSERT INTO accounts (' + fields + ') VALUES (' + placeholders + ')'
    for (let i = 1; i < accounts.length; i++) {
      sql = sql + ', (' + placeholders + ')'
    }
    sql += ` ON CONFLICT(accountId) DO UPDATE SET
      cycleNumber = excluded.cycleNumber,
      timestamp = excluded.timestamp,
      data = excluded.data,
      hash = excluded.hash,
      accountType = excluded.accountType,
      isGlobal = excluded.isGlobal,
      createdTimestamp = MIN(accounts.createdTimestamp, excluded.createdTimestamp)
    WHERE excluded.timestamp > accounts.timestamp`
    await db.run(accountDatabase, sql, values)
    console.log('Successfully bulk inserted Accounts', accounts.length)
  } catch (e) {
    console.log(e)
    console.log('Unable to bulk insert Accounts', accounts.length)
  }
}

export async function updateAccount(account: Partial<Account>): Promise<void> {
  try {
    const sql = `UPDATE accounts SET cycleNumber = $cycleNumber, timestamp = $timestamp, data = $data, hash = $hash WHERE accountId = $accountId `
    await db.run(accountDatabase, sql, {
      $cycleNumber: account.cycleNumber,
      $timestamp: account.timestamp,
      $data: account.data && StringUtils.safeStringify(account.data),
      $hash: account.hash,
      $accountId: account.accountId,
    })
    if (config.verbose) console.log('Successfully updated Account', account.accountId)
  } catch (e) {
    console.log(e)
    console.log('Unable to update Account', account)
  }
}

export async function updateCreatedTimestamp(accountId: string, createdTimestamp: number): Promise<void> {
  try {
    const sql = `UPDATE accounts SET createdTimestamp = $createdTimestamp WHERE accountId = $accountId`
    await db.run(accountDatabase, sql, {
      $createdTimestamp: createdTimestamp,
      $accountId: accountId,
    })
    if (config.verbose) console.log('Successfully updated createdTimestamp for Account', accountId)
  } catch (e) {
    console.log(e)
    console.log('Unable to update createdTimestamp for Account', accountId)
  }
}

type QueryAccountCountParams = {
  startCycleNumber?: number
  endCycleNumber?: number
  type?: AccountSearchType
}

export async function queryAccountCount(query: QueryAccountCountParams | null = null): Promise<number> {
  const { startCycleNumber, endCycleNumber, type } = query ?? {}
  let accounts: { 'COUNT(*)': number } = { 'COUNT(*)': 0 }
  try {
    let sql = `SELECT COUNT(*) FROM accounts`
    const values: unknown[] = []
    if (type) {
      sql = db.updateSqlStatementClause(sql, values)
      sql += `accountType=?`
      values.push(type)
    }
    if (startCycleNumber || endCycleNumber) {
      sql = db.updateSqlStatementClause(sql, values)
      sql += `cycleNumber BETWEEN ? AND ?`
      values.push(startCycleNumber, endCycleNumber)
    }
    accounts = (await db.get(accountDatabase, sql, values)) as { 'COUNT(*)': number }
  } catch (e) {
    console.log(e)
  }
  if (config.verbose) console.log('Account count', accounts)
  return accounts['COUNT(*)'] || 0
}

type QueryAccountsParams = QueryAccountCountParams & {
  skip?: number
  limit?: number /* default 10, set 0 for all */
}

export async function queryAccounts(query: QueryAccountsParams): Promise<Account[]> {
  const { skip = 0, limit = 10, startCycleNumber, endCycleNumber, type } = query
  let accounts: DbAccount[] = []
  try {
    let sql = `SELECT * FROM accounts`
    const values: unknown[] = []
    if (type) {
      sql = db.updateSqlStatementClause(sql, values)
      sql += `accountType=?`
      values.push(type)
    }
    if (startCycleNumber || endCycleNumber) {
      sql = db.updateSqlStatementClause(sql, values)
      sql += `cycleNumber BETWEEN ? AND ?`
      values.push(startCycleNumber, endCycleNumber)
    }
    if (startCycleNumber || endCycleNumber) {
      sql += ` ORDER BY cycleNumber ASC, timestamp ASC`
    } else {
      sql += ` ORDER BY cycleNumber DESC, timestamp DESC`
    }
    if (limit > 0) {
      sql += ` LIMIT ${limit}`
    }
    if (skip > 0) {
      sql += ` OFFSET ${skip}`
    }
    accounts = (await db.all(accountDatabase, sql, values)) as DbAccount[]
    accounts.forEach((account: DbAccount) => {
      if (account.data) account.data = StringUtils.safeJsonParse(account.data)
    })
  } catch (e) {
    console.log(e)
  }
  if (config.verbose) console.log('Accounts accounts', accounts)
  return accounts
}

export async function queryAccountByAccountId(accountId: string): Promise<Account | null> {
  try {
    const sql = `SELECT * FROM accounts WHERE accountId=?`
    const account = (await db.get(accountDatabase, sql, [accountId])) as DbAccount
    if (account) account.data = StringUtils.safeJsonParse(account.data)
    if (config.verbose) console.log('Account accountId', account)
    return account as Account
  } catch (e) {
    console.log(e)
  }
  return null
}

export async function processAccountData(accounts: AccountsCopy[]): Promise<Account[]> {
  console.log('accounts size', accounts.length)
  if (accounts && accounts.length <= 0) return []
  const bucketSize = 1000
  let combineAccounts: Account[] = []
  const transactions: Account[] = []

  for (const account of accounts) {
    try {
      if (typeof account.data === 'string') account.data = StringUtils.safeJsonParse(account.data)
    } catch (e) {
      console.log('Error in parsing account data', account.data)
      continue
    }
    const accountType = account.data.type as AccountType // be sure to update with the correct field with the account type defined in the dapp
    const accObj: Account = {
      accountId: account.accountId,
      cycleNumber: account.cycleNumber,
      timestamp: account.timestamp,
      data: account.data,
      hash: account.hash,
      accountType,
      isGlobal: account.isGlobal,
      createdTimestamp: account.timestamp,
    }
    combineAccounts.push(accObj)
    // if tx receipt is saved as an account, create tx object from the account and save it
    // if (accountType === AccountType.Receipt) {
    //   const txObj = { ...accObj }
    //   transactions.push(txObj)
    // }
    if (combineAccounts.length >= bucketSize) {
      await bulkInsertAccounts(combineAccounts)
      combineAccounts = []
    }
  }
  if (combineAccounts.length > 0) await bulkInsertAccounts(combineAccounts)
  return transactions
}

export async function queryAccountCountByCreatedTimestamp(
  startTimestamp: number,
  endTimestamp: number,
  type?: AccountSearchType
): Promise<number> {
  let accounts: { 'COUNT(*)': number } = { 'COUNT(*)': 0 }
  try {
    let sql = `SELECT COUNT(*) FROM accounts WHERE createdTimestamp BETWEEN ? AND ?`
    const values: unknown[] = [startTimestamp, endTimestamp]
    if (type) {
      sql += ` AND accountType=?`
      values.push(type)
    }
    accounts = (await db.get(accountDatabase, sql, values)) as { 'COUNT(*)': number }
  } catch (e) {
    console.log(e)
  }
  if (config.verbose) console.log('Account count by createdTimestamp', accounts)
  return accounts['COUNT(*)'] || 0
}
