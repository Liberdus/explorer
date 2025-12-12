import autocannon from 'autocannon'
import { collectTestData, getRandomItem, TestData } from './data-collector'

interface BenchmarkResult {
  name: string
  url: string
  requestsPerSec: number
  latencyAvg: number
  latencyP50: number
  latencyP95: number
  latencyP99: number
  throughputMBs: number
  errors: number
  timeouts: number
  duration: number
  connections: number
}

interface BenchmarkTest {
  name: string
  urlGenerator: (data: TestData) => string | string[]
  connections: number
  duration: number
  pipelining?: number
  description?: string
}

const tests: BenchmarkTest[] = [
  // Basic endpoints
  {
    name: 'Total Data Endpoint',
    urlGenerator: () => '/totalData',
    connections: 100,
    duration: 30,
    description: 'Tests the aggregate data endpoint',
  },
  {
    name: 'Port Endpoint',
    urlGenerator: () => '/port',
    connections: 50,
    duration: 10,
    description: 'Simple port endpoint test',
  },

  // Cycle endpoints
  {
    name: 'Cycle Info - Latest (count=10)',
    urlGenerator: () => '/api/cycleinfo?count=10',
    connections: 100,
    duration: 30,
    description: 'Query latest 10 cycles',
  },
  {
    name: 'Cycle Info - Latest (count=50)',
    urlGenerator: () => '/api/cycleinfo?count=50',
    connections: 100,
    duration: 30,
    description: 'Query latest 50 cycles',
  },
  {
    name: 'Cycle Info - By Number',
    urlGenerator: (data) => {
      const cycleNum = getRandomItem(data.cycleNumbers)
      return cycleNum !== null ? `/api/cycleinfo?cycleNumber=${cycleNum}` : '/api/cycleinfo?count=1'
    },
    connections: 100,
    duration: 30,
    description: 'Query specific cycle by number',
  },
  {
    name: 'Cycle Info - By Marker',
    urlGenerator: (data) => {
      const marker = getRandomItem(data.cycleMarkers)
      return marker !== null ? `/api/cycleinfo?marker=${marker}` : '/api/cycleinfo?count=1'
    },
    connections: 100,
    duration: 30,
    description: 'Query cycle by marker',
  },
  {
    name: 'Cycle Info - Range Query',
    urlGenerator: (data) => {
      if (data.latestCycle > 100) {
        const endCycle = data.latestCycle
        const startCycle = endCycle - 50
        return `/api/cycleinfo?startCycle=${startCycle}&endCycle=${endCycle}`
      }
      return '/api/cycleinfo?count=10'
    },
    connections: 50,
    duration: 30,
    description: 'Query cycle range (50 cycles)',
  },

  // Account endpoints
  {
    name: 'Account - Latest (count=10)',
    urlGenerator: () => '/api/account?count=10',
    connections: 100,
    duration: 30,
    description: 'Query latest 10 accounts',
  },
  {
    name: 'Account - By ID',
    urlGenerator: (data) => {
      const accountId = getRandomItem(data.accountIds)
      return accountId !== null ? `/api/account?accountId=${accountId}` : '/api/account?count=1'
    },
    connections: 150,
    duration: 30,
    description: 'Query specific account by ID (most common query)',
  },
  {
    name: 'Account - Paginated',
    urlGenerator: () => {
      const page = Math.floor(Math.random() * 10) + 1
      return `/api/account?page=${page}`
    },
    connections: 50,
    duration: 30,
    description: 'Query accounts with pagination',
  },

  // Transaction endpoints
  {
    name: 'Transaction - Latest (count=10)',
    urlGenerator: () => '/api/transaction?count=10',
    connections: 100,
    duration: 30,
    description: 'Query latest 10 transactions',
  },
  {
    name: 'Transaction - Latest (count=50)',
    urlGenerator: () => '/api/transaction?count=50',
    connections: 100,
    duration: 30,
    description: 'Query latest 50 transactions',
  },
  {
    name: 'Transaction - By TxId',
    urlGenerator: (data) => {
      const txId = getRandomItem(data.txIds)
      return txId !== null ? `/api/transaction?txId=${txId}` : '/api/transaction?count=1'
    },
    connections: 150,
    duration: 30,
    description: 'Query specific transaction by ID (critical path)',
  },
  {
    name: 'Transaction - By TxId with Balance Changes',
    urlGenerator: (data) => {
      const txId = getRandomItem(data.txIds)
      return txId !== null ? `/api/transaction?txId=${txId}&balanceChanges=true` : '/api/transaction?count=1'
    },
    connections: 100,
    duration: 30,
    description: 'Query transaction with balance changes (heavier query)',
  },
  {
    name: 'Transaction - By AccountId',
    urlGenerator: (data) => {
      const accountId = getRandomItem(data.accountIds)
      return accountId !== null ? `/api/transaction?accountId=${accountId}` : '/api/transaction?count=1'
    },
    connections: 100,
    duration: 30,
    description: 'Query transactions for specific account',
  },
  {
    name: 'Transaction - Total Details',
    urlGenerator: () => '/api/transaction?totalTxsDetail=true',
    connections: 50,
    duration: 20,
    description: 'Query transaction statistics by type',
  },

  // Receipt endpoints
  {
    name: 'Receipt - Latest (count=10)',
    urlGenerator: () => '/api/receipt?count=10',
    connections: 100,
    duration: 30,
    description: 'Query latest 10 receipts',
  },
  {
    name: 'Receipt - By TxId',
    urlGenerator: (data) => {
      const receiptId = getRandomItem(data.receiptIds)
      return receiptId !== null ? `/api/receipt?txId=${receiptId}` : '/api/receipt?count=1'
    },
    connections: 100,
    duration: 30,
    description: 'Query specific receipt by transaction ID',
  },

  // Stats endpoints
  {
    name: 'Stats - Validator (count=100, array)',
    urlGenerator: () => '/api/stats/validator?count=100&responseType=array',
    connections: 100,
    duration: 30,
    description: 'Query validator stats (used for charts)',
  },
  {
    name: 'Stats - Validator (count=1000, array)',
    urlGenerator: () => '/api/stats/validator?count=1000&responseType=array',
    connections: 50,
    duration: 30,
    description: 'Query validator stats (heavy query, cached)',
  },
  {
    name: 'Stats - Transaction (count=100, array)',
    urlGenerator: () => '/api/stats/transaction?count=100&responseType=array',
    connections: 100,
    duration: 30,
    description: 'Query transaction stats',
  },
  {
    name: 'Stats - Transaction (last 14 days)',
    urlGenerator: () => '/api/stats/transaction?last14DaysTxsReport=true&responseType=array',
    connections: 100,
    duration: 30,
    description: 'Query daily transaction report',
  },
  {
    name: 'Stats - Transaction Summary',
    urlGenerator: () => '/api/stats/transaction?fetchTransactionStats=true',
    connections: 100,
    duration: 20,
    description: 'Query transaction statistics summary',
  },
  {
    name: 'Stats - Account Summary',
    urlGenerator: () => '/api/stats/account?fetchAccountStats=true',
    connections: 100,
    duration: 20,
    description: 'Query account statistics summary',
  },
  {
    name: 'Stats - Coin',
    urlGenerator: () => '/api/stats/coin?fetchCoinStats=true',
    connections: 100,
    duration: 20,
    description: 'Query coin statistics',
  },
  {
    name: 'Stats - Network',
    urlGenerator: () => '/api/stats/network',
    connections: 100,
    duration: 20,
    description: 'Query network statistics',
  },
]

async function runSingleBenchmark(
  test: BenchmarkTest,
  testData: TestData,
  baseUrl: string
): Promise<BenchmarkResult> {
  console.log(`\n${'='.repeat(70)}`)
  console.log(`Running: ${test.name}`)
  if (test.description) {
    console.log(`Description: ${test.description}`)
  }
  console.log('='.repeat(70))

  const url = test.urlGenerator(testData)
  const fullUrl = Array.isArray(url) ? url.map((u) => `${baseUrl}${u}`) : `${baseUrl}${url}`

  return new Promise((resolve, reject) => {
    const config: autocannon.Options = {
      url: Array.isArray(fullUrl) ? fullUrl[0] : fullUrl,
      connections: test.connections,
      duration: test.duration,
      pipelining: test.pipelining || 1,
    }

    autocannon(config, (err, result) => {
      if (err) {
        console.error('Error:', err)
        reject(err)
        return
      }

      const benchResult: BenchmarkResult = {
        name: test.name,
        url: Array.isArray(url) ? url.join(', ') : url,
        requestsPerSec: result.requests.average,
        latencyAvg: result.latency.mean,
        latencyP50: result.latency.p50,
        latencyP95: result.latency.p97_5,
        latencyP99: result.latency.p99,
        throughputMBs: result.throughput.average / 1024 / 1024,
        errors: result.errors,
        timeouts: result.timeouts,
        duration: test.duration,
        connections: test.connections,
      }

      console.log(`\n✓ Results:`)
      console.log(`  Requests/sec:  ${benchResult.requestsPerSec.toFixed(2)}`)
      console.log(`  Latency (avg): ${benchResult.latencyAvg.toFixed(2)}ms`)
      console.log(`  Latency (p50): ${benchResult.latencyP50.toFixed(2)}ms`)
      console.log(`  Latency (p95): ${benchResult.latencyP95.toFixed(2)}ms`)
      console.log(`  Latency (p99): ${benchResult.latencyP99.toFixed(2)}ms`)
      console.log(`  Throughput:    ${benchResult.throughputMBs.toFixed(2)} MB/s`)
      console.log(`  Errors:        ${benchResult.errors}`)
      console.log(`  Timeouts:      ${benchResult.timeouts}`)

      resolve(benchResult)
    })
  })
}

function printSummary(results: BenchmarkResult[]): void {
  console.log('\n\n')
  console.log('═'.repeat(120))
  console.log('BENCHMARK SUMMARY')
  console.log('═'.repeat(120))
  console.log(
    `${'Test Name'.padEnd(50)} | ${'Req/s'.padStart(10)} | ${'Avg(ms)'.padStart(10)} | ${'P95(ms)'.padStart(
      10
    )} | ${'P99(ms)'.padStart(10)} | ${'Errors'.padStart(8)}`
  )
  console.log('─'.repeat(120))

  results.forEach((result) => {
    console.log(
      `${result.name.padEnd(50)} | ${result.requestsPerSec.toFixed(2).padStart(10)} | ${result.latencyAvg
        .toFixed(2)
        .padStart(10)} | ${result.latencyP95.toFixed(2).padStart(10)} | ${result.latencyP99
        .toFixed(2)
        .padStart(10)} | ${result.errors.toString().padStart(8)}`
    )
  })

  console.log('═'.repeat(120))

  // Calculate aggregate stats
  const totalRequests = results.reduce((sum, r) => sum + r.requestsPerSec * r.duration, 0)
  const avgLatency = results.reduce((sum, r) => sum + r.latencyAvg, 0) / results.length
  const totalErrors = results.reduce((sum, r) => sum + r.errors, 0)

  console.log('\nAggregate Statistics:')
  console.log(`  Total tests run:       ${results.length}`)
  console.log(`  Total requests:        ${totalRequests.toFixed(0)}`)
  console.log(`  Average latency:       ${avgLatency.toFixed(2)}ms`)
  console.log(`  Total errors:          ${totalErrors}`)

  // Identify slowest endpoints
  const slowest = [...results].sort((a, b) => b.latencyP99 - a.latencyP99).slice(0, 3)
  console.log('\n⚠️  Slowest endpoints (p99 latency):')
  slowest.forEach((result, i) => {
    console.log(`  ${i + 1}. ${result.name}: ${result.latencyP99.toFixed(2)}ms`)
  })

  // Identify highest throughput
  const fastest = [...results].sort((a, b) => b.requestsPerSec - a.requestsPerSec).slice(0, 3)
  console.log('\n✓ Highest throughput endpoints:')
  fastest.forEach((result, i) => {
    console.log(`  ${i + 1}. ${result.name}: ${result.requestsPerSec.toFixed(2)} req/s`)
  })

  console.log('\n')
}

async function runBenchmarkSuite(options: {
  baseUrl?: string
  delayBetweenTests?: number
  testsToRun?: string[]
  sampleSize?: number
}): Promise<BenchmarkResult[]> {
  const {
    baseUrl = 'http://127.0.0.1:6001',
    delayBetweenTests = 5000,
    testsToRun,
    sampleSize = 100000,
  } = options

  console.log('═'.repeat(70))
  console.log('LIBERDUS EXPLORER API BENCHMARK SUITE')
  console.log('═'.repeat(70))
  console.log(`Base URL: ${baseUrl}`)
  console.log(`Sample size: ${sampleSize}`)
  console.log(`Delay between tests: ${delayBetweenTests}ms`)
  console.log('═'.repeat(70))

  // Collect test data
  const testData = await collectTestData(sampleSize)

  // Filter tests if specified
  let testsToExecute = tests
  if (testsToRun && testsToRun.length > 0) {
    testsToExecute = tests.filter((test) =>
      testsToRun.some((name) => test.name.toLowerCase().includes(name.toLowerCase()))
    )
    console.log(`\nRunning ${testsToExecute.length} filtered tests`)
  } else {
    console.log(`\nRunning all ${testsToExecute.length} tests`)
  }

  const results: BenchmarkResult[] = []

  for (let i = 0; i < testsToExecute.length; i++) {
    const test = testsToExecute[i]
    console.log(`\n[${i + 1}/${testsToExecute.length}]`)

    try {
      const result = await runSingleBenchmark(test, testData, baseUrl)
      results.push(result)
    } catch (error) {
      console.error(`Failed to run test: ${test.name}`, error)
    }

    // Wait between tests to let the server recover
    if (i < testsToExecute.length - 1) {
      console.log(`\nWaiting ${delayBetweenTests / 1000}s before next test...`)
      await new Promise((resolve) => setTimeout(resolve, delayBetweenTests))
    }
  }

  printSummary(results)

  return results
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2)
  const baseUrl = args.find((arg) => arg.startsWith('--url='))?.split('=')[1] || 'http://127.0.0.1:6001'
  const sampleSize = parseInt(args.find((arg) => arg.startsWith('--sample='))?.split('=')[1] || '100000')
  const delayBetweenTests = parseInt(args.find((arg) => arg.startsWith('--delay='))?.split('=')[1] || '5000')
  const testsFilter = args.filter((arg) => !arg.startsWith('--'))

  runBenchmarkSuite({
    baseUrl,
    delayBetweenTests,
    testsToRun: testsFilter.length > 0 ? testsFilter : undefined,
    sampleSize,
  })
    .then(() => {
      console.log('✓ Benchmark suite complete!')
      process.exit(0)
    })
    .catch((error) => {
      console.error('Benchmark suite failed:', error)
      process.exit(1)
    })
}

export { runBenchmarkSuite }
export type { BenchmarkResult, BenchmarkTest }
