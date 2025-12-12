import * as Storage from '../src/storage'
import {
  AccountDB,
  CycleDB,
  TransactionDB,
  ReceiptDB,
} from '../src/storage'

export interface TestData {
  accountIds: string[]
  txIds: string[]
  receiptIds: string[]
  cycleNumbers: number[]
  cycleMarkers: string[]
  validAccountId: string
  validTxId: string
  validReceiptId: string
  latestCycle: number
}

export async function collectTestData(sampleSize = 100000): Promise<TestData> {
  console.log('Collecting test data from database...')

  await Storage.initializeDB()

  const testData: TestData = {
    accountIds: [],
    txIds: [],
    receiptIds: [],
    cycleNumbers: [],
    cycleMarkers: [],
    validAccountId: '',
    validTxId: '',
    validReceiptId: '',
    latestCycle: 0,
  }

  try {
    // Collect account IDs (only select accountId field for performance)
    console.log('Fetching account IDs...')
    const accounts = await AccountDB.queryAccounts({ limit: sampleSize, random: true, select: 'accountId' })
    testData.accountIds = accounts.map(acc => acc.accountId).filter(Boolean)
    if (testData.accountIds.length > 0) {
      testData.validAccountId = testData.accountIds[0]
    }
    console.log(`  ✓ Collected ${testData.accountIds.length} account IDs`)

    // Collect transaction IDs (only select txId field for performance)
    console.log('Fetching transaction IDs...')
    const transactions = await TransactionDB.queryTransactions({ limit: sampleSize, random: true, select: 'txId' })
    testData.txIds = transactions.map(tx => tx.txId).filter(Boolean)
    if (testData.txIds.length > 0) {
      testData.validTxId = testData.txIds[0]
    }
    console.log(`  ✓ Collected ${testData.txIds.length} transaction IDs`)

    // Collect receipt IDs (only select receiptId field for performance)
    console.log('Fetching receipt IDs...')
    const receipts = await ReceiptDB.queryReceipts({ limit: sampleSize, random: true, select: 'receiptId' })
    testData.receiptIds = receipts.map(r => r.receiptId).filter(Boolean)
    if (testData.receiptIds.length > 0) {
      testData.validReceiptId = testData.receiptIds[0]
    }
    console.log(`  ✓ Collected ${testData.receiptIds.length} receipt IDs`)

    // Collect cycle data (only select counter and cycleMarker fields for performance)
    console.log('Fetching cycle data...')
    const cycles = await CycleDB.queryLatestCycleRecords(sampleSize, true, ['counter', 'cycleMarker'])
    testData.cycleNumbers = cycles.map(c => c.counter).filter(n => n !== undefined)
    testData.cycleMarkers = cycles.map(c => c.cycleMarker as string).filter(Boolean)

    if (testData.cycleNumbers.length > 0) {
      testData.latestCycle = Math.max(...testData.cycleNumbers)
    }
    console.log(`  ✓ Collected ${testData.cycleNumbers.length} cycle numbers`)
    console.log(`  ✓ Collected ${testData.cycleMarkers.length} cycle markers`)
    console.log(`  ✓ Latest cycle: ${testData.latestCycle}`)

    // Validation
    console.log('\nTest data summary:')
    console.log(`  Accounts: ${testData.accountIds.length}`)
    console.log(`  Transactions: ${testData.txIds.length}`)
    console.log(`  Receipts: ${testData.receiptIds.length}`)
    console.log(`  Cycles: ${testData.cycleNumbers.length}`)
    console.log(`  Markers: ${testData.cycleMarkers.length}`)

    if (testData.accountIds.length === 0) {
      console.warn('⚠️  Warning: No accounts found in database')
    }
    if (testData.txIds.length === 0) {
      console.warn('⚠️  Warning: No transactions found in database')
    }
    if (testData.cycleNumbers.length === 0) {
      console.warn('⚠️  Warning: No cycles found in database')
    }

  } catch (error) {
    console.error('Error collecting test data:', error)
    throw error
  } finally {
    await Storage.closeDatabase()
  }

  return testData
}

export function getRandomItem<T>(array: T[]): T | null {
  if (array.length === 0) return null
  return array[Math.floor(Math.random() * array.length)]
}

export function getRandomItems<T>(array: T[], count: number): T[] {
  if (array.length === 0) return []
  const shuffled = [...array].sort(() => 0.5 - Math.random())
  return shuffled.slice(0, Math.min(count, array.length))
}

// CLI interface
if (require.main === module) {
  const sampleSize = process.argv[2] ? parseInt(process.argv[2]) : 100000

  collectTestData(sampleSize)
    .then(data => {
      console.log('\n✓ Test data collection complete!')
      console.log('\nSample data:')
      console.log(`  Account ID: ${data.validAccountId}`)
      console.log(`  Transaction ID: ${data.validTxId}`)
      console.log(`  Receipt ID: ${data.validReceiptId}`)
      console.log(`  Latest Cycle: ${data.latestCycle}`)
      if (data.cycleMarkers.length > 0) {
        console.log(`  Sample Marker: ${data.cycleMarkers[0]}`)
      }
      process.exit(0)
    })
    .catch(error => {
      console.error('Failed to collect test data:', error)
      process.exit(1)
    })
}
