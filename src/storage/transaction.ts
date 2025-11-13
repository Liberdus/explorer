import * as db from './sqlite3storage'
import { transactionDatabase } from '.'
import { config } from '../config/index'
import { Utils as StringUtils } from '@shardus/types'
import { Transaction, TransactionType, TransactionSearchType, TransactionSearchParams } from '../types'

type DbTransaction = Transaction & {
  data: string
  originalTxData: string
}

const TRANSACTION_COLUMNS: readonly (keyof Transaction)[] = [
  'txId',
  'timestamp',
  'cycleNumber',
  'transactionType',
  'txFrom',
  'txTo',
  'txFee',
  'data',
  'originalTxData',
] as const

export async function insertTransaction(transaction: Transaction): Promise<void> {
  try {
    const fields = `(${TRANSACTION_COLUMNS.join(', ')})`
    // Create placeholders for one row
    const placeholders = `(${TRANSACTION_COLUMNS.map(() => '?').join(', ')})`

    // Map the `transaction` object to match the columns
    const values = TRANSACTION_COLUMNS.map((column) =>
      typeof transaction[column] === 'object'
        ? StringUtils.safeStringify(transaction[column]) // Serialize objects to JSON
        : transaction[column]
    )

    const sql = `INSERT OR REPLACE INTO transactions ${fields} VALUES ${placeholders}`
    await db.run(transactionDatabase, sql, values)
    if (config.verbose) console.log('Successfully inserted Transaction', transaction.txId)
  } catch (e) {
    console.log(e)
    console.log('Unable to insert Transaction or it is already stored in to database', transaction.txId)
  }
}

export async function bulkInsertTransactions(transactions: Transaction[]): Promise<void> {
  try {
    const fields = `(${TRANSACTION_COLUMNS.join(', ')})`
    // Create placeholders for one row
    const placeholders = `(${TRANSACTION_COLUMNS.map(() => '?').join(', ')})`
    // Create multiple placeholder groups for bulk insert
    const allPlaceholders = Array(transactions.length).fill(placeholders).join(', ')

    // Flatten the `transactions` array into a single list of values
    const values = transactions.flatMap((transaction) =>
      TRANSACTION_COLUMNS.map((column) =>
        typeof transaction[column] === 'object'
          ? StringUtils.safeStringify(transaction[column]) // Serialize objects to JSON
          : transaction[column]
      )
    )

    const sql = `INSERT OR REPLACE INTO transactions ${fields} VALUES ${allPlaceholders}`
    // Serialize write through storage-level queue + transaction for atomicity
    await db.executeDbWriteWithTransaction(transactionDatabase, sql, values)
    console.log('Successfully bulk inserted transactions', transactions.length)
  } catch (e) {
    console.log(e)
    console.log('Unable to bulk insert transactions', transactions.length)
  }
}

export async function updateTransaction(_txId: string, transaction: Partial<Transaction>): Promise<void> {
  try {
    const sql = `UPDATE transactions SET result = $result, cycleNumber = $cycleNumber, data = $data, txFee = $txFee WHERE txId = $txId `
    await db.run(transactionDatabase, sql, {
      $cycleNumber: transaction.cycleNumber,
      $data: transaction.data && StringUtils.safeStringify(transaction.data),
      $txFee: transaction.txFee,
      $txId: transaction.txId,
    })
    if (config.verbose) console.log('Successfully Updated Transaction', transaction.txId)
  } catch (e) {
    /* prettier-ignore */ if (config.verbose) console.log(e);
    console.log('Unable to update Transaction', transaction.txId)
  }
}

export async function processTransactionData(transactions: Transaction[]): Promise<void> {
  console.log('transactions size', transactions.length)
  if (transactions && transactions.length <= 0) return
  const bucketSize = 1000
  let combineTransactions: Transaction[] = []
  for (const transaction of transactions) {
    const txObj = {
      txId: transaction.txId,
      cycleNumber: transaction.cycleNumber,
      timestamp: transaction.timestamp,
      originalTxData: transaction.originalTxData || {},
      data: transaction.data,
    } as Transaction
    if (transaction.data) {
      txObj.transactionType = transaction.data.type as TransactionType // be sure to update with the correct field with the transaction type defined in the dapp
      txObj.txFrom = transaction.data.from // be sure to update with the correct field of the tx sender
      txObj.txTo = transaction.data.to // be sure to update with the correct field of the tx recipient
    } else {
      // Extract tx receipt from original tx data
      txObj.transactionType = transaction.originalTxData.tx.type as TransactionType // be sure to update with the correct field with the transaction type defined in the dapp
      txObj.txFrom = transaction.originalTxData.tx.from // be sure to update with the correct field of the tx sender
      txObj.txTo = transaction.originalTxData.tx.to // be sure to update with the correct field of the tx recipient
    }
    combineTransactions.push(txObj)
    if (combineTransactions.length >= bucketSize) {
      await bulkInsertTransactions(combineTransactions)
      combineTransactions = []
    }
  }
  if (combineTransactions.length > 0) await bulkInsertTransactions(combineTransactions)
}

type QueryTransactionCountParams = {
  txType?: TransactionSearchType
  accountId?: string
  startCycleNumber?: number
  endCycleNumber?: number
  beforeTimestamp?: number
  afterTimestamp?: number
  excludeZeroFeeTxs?: boolean
}

export async function queryTransactionCount(
  query: QueryTransactionCountParams | null = null
): Promise<number> {
  const params: QueryTransactionCountParams = query ?? {}
  const { txType, accountId, startCycleNumber, endCycleNumber, beforeTimestamp, afterTimestamp } = params
  let transactions: { 'COUNT(*)': number } = { 'COUNT(*)': 0 }
  try {
    let sql = `SELECT COUNT(*) FROM transactions`
    const values: unknown[] = []
    if (txType) {
      if (txType === TransactionSearchParams.all) {
        // do nothing
      } else {
        sql = db.updateSqlStatementClause(sql, values)
        sql += `transactionType=?`
        values.push(txType)
      }
    }
    if (accountId) {
      sql = db.updateSqlStatementClause(sql, values)
      sql += `(txFrom=? OR txTo=?)`
      values.push(accountId, accountId)
    }
    if (startCycleNumber || endCycleNumber) {
      sql = db.updateSqlStatementClause(sql, values)
      sql += `cycleNumber BETWEEN ? AND ?`
      values.push(startCycleNumber, endCycleNumber)
    }
    if (beforeTimestamp > 0) {
      sql = db.updateSqlStatementClause(sql, values)
      sql += `timestamp < ?`
      values.push(beforeTimestamp)
    }
    if (afterTimestamp > 0) {
      sql = db.updateSqlStatementClause(sql, values)
      sql += `timestamp > ?`
      values.push(afterTimestamp)
    }
    if (params.excludeZeroFeeTxs) {
      sql += ` AND txFee > 0`
    }
    transactions = (await db.get(transactionDatabase, sql, values)) as { 'COUNT(*)': number }
    // console.log('queryTransactionCount', sql, values, transactions)
  } catch (e) {
    console.log(e)
  }
  if (config.verbose) console.log('transactions count', transactions)

  return transactions['COUNT(*)'] || 0
}

type QueryTransactionsParams = QueryTransactionCountParams & {
  skip?: number
  limit?: number /* default 10, set 0 for all */
}

export async function queryTransactions(query: QueryTransactionsParams): Promise<DbTransaction[]> {
  const {
    skip = 0,
    limit = 10,
    txType,
    accountId,
    startCycleNumber,
    endCycleNumber,
    beforeTimestamp,
    afterTimestamp,
  } = query
  let transactions: DbTransaction[] = []
  try {
    let sql = `SELECT * FROM transactions`
    const values: unknown[] = []
    if (txType) {
      if (txType === TransactionSearchParams.all) {
        // do nothing
      } else {
        sql = db.updateSqlStatementClause(sql, values)
        sql += `transactionType=?`
        values.push(txType)
      }
    }
    if (accountId) {
      sql = db.updateSqlStatementClause(sql, values)
      sql += `(txFrom=? OR txTo=?)`
      values.push(accountId, accountId)
    }

    if (startCycleNumber || endCycleNumber) {
      sql = db.updateSqlStatementClause(sql, values)
      sql += `cycleNumber BETWEEN ? AND ?`
      values.push(startCycleNumber, endCycleNumber)
    }
    if (beforeTimestamp > 0) {
      sql = db.updateSqlStatementClause(sql, values)
      sql += `timestamp < ?`
      values.push(beforeTimestamp)
    }
    if (afterTimestamp > 0) {
      sql = db.updateSqlStatementClause(sql, values)
      sql += `timestamp > ?`
      values.push(afterTimestamp)
    }
    if (beforeTimestamp > 0) {
      sql += ` ORDER BY timestamp DESC`
    } else if (afterTimestamp > 0) {
      sql += ` ORDER BY timestamp ASC`
    } else if (startCycleNumber || endCycleNumber) {
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
    transactions = (await db.all(transactionDatabase, sql, values)) as DbTransaction[]
    // console.log('queryTransactions', sql, values, transactions)
    if (transactions.length > 0) {
      transactions.forEach((transaction: DbTransaction) => {
        deserializeDbTransaction(transaction)
      })
    }

    if (config.verbose) console.log('transactions', transactions)
  } catch (e) {
    console.log(e)
  }

  return transactions
}

export async function queryTransactionByTxId(txId: string): Promise<Transaction | null> {
  try {
    const sql = `SELECT * FROM transactions WHERE txId=?`
    const transaction = (await db.get(transactionDatabase, sql, [txId])) as DbTransaction
    if (transaction) {
      deserializeDbTransaction(transaction)
    }
    if (config.verbose) console.log('transaction txId', transaction)
    return transaction
  } catch (e) {
    console.log(e)
  }
  return null
}

export async function queryTransactionCountByCycles(
  start: number,
  end: number,
  txType?: TransactionSearchType
): Promise<{ cycle: number; transactions: number }[]> {
  let transactions: { cycleNumber: number; 'COUNT(*)': number }[] = []
  try {
    let sql = `SELECT cycleNumber, COUNT(*) FROM transactions`
    const values: unknown[] = []
    if (txType) {
      if (txType === TransactionSearchParams.all) {
        // do nothing
      } else {
        sql += ` WHERE transactionType=?`
        values.push(txType)
      }
    }
    sql += ` GROUP BY cycleNumber HAVING cycleNumber BETWEEN ? AND ? ORDER BY cycleNumber ASC`
    values.push(start, end)
    transactions = (await db.all(transactionDatabase, sql, values)) as {
      cycleNumber: number
      'COUNT(*)': number
    }[]
  } catch (e) {
    console.log(e)
  }
  if (config.verbose) console.log('Transaction count by cycles', transactions)

  return transactions.map((receipt) => {
    return {
      cycle: receipt.cycleNumber,
      transactions: receipt['COUNT(*)'],
    }
  })
}

export async function queryTransactionsForCycle(cycleNumber: number): Promise<Transaction[]> {
  let transactions: DbTransaction[] = []
  try {
    const sql = `SELECT * FROM transactions WHERE cycleNumber=? ORDER BY timestamp ASC`
    transactions = await db.all(transactionDatabase, sql, [cycleNumber])
    if (transactions.length > 0) {
      transactions.forEach((transaction: DbTransaction) => deserializeDbTransaction(transaction))
    }
    if (config.verbose) console.log('transactions for cycle', cycleNumber, transactions)
  } catch (e) {
    console.log('exception when querying transactions for cycle', cycleNumber, e)
  }
  return transactions
}

export type TransactionCountByTypeResult = {
  transactionType: string
  total: number
  countWithFee: number
  countWithoutFee: number
}

export async function queryTransactionCountsByType(
  beforeTimestamp?: number,
  afterTimestamp?: number
): Promise<TransactionCountByTypeResult[]> {
  let results: TransactionCountByTypeResult[] = []
  try {
    let sql = `SELECT
      transactionType,
      COUNT(*) as total,
      SUM(CASE WHEN txFee > 0 THEN 1 ELSE 0 END) as countWithFee,
      SUM(CASE WHEN txFee = 0 OR txFee IS NULL THEN 1 ELSE 0 END) as countWithoutFee
    FROM transactions`
    const values: unknown[] = []

    if (beforeTimestamp && afterTimestamp) {
      sql += ` WHERE timestamp < ? AND timestamp > ?`
      values.push(beforeTimestamp, afterTimestamp)
    } else if (beforeTimestamp) {
      sql += ` WHERE timestamp < ?`
      values.push(beforeTimestamp)
    } else if (afterTimestamp) {
      sql += ` WHERE timestamp > ?`
      values.push(afterTimestamp)
    }

    sql += ` GROUP BY transactionType`

    results = (await db.all(transactionDatabase, sql, values)) as TransactionCountByTypeResult[]
  } catch (e) {
    console.log('Error querying transaction counts by type:', e)
  }
  return results
}

export async function queryActiveAccountsCountByTxFee(
  beforeTimestamp: number,
  afterTimestamp: number,
  excludeZeroFeeTxs = false
): Promise<number> {
  let activeAccounts: { 'COUNT(DISTINCT txFrom)': number } = { 'COUNT(DISTINCT txFrom)': 0 }
  try {
    const sql = `
      SELECT COUNT(DISTINCT txFrom) FROM transactions
      WHERE timestamp < ? AND timestamp > ? ${excludeZeroFeeTxs ? ' AND txFee > 0' : ''}
    `
    const values = [beforeTimestamp, afterTimestamp]
    activeAccounts = (await db.get(transactionDatabase, sql, values)) as {
      'COUNT(DISTINCT txFrom)': number
    }
  } catch (e) {
    console.log('Error querying active accounts by txFee:', e)
  }
  if (config.verbose) console.log('Active accounts count by txFee', activeAccounts)
  return activeAccounts['COUNT(DISTINCT txFrom)'] || 0
}

function deserializeDbTransaction(transaction: DbTransaction): void {
  transaction.data = StringUtils.safeJsonParse(transaction.data)
  transaction.originalTxData = StringUtils.safeJsonParse(transaction.originalTxData)
}
