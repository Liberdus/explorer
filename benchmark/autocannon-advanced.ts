/**
 * Advanced autocannon testing with data from JSON files
 * This script loads test data and randomly queries different IDs
 *
 * Run: npm run benchmark:autocannon-advanced
 */

import autocannon from 'autocannon'
import * as fs from 'fs'
import * as path from 'path'

interface TestData {
  accountIds: string[]
  txIds: string[]
  receiptIds: string[]
  cycleNumbers: number[]
}

function loadTestData(): TestData {
  const dataPath = path.join(__dirname, '../benchmark-data/test-data.json')

  if (!fs.existsSync(dataPath)) {
    console.error('❌ Test data not found!')
    console.error('Run: npm run benchmark:export-data')
    process.exit(1)
  }

  const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'))
  console.log('✓ Loaded test data:')
  console.log(`  - ${data.accountIds.length} account IDs`)
  console.log(`  - ${data.txIds.length} transaction IDs`)
  console.log(`  - ${data.receiptIds.length} receipt IDs`)
  console.log(`  - ${data.cycleNumbers.length} cycle numbers\n`)

  return data
}

async function runAccountTest(testData: TestData, baseUrl: string): Promise<any> {
  console.log('🔥 Test 1: Account Queries (Random IDs)\n')

  let requestCount = 0

  const result: any = await autocannon({
    url: baseUrl,
    connections: 100,
    duration: 30,
    setupClient: (client: any) => {
      client.on('response', () => {
        requestCount++
        if (requestCount % 1000 === 0) {
          process.stdout.write(`\rRequests sent: ${requestCount}`)
        }
      })
    },
    requests: [
      {
        method: 'GET',
        // This function is called for each request, returning different IDs
        setupRequest: (req: any) => {
          const randomId = testData.accountIds[Math.floor(Math.random() * testData.accountIds.length)]
          return {
            ...req,
            path: `/api/account?accountId=${randomId}`,
          }
        },
      },
    ],
  })

  console.log('\n\n✓ Account Test Results:')
  console.log(`  Requests/sec:  ${result.requests.average.toFixed(2)}`)
  console.log(`  Latency (avg): ${result.latency.mean.toFixed(2)}ms`)
  console.log(`  Latency (p95): ${result.latency.p97_5.toFixed(2)}ms`)
  console.log(`  Latency (p99): ${result.latency.p99.toFixed(2)}ms`)
  console.log(`  Total requests: ${requestCount}`)
  console.log(`  Errors: ${result.errors}`)

  return result
}

async function runTransactionTest(testData: TestData, baseUrl: string): Promise<any> {
  console.log('\n\n🔥 Test 2: Transaction Queries (Random IDs)\n')

  let requestCount = 0

  const result: any = await autocannon({
    url: baseUrl,
    connections: 100,
    duration: 30,
    setupClient: (client: any) => {
      client.on('response', () => {
        requestCount++
        if (requestCount % 1000 === 0) {
          process.stdout.write(`\rRequests sent: ${requestCount}`)
        }
      })
    },
    requests: [
      {
        method: 'GET',
        setupRequest: (req: any) => {
          const randomId = testData.txIds[Math.floor(Math.random() * testData.txIds.length)]
          return {
            ...req,
            path: `/api/transaction?txId=${randomId}`,
          }
        },
      },
    ],
  })

  console.log('\n\n✓ Transaction Test Results:')
  console.log(`  Requests/sec:  ${result.requests.average.toFixed(2)}`)
  console.log(`  Latency (avg): ${result.latency.mean.toFixed(2)}ms`)
  console.log(`  Latency (p95): ${result.latency.p97_5.toFixed(2)}ms`)
  console.log(`  Latency (p99): ${result.latency.p99.toFixed(2)}ms`)
  console.log(`  Total requests: ${requestCount}`)
  console.log(`  Errors: ${result.errors}`)

  return result
}

async function runMixedTest(testData: TestData, baseUrl: string): Promise<any> {
  console.log('\n\n🔥 Test 3: Mixed Load (50% Accounts, 50% Transactions)\n')

  let requestCount = 0
  let accountRequests = 0
  let txRequests = 0

  const result: any = await autocannon({
    url: baseUrl,
    connections: 100,
    duration: 60,
    setupClient: (client: any) => {
      client.on('response', () => {
        requestCount++
        if (requestCount % 1000 === 0) {
          process.stdout.write(
            `\rRequests: ${requestCount} (Accounts: ${accountRequests}, Txs: ${txRequests})`
          )
        }
      })
    },
    requests: [
      {
        method: 'GET',
        setupRequest: (req: any) => {
          // 50% chance for each type
          if (Math.random() < 0.5) {
            const randomId = testData.accountIds[Math.floor(Math.random() * testData.accountIds.length)]
            accountRequests++
            return {
              ...req,
              path: `/api/account?accountId=${randomId}`,
            }
          } else {
            const randomId = testData.txIds[Math.floor(Math.random() * testData.txIds.length)]
            txRequests++
            return {
              ...req,
              path: `/api/transaction?txId=${randomId}`,
            }
          }
        },
      },
    ],
  })

  console.log('\n\n✓ Mixed Test Results:')
  console.log(`  Requests/sec:  ${result.requests.average.toFixed(2)}`)
  console.log(`  Latency (avg): ${result.latency.mean.toFixed(2)}ms`)
  console.log(`  Latency (p95): ${result.latency.p97_5.toFixed(2)}ms`)
  console.log(`  Latency (p99): ${result.latency.p99.toFixed(2)}ms`)
  console.log(`  Total requests: ${requestCount}`)
  console.log(
    `  Account queries: ${accountRequests} (${((accountRequests / requestCount) * 100).toFixed(1)}%)`
  )
  console.log(`  Transaction queries: ${txRequests} (${((txRequests / requestCount) * 100).toFixed(1)}%)`)
  console.log(`  Errors: ${result.errors}`)

  return result
}

async function main(): Promise<void> {
  const baseUrl = process.env.API_URL || 'http://127.0.0.1:6001'
  const testType = process.argv[2] || 'all'

  console.log('='.repeat(70))
  console.log('autocannon Advanced Load Test')
  console.log('='.repeat(70))
  console.log(`Target: ${baseUrl}`)
  console.log(`Test type: ${testType}\n`)

  const testData = loadTestData()

  switch (testType) {
    case 'accounts':
      await runAccountTest(testData, baseUrl)
      break
    case 'transactions':
      await runTransactionTest(testData, baseUrl)
      break
    case 'mixed':
      await runMixedTest(testData, baseUrl)
      break
    case 'all':
      await runAccountTest(testData, baseUrl)
      await new Promise((resolve) => setTimeout(resolve, 5000))
      await runTransactionTest(testData, baseUrl)
      await new Promise((resolve) => setTimeout(resolve, 5000))
      await runMixedTest(testData, baseUrl)
      break
    default:
      console.error(`Unknown test type: ${testType}`)
      console.error('Valid types: accounts, transactions, mixed, all')
      process.exit(1)
  }

  console.log('\n' + '='.repeat(70))
  console.log('All tests complete!')
  console.log('='.repeat(70))
  process.exit(0)
}

main().catch((error) => {
  console.error('Test failed:', error)
  process.exit(1)
})
