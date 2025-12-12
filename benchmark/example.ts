/**
 * Example: Quick benchmark of key endpoints
 *
 * This demonstrates how to run a focused benchmark on critical endpoints
 * without running the full test suite.
 */

import autocannon from 'autocannon'
import { collectTestData } from './data-collector'

// Configuration
const SAMPLE_SIZE = parseInt(process.env.SAMPLE_SIZE || '100000')
const CONNECTIONS = parseInt(process.env.CONNECTIONS || '100')
const DURATION = parseInt(process.env.DURATION || '30')
const BASE_URL = process.env.API_URL || 'http://127.0.0.1:6001'

async function quickBenchmark(): Promise<void> {
  console.log('Quick Benchmark - Testing Critical Endpoints\n')
  console.log(`Configuration:`)
  console.log(`  Sample size:  ${SAMPLE_SIZE} IDs per endpoint`)
  console.log(`  Connections:  ${CONNECTIONS}`)
  console.log(`  Duration:     ${DURATION}s per test`)
  console.log(`  Target:       ${BASE_URL}`)
  console.log('')

  // Collect real data from database
  const testData = await collectTestData(SAMPLE_SIZE)

  if (!testData.txIds.length || !testData.accountIds.length) {
    console.error('❌ No test data available. Run the collector first.')
    process.exit(1)
  }

  // Test 1: Transaction by ID (most critical query)
  const totalTxIds = testData.txIds.length
  console.log(`Testing: GET /api/transaction?txId=... (rotating through ${totalTxIds} different IDs)\n`)

  const txResult: any = await autocannon({
    url: BASE_URL,
    connections: CONNECTIONS,
    duration: DURATION,
    requests: [
      {
        method: 'GET',
        setupRequest: (req: any) => {
          // Pick a different random txId for each request
          const randomTxId = testData.txIds[Math.floor(Math.random() * totalTxIds)]
          return {
            ...req,
            path: `/api/transaction?txId=${randomTxId}`,
          }
        },
      },
    ],
  })

  console.log(`\nTransaction Query Results (rotating ${totalTxIds} IDs):`)
  console.log(`  Requests/sec: ${txResult.requests.average}`)
  console.log(`  Latency p99:  ${txResult.latency.p99}ms`)

  // Test 2: Account by ID
  const totalAccountIds = testData.accountIds.length
  console.log(
    `\n\nTesting: GET /api/account?accountId=... (rotating through ${totalAccountIds} different IDs)\n`
  )

  const accountResult: any = await autocannon({
    url: BASE_URL,
    connections: CONNECTIONS,
    duration: DURATION,
    requests: [
      {
        method: 'GET',
        setupRequest: (req: any) => {
          // Pick a different random accountId for each request
          const randomAccountId = testData.accountIds[Math.floor(Math.random() * totalAccountIds)]
          return {
            ...req,
            path: `/api/account?accountId=${randomAccountId}`,
          }
        },
      },
    ],
  })

  console.log(`\nAccount Query Results (rotating ${totalAccountIds} IDs):`)
  console.log(`  Requests/sec: ${accountResult.requests.average}`)
  console.log(`  Latency p99:  ${accountResult.latency.p99}ms`)

  // Test 3: Total Data endpoint
  console.log('\n\nTesting: GET /totalData (same endpoint, no ID variation)\n')

  const totalDataResult: any = await autocannon({
    url: `${BASE_URL}/totalData`,
    connections: CONNECTIONS,
    duration: DURATION,
  })

  console.log('\nTotal Data Results:')
  console.log(`  Requests/sec: ${totalDataResult.requests.average}`)
  console.log(`  Latency p99:  ${totalDataResult.latency.p99}ms`)

  // Summary
  console.log('\n' + '='.repeat(60))
  console.log('QUICK BENCHMARK SUMMARY')
  console.log('='.repeat(60))
  console.log(`Transaction query: ${txResult.requests.average.toFixed(0)} req/s`)
  console.log(`Account query:     ${accountResult.requests.average.toFixed(0)} req/s`)
  console.log(`Total data:        ${totalDataResult.requests.average.toFixed(0)} req/s`)

  // Performance check
  if (txResult.latency.p99 > 500) {
    console.log('\n⚠️  Warning: Transaction queries are slow (p99 > 500ms)')
  } else {
    console.log('\n✅ All endpoints performing well')
  }

  process.exit(0)
}

quickBenchmark().catch((error) => {
  console.error('Benchmark failed:', error)
  process.exit(1)
})
