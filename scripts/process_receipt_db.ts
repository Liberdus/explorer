import * as Storage from '../src/storage'
import * as ReceiptDB from '../src/storage/receipt'

const start = async (): Promise<void> => {
  await Storage.initializeDB()

  const receiptsCount = await ReceiptDB.queryReceiptCount()
  console.log('receiptsCount', receiptsCount)
  const limit = 1000
  for (let i = 0; i < receiptsCount; i += limit) {
    console.log(i, i + limit)
    const receipts = await ReceiptDB.queryReceipts({
      skip: i,
      limit,
    })
    await ReceiptDB.processReceiptData(receipts, true)
  }
  await Storage.closeDatabase()
}

start()
