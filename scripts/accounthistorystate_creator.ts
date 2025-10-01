import * as Storage from '../src/storage'
import * as ReceiptDB from '../src/storage/receipt'
import * as AccountHistoryStateDB from '../src/storage/accountHistoryState'

const start = async (): Promise<void> => {
  await Storage.initializeDB()

  const accountMap = new Map()

  const receiptsCount = await ReceiptDB.queryReceiptCount()
  console.log('receiptsCount', receiptsCount)
  const limit = 100
  const bucketSize = 1000
  for (let i = 0; i < receiptsCount; i += limit) {
    console.log(i, i + limit)
    const receipts = await ReceiptDB.queryReceipts({
      skip: i,
      limit,
    })
    let accountHistoryStateList: AccountHistoryStateDB.AccountHistoryState[] = []
    for (const receipt of receipts) {
      const { signedReceipt, globalModification, receiptId } = receipt
      if (globalModification === false && signedReceipt.proposal.accountIDs.length > 0) {
        for (let i = 0; i < receipt.afterStates!.length; i++) {
          const accountHistoryState: AccountHistoryStateDB.AccountHistoryState = {
            accountId: receipt.afterStates!.at(i)!.accountId,
            beforeStateHash: signedReceipt.proposal.beforeStateHashes.at(i)!,
            afterStateHash: signedReceipt.proposal.afterStateHashes.at(i)!,
            timestamp: receipt.timestamp,
            receiptId,
          }
          if (accountMap.has(accountHistoryState.accountId)) {
            if (accountMap.get(accountHistoryState.accountId) !== accountHistoryState.beforeStateHash) {
              console.log(
                `accountId ${accountHistoryState.accountId} in receipt ${receiptId} has different beforeStateHash`
              )
            }
          }
          accountMap.set(accountHistoryState.accountId, accountHistoryState.afterStateHash)
          accountHistoryStateList.push(accountHistoryState)
        }
      } else {
        if (globalModification === true) {
          console.log(`Receipt ${receiptId} has globalModification as true`)
        }
        if (globalModification === false && !signedReceipt) {
          console.error(`Receipt ${receiptId} has no signedReceipt`)
        }
      }
      if (accountHistoryStateList.length >= bucketSize) {
        await AccountHistoryStateDB.bulkInsertAccountHistoryStates(accountHistoryStateList)
        accountHistoryStateList = []
      }
    }
    if (accountHistoryStateList.length > 0) {
      await AccountHistoryStateDB.bulkInsertAccountHistoryStates(accountHistoryStateList)
      accountHistoryStateList = []
    }
  }
  const accountHistoryStateCount = await AccountHistoryStateDB.queryAccountHistoryStateCount()
  console.log('accountHistoryStateCount', accountHistoryStateCount)
  await Storage.closeDatabase()
}

start()
