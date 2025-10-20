import * as db from './sqlite3storage'
import { receiptDatabase } from '.'
import { config } from '../config'
import * as AccountDB from './account'
import * as TransactionDB from './transaction'
import * as AccountHistoryStateDB from './accountHistoryState'
import { Utils as StringUtils } from '@shardus/types'
import { AccountType, Transaction, TransactionType, Receipt, Account } from '../types'
import { weiBNToEth } from '../class/StatsFunctions'

type DbReceipt = Receipt & {
  tx: string
  beforeStates: string
  afterStates: string
  appReceiptData: string | null
  signedReceipt: string
}

const RECEIPT_COLUMNS: readonly (keyof Receipt)[] = [
  'receiptId',
  'tx',
  'cycle',
  'applyTimestamp',
  'timestamp',
  'signedReceipt',
  'afterStates',
  'beforeStates',
  'appReceiptData',
  'globalModification',
] as const

export const receiptsMap: Map<string, number> = new Map()

export async function insertReceipt(receipt: Receipt): Promise<void> {
  try {
    const fields = `(${RECEIPT_COLUMNS.join(', ')})`
    // Create placeholders for one row
    const placeholders = `(${RECEIPT_COLUMNS.map(() => '?').join(', ')})`

    // Map the `receipt` object to match the columns
    const values = RECEIPT_COLUMNS.map((column) =>
      typeof receipt[column] === 'object'
        ? StringUtils.safeStringify(receipt[column]) // Serialize objects to JSON
        : receipt[column]
    )

    const sql = `INSERT OR REPLACE INTO receipts ${fields} VALUES ${placeholders}`
    await db.run(receiptDatabase, sql, values)
    if (config.verbose) console.log('Successfully inserted Receipt', receipt.receiptId)
  } catch (e) {
    console.log(e)
    console.log('Unable to insert Receipt or it is already stored in to database', receipt.receiptId)
  }
}

export async function bulkInsertReceipts(receipts: Receipt[]): Promise<void> {
  try {
    const fields = `(${RECEIPT_COLUMNS.join(', ')})`
    // Create placeholders for one row
    const placeholders = `(${RECEIPT_COLUMNS.map(() => '?').join(', ')})`
    // Create multiple placeholder groups for bulk insert
    const allPlaceholders = Array(receipts.length).fill(placeholders).join(', ')

    // Flatten the `receipts` array into a single list of values
    const values = receipts.flatMap((receipt) =>
      RECEIPT_COLUMNS.map((column) =>
        typeof receipt[column] === 'object'
          ? StringUtils.safeStringify(receipt[column]) // Serialize objects to JSON
          : receipt[column]
      )
    )

    const sql = `INSERT OR REPLACE INTO receipts ${fields} VALUES ${allPlaceholders}`
    await db.run(receiptDatabase, sql, values)
    console.log('Successfully bulk inserted receipts', receipts.length)
  } catch (e) {
    console.log(e)
    console.log('Unable to bulk insert receipts', receipts.length)
  }
}

export async function processReceiptData(receipts: Receipt[], saveOnlyNewData = false): Promise<void> {
  if (receipts && receipts.length <= 0) return
  const bucketSize = 1000
  let combineReceipts: Receipt[] = []
  let combineAccounts: Account[] = [] // For new accounts to bulk insert; Not for accounts that are already stored in database
  let combineTransactions: Transaction[] = []
  let accountHistoryStateList: AccountHistoryStateDB.AccountHistoryState[] = []
  for (const receiptObj of receipts) {
    const { afterStates, cycle, appReceiptData, tx, timestamp, signedReceipt } = receiptObj
    if (receiptsMap.has(tx.txId) && receiptsMap.get(tx.txId) === timestamp) {
      continue
    }
    const modifiedReceiptObj = {
      ...receiptObj,
      beforeStates: config.storeReceiptBeforeStates ? receiptObj.beforeStates : [],
    }
    if (saveOnlyNewData) {
      const receiptExist = await queryReceiptByReceiptId(tx.txId)
      if (!receiptExist) combineReceipts.push(modifiedReceiptObj as unknown as Receipt)
    } else combineReceipts.push(modifiedReceiptObj as unknown as Receipt)
    const txReceipt = appReceiptData
    receiptsMap.set(tx.txId, tx.timestamp)

    // Receipts size can be big, better to save per 100
    if (combineReceipts.length >= 100) {
      await bulkInsertReceipts(combineReceipts)
      combineReceipts = []
    }
    if (!config.processData.indexReceipt) continue
    for (const account of afterStates) {
      const accountType = account.data.type as AccountType // be sure to update with the correct field with the account type defined in the dapp
      const accObj: Account = {
        accountId: account.accountId,
        cycleNumber: cycle,
        timestamp: account.timestamp,
        data: account.data,
        hash: account.hash,
        accountType,
        isGlobal: account.isGlobal,
        createdTimestamp: account.timestamp, // Initial value - SQL triggers will preserve the oldest timestamp automatically
      }
      const index = combineAccounts.findIndex((a) => {
        return a.accountId === accObj.accountId
      })
      if (index > -1) {
        // eslint-disable-next-line security/detect-object-injection
        const accountExist = combineAccounts[index]
        if (accountExist.timestamp < accObj.timestamp) {
          accObj.createdTimestamp = accountExist.createdTimestamp // swap createdTimestamp of the old account
          combineAccounts.splice(index, 1)
          combineAccounts.push(accObj)
        }
      } else {
        const accountExist = await AccountDB.queryAccountByAccountId(accObj.accountId)
        if (config.verbose) console.log('accountExist', accountExist)
        if (!accountExist) {
          combineAccounts.push(accObj)
        } else {
          if (accountExist.timestamp < accObj.timestamp) {
            await AccountDB.updateAccount(accObj)
          }
          if (accObj.createdTimestamp < accountExist.createdTimestamp) {
            await AccountDB.updateCreatedTimestamp(accObj.accountId, accObj.createdTimestamp)
          }
        }
      }

      // if tx receipt is saved as an account, create tx object from the account and save it
      // if (accountType === AccountType.Receipt) {
      //   txReceipt = { ...accObj }
      // }
    }

    const txObj = {
      txId: tx.txId,
      cycleNumber: cycle,
      timestamp: tx.timestamp,
      originalTxData: tx.originalTxData || {},
    } as Transaction

    if (txReceipt) {
      txObj.transactionType = txReceipt.type as TransactionType // be sure to update with the correct field with the transaction type defined in the dapp
      txObj.txFrom = txReceipt.from // be sure to update with the correct field of the tx sender
      txObj.txTo = txReceipt.to // be sure to update with the correct field of the tx recipient
      txObj.txFee = weiBNToEth(txReceipt.transactionFee) || 0
      txObj.data = txReceipt
    } else {
      // Extract tx receipt from original tx data
      txObj.transactionType = tx.originalTxData.tx.type as TransactionType // be sure to update with the correct field with the transaction type defined in the dapp
      txObj.txFrom = tx.originalTxData.tx.from // be sure to update with the correct field of the tx sender
      txObj.txTo = tx.originalTxData.tx.to // be sure to update with the correct field of the tx recipient
      txObj.txFee = tx.originalTxData.tx.transactionFee || 0
      if (txObj.transactionType === TransactionType.create) {
        txObj.txFrom = tx.originalTxData.tx.from
        txObj.txTo = tx.originalTxData.tx.from
      }
      if (txObj.transactionType === TransactionType.register) {
        txObj.txFrom = tx.originalTxData.tx.from
        txObj.txTo = tx.originalTxData.tx.aliasHash
      }
      if (
        txObj.transactionType === TransactionType.deposit_stake ||
        txObj.transactionType === TransactionType.withdraw_stake
      ) {
        txObj.txFrom = tx.originalTxData.tx.nominator
        txObj.txTo = tx.originalTxData.tx.nominee
      } else if (txObj.transactionType === TransactionType.init_reward) {
        txObj.txFrom = tx.originalTxData.tx.nominee
        txObj.txTo = tx.originalTxData.tx.nominee
      } else if (
        txObj.transactionType === TransactionType.set_cert_time ||
        txObj.transactionType === TransactionType.claim_reward
      ) {
        txObj.txFrom = tx.originalTxData.tx.nominee
        txObj.txTo = tx.originalTxData.tx.nominator
      } else if (txObj.transactionType === TransactionType.apply_penalty) {
        txObj.txFrom = tx.originalTxData.tx.reportedNodePublickKey
        txObj.txTo = tx.originalTxData.tx.nominator
      } else if (txObj.transactionType === TransactionType.init_network) {
        txObj.txFrom = tx.originalTxData.tx.network
        txObj.txTo = tx.originalTxData.tx.network
      }
      txObj.data = {}
    }
    const transactionExist = await TransactionDB.queryTransactionByTxId(tx.txId)
    if (config.verbose) console.log('transactionExist', transactionExist)
    if (!transactionExist) {
      combineTransactions.push(txObj)
    } else if (transactionExist.timestamp < txObj.timestamp) {
      await TransactionDB.insertTransaction(txObj)
    }
    if (config.saveAccountHistoryState) {
      // Note: This has to be changed once we change the way the global modification tx consensus is updated
      if (
        receiptObj.globalModification === false &&
        signedReceipt &&
        signedReceipt.proposal.accountIDs.length > 0
      ) {
        for (let i = 0; i < signedReceipt.proposal.accountIDs.length; i++) {
          const accountId = signedReceipt.proposal.accountIDs[i]
          // Find the corresponding account in afterStates to get balance
          const afterStateAccount = afterStates.find((acc) => acc.accountId === accountId)
          let balance = 0
          if (afterStateAccount) {
            // Extract balance from account data - only UserAccounts have balance
            if (afterStateAccount.data?.data?.balance !== undefined) {
              balance = weiBNToEth(afterStateAccount.data.data.balance)
            }
          }
          const accountHistoryState = {
            accountId,
            beforeStateHash: signedReceipt.proposal.beforeStateHashes[i],
            afterStateHash: signedReceipt.proposal.afterStateHashes[i],
            timestamp,
            receiptId: tx.txId,
            balance,
          }
          accountHistoryStateList.push(accountHistoryState)
        }
      } else {
        if (receiptObj.globalModification === true) {
          console.log(`Receipt ${tx.txId} with timestamp ${timestamp} has globalModification as true`)
        }
        if (receiptObj.globalModification === false && !signedReceipt) {
          console.error(`Receipt ${tx.txId} with timestamp ${timestamp} has no signedReceipt`)
        }
      }
    }
    if (combineAccounts.length >= bucketSize) {
      await AccountDB.bulkInsertAccounts(combineAccounts)
      combineAccounts = []
    }
    if (combineTransactions.length >= bucketSize) {
      await TransactionDB.bulkInsertTransactions(combineTransactions)
      combineTransactions = []
    }
    if (accountHistoryStateList.length > bucketSize) {
      await AccountHistoryStateDB.bulkInsertAccountHistoryStates(accountHistoryStateList)
      accountHistoryStateList = []
    }
  }
  if (combineReceipts.length > 0) await bulkInsertReceipts(combineReceipts)
  if (combineAccounts.length > 0) await AccountDB.bulkInsertAccounts(combineAccounts)
  if (combineTransactions.length > 0) await TransactionDB.bulkInsertTransactions(combineTransactions)
  if (accountHistoryStateList.length > 0)
    await AccountHistoryStateDB.bulkInsertAccountHistoryStates(accountHistoryStateList)
}

export async function queryReceiptByReceiptId(receiptId: string): Promise<Receipt | null> {
  try {
    const sql = `SELECT * FROM receipts WHERE receiptId=?`
    const receipt = (await db.get(receiptDatabase, sql, [receiptId])) as DbReceipt
    if (receipt) deserializeDbReceipt(receipt)
    if (config.verbose) console.log('Receipt receiptId', receipt)
    return receipt as Receipt
  } catch (e) {
    console.log(e)
  }

  return null
}

type QueryReceiptCountParams = {
  startCycleNumber?: number
  endCycleNumber?: number
}

type QueryReceiptsParams = QueryReceiptCountParams & {
  skip?: number
  limit?: number /* default 10, set 0 for all */
}

export async function queryReceipts(query: QueryReceiptsParams): Promise<Receipt[]> {
  const { skip = 0, limit = 10, startCycleNumber, endCycleNumber } = query
  let receipts: DbReceipt[] = []
  try {
    let sql = `SELECT * FROM receipts`
    const values: unknown[] = []
    if (startCycleNumber || endCycleNumber) {
      sql += ` WHERE cycle BETWEEN ? AND ?`
      values.push(startCycleNumber, endCycleNumber)
    }
    if (startCycleNumber || endCycleNumber) {
      sql += ` ORDER BY cycle ASC, timestamp ASC`
    } else {
      sql += ` ORDER BY cycle DESC, timestamp DESC`
    }
    if (limit > 0) {
      sql += ` LIMIT ${limit}`
    }
    if (skip > 0) {
      sql += ` OFFSET ${skip}`
    }
    receipts = (await db.all(receiptDatabase, sql, values)) as DbReceipt[]
    receipts.forEach((receipt: DbReceipt) => deserializeDbReceipt(receipt))
  } catch (e) {
    console.log(e)
  }
  if (config.verbose) console.log('Receipt receipts', receipts ? receipts.length : receipts, 'skip', skip)

  return receipts
}

export async function queryReceiptCount(query: QueryReceiptCountParams | null = null): Promise<number> {
  const { startCycleNumber, endCycleNumber } = query ?? {}
  let receipts: { 'COUNT(*)': number } = { 'COUNT(*)': 0 }
  try {
    let sql = `SELECT COUNT(*) FROM receipts`
    const values: unknown[] = []
    if (startCycleNumber || endCycleNumber) {
      sql += ` WHERE cycle BETWEEN ? AND ?`
      values.push(startCycleNumber, endCycleNumber)
    }
    receipts = (await db.get(receiptDatabase, sql, values)) as { 'COUNT(*)': number }
  } catch (e) {
    console.log(e)
  }
  if (config.verbose) console.log('Receipt count', receipts)

  return receipts['COUNT(*)'] || 0
}

export async function queryReceiptCountByCycles(
  start: number,
  end: number
): Promise<{ receipts: number; cycle: number }[]> {
  let receipts: { cycle: number; 'COUNT(*)': number }[] = []
  try {
    const sql = `SELECT cycle, COUNT(*) FROM receipts GROUP BY cycle HAVING cycle BETWEEN ? AND ? ORDER BY cycle ASC`
    receipts = (await db.all(receiptDatabase, sql, [start, end])) as { cycle: number; 'COUNT(*)': number }[]
  } catch (e) {
    console.log(e)
  }
  if (config.verbose) console.log('Receipt count by cycles', receipts)

  return receipts.map((receipt) => {
    return {
      receipts: receipt['COUNT(*)'],
      cycle: receipt.cycle,
    }
  })
}

function deserializeDbReceipt(receipt: DbReceipt): void {
  receipt.tx &&= StringUtils.safeJsonParse(receipt.tx)
  receipt.beforeStates &&= StringUtils.safeJsonParse(receipt.beforeStates)
  receipt.afterStates &&= StringUtils.safeJsonParse(receipt.afterStates)
  receipt.appReceiptData &&= StringUtils.safeJsonParse(receipt.appReceiptData)
  receipt.signedReceipt &&= StringUtils.safeJsonParse(receipt.signedReceipt)

  // globalModification is stored as 0 or 1 in the database, convert it to boolean
  receipt.globalModification = (receipt.globalModification as unknown as number) === 1
}

export function cleanOldReceiptsMap(timestamp: number): void {
  for (const [key, value] of receiptsMap) {
    if (value < timestamp) receiptsMap.delete(key)
  }
  if (config.verbose) console.log('Clean Old Receipts Map', timestamp, receiptsMap)
}
