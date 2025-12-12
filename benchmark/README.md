# Liberdus Explorer API Benchmark Suite

Comprehensive load testing and benchmarking suite for the Liberdus Explorer API using real database data.

## Features

- **Real Data Testing**: Uses actual accountIds, txIds, cycle numbers, and markers from your database
- **Comprehensive Coverage**: Tests all major API endpoints (accounts, transactions, cycles, receipts, stats)
- **Realistic Load Patterns**: Randomized queries simulating real user behavior
- **Detailed Metrics**: Requests/sec, latency (avg, p50, p95, p99), throughput, errors
- **Flexible Execution**: Run all tests or filter by category

## Prerequisites

1. **Server must be running**: Start your explorer server before running benchmarks

   ```bash
   npm run server
   ```

2. **Database must have data**: Ensure your collector has gathered some data

   ```bash
   npm run collector
   ```

3. **Install dependencies**:
   ```bash
   npm install
   ```

## Quick Start

### 1. Collect Test Data

First, verify your database has data and collect sample IDs:

```bash
npm run benchmark:collect-data
```

This will display sample data like:

```
✓ Collected 100000 account IDs
✓ Collected 100000 transaction IDs
✓ Collected 100000 receipt IDs
✓ Collected 100000 cycle numbers
```

### 2. Run Benchmarks

Run all benchmark tests:

```bash
npm run benchmark
```

Run quick benchmark (just transactions and accounts):

```bash
npm run benchmark:quick
```

Run specific categories:

```bash
npm run benchmark:stats     # Only stats endpoints
npm run benchmark:cycles    # Only cycle endpoints
```

## Available Tests

### Basic Endpoints

- `/totalData` - Aggregate data endpoint
- `/port` - Simple endpoint test

### Cycle Endpoints

- Latest cycles (count=10, count=50)
- Query by specific cycle number
- Query by cycle marker
- Cycle range queries

### Account Endpoints

- Latest accounts
- Query by specific account ID
- Paginated queries

### Transaction Endpoints

- Latest transactions
- Query by transaction ID (with/without balance changes)
- Query by account ID
- Transaction statistics

### Receipt Endpoints

- Latest receipts
- Query by receipt/transaction ID

### Stats Endpoints

- Validator stats
- Transaction stats (cycle-based and daily)
- Account stats
- Coin stats
- Network stats

## Configuration

### Command Line Options

```bash
# Custom server URL
npm run benchmark -- --url=http://127.0.0.1:3000

# Custom sample size (number of IDs to collect)
npm run benchmark -- --sample=200

# Custom delay between tests (milliseconds)
npm run benchmark -- --delay=3000

# Filter tests by keyword
npm run benchmark -- transaction    # Only tests with "transaction" in name
npm run benchmark -- account stats  # Tests with "account" OR "stats" in name
```

### Combining Options

```bash
npm run benchmark -- --url=http://127.0.0.1:6001 --sample=150 --delay=2000 transaction
```

## Understanding Results

### Individual Test Output

```
Running: Transaction - By TxId
═══════════════════════════════════════════════════════════════════
✓ Results:
  Requests/sec:  1523.45
  Latency (avg): 65.32ms
  Latency (p50): 58.12ms
  Latency (p95): 142.67ms
  Latency (p99): 198.23ms
  Throughput:    2.45 MB/s
  Errors:        0
  Timeouts:      0
```

**Key Metrics:**

- **Requests/sec**: How many requests the server can handle per second
- **Latency (avg)**: Average response time
- **Latency (p95)**: 95% of requests complete under this time
- **Latency (p99)**: 99% of requests complete under this time (important for SLAs)
- **Throughput**: Data transfer rate
- **Errors**: Failed requests (should be 0)

### Summary Report

After all tests complete, you'll see:

```
BENCHMARK SUMMARY
═══════════════════════════════════════════════════════════════════
Test Name                          | Req/s      | Avg(ms)    | P95(ms)    | P99(ms)    | Errors
───────────────────────────────────────────────────────────────────
Total Data Endpoint                |  2145.23   |  46.32     |  89.45     |  125.67    |  0
Transaction - By TxId              |  1523.45   |  65.32     |  142.67    |  198.23    |  0
...
```

**Performance Insights:**

- Endpoints sorted by various metrics
- Slowest endpoints (p99 latency)
- Highest throughput endpoints
- Total requests processed
- Error summary

## Interpreting Results

### Good Performance Indicators

- ✅ Requests/sec > 1000 for simple queries
- ✅ p95 latency < 200ms
- ✅ p99 latency < 500ms
- ✅ Zero errors
- ✅ Consistent performance across runs

### Performance Issues

- ⚠️ p99 latency > 1000ms - May need optimization
- ⚠️ Errors > 0 - Server errors or timeouts
- ⚠️ Low throughput on simple endpoints - Potential bottleneck
- ⚠️ High variance between p50 and p99 - Inconsistent performance

### Common Bottlenecks

1. **Database queries** - Check indexes on frequently queried fields
2. **Large result sets** - Consider pagination limits
3. **Cache misses** - Verify cache is working for stats endpoints
4. **Memory pressure** - Monitor Node.js heap usage
5. **Rate limiting** - May affect high-concurrency tests

## Optimization Tips

### 1. Database Indexes

Ensure indexes exist on:

- `accounts.accountId`
- `transactions.txId`
- `transactions.accountId`
- `cycles.counter`
- `cycles.marker`
- `receipts.receiptId`

### 2. Caching

The test suite includes cached endpoints:

- `/api/stats/validator?count=1000&responseType=array` (cached)
- Coin stats (cached)

Monitor cache hit rates in benchmark results.

### 3. Connection Pooling

Check SQLite connection configuration in `src/storage/`.

### 4. Rate Limiting

The server has rate limiting enabled. For benchmarks, you may want to:

- Disable rate limiting temporarily
- Run from localhost (allowed by default)
- Adjust limits in `src/server.ts:125-129`

## Advanced Usage

### Programmatic Usage

```typescript
import { runBenchmarkSuite } from './benchmark/test-suite'

const results = await runBenchmarkSuite({
  baseUrl: 'http://127.0.0.1:6001',
  delayBetweenTests: 5000,
  testsToRun: ['transaction', 'account'],
  sampleSize: 100,
})

// Process results
results.forEach((result) => {
  if (result.latencyP99 > 500) {
    console.warn(`Slow endpoint: ${result.name}`)
  }
})
```

### Custom Test Creation

Add your own tests to `benchmark/test-suite.ts`:

```typescript
{
  name: 'My Custom Test',
  urlGenerator: (data) => {
    const accountId = getRandomItem(data.accountIds)
    return `/api/my-endpoint?accountId=${accountId}`
  },
  connections: 100,
  duration: 30,
  description: 'Tests my custom endpoint'
}
```

## Continuous Integration

### GitHub Actions Example

```yaml
- name: Run API Benchmarks
  run: |
    npm run server &
    sleep 10
    npm run benchmark:quick
    kill %1
```

### Performance Regression Detection

Save benchmark results and compare:

```bash
npm run benchmark > results-$(date +%Y%m%d).txt
```

## Troubleshooting

### Server Not Responding

```
Error: connect ECONNREFUSED 127.0.0.1:6001
```

**Solution**: Ensure the server is running: `npm run server`

### No Test Data Found

```
⚠️  Warning: No accounts found in database
```

**Solution**: Run the collector first: `npm run collector`

### High Error Rates

```
Errors: 150
```

**Solution**:

- Check server logs for errors
- Reduce concurrent connections
- Increase test duration
- Check database connection limits

### Rate Limiting Errors

```
Too Many Requests (429)
```

**Solution**:

- Run from localhost (automatically allowed)
- Adjust rate limits in server configuration
- Reduce concurrent connections

## Best Practices

1. **Warm-up**: Run a quick test first to warm up the server
2. **Baseline**: Establish baseline performance metrics
3. **Isolation**: Run benchmarks on a dedicated machine/environment
4. **Consistency**: Use the same test parameters for comparisons
5. **Monitoring**: Monitor server resources during tests
6. **Documentation**: Document any configuration changes

## Example Workflow

```bash
# 1. Start server
npm run server

# 2. In another terminal, verify data
npm run benchmark:collect-data

# 3. Run quick test to warm up
npm run benchmark:quick

# 4. Run full benchmark suite
npm run benchmark

# 5. Run specific category if issues found
npm run benchmark:stats

# 6. Save results
npm run benchmark > benchmark-results-$(date +%Y%m%d).txt
```

## Resources

- [autocannon documentation](https://github.com/mcollina/autocannon)
- [Fastify performance guide](https://www.fastify.io/docs/latest/Guides/Performance/)
- [SQLite optimization](https://www.sqlite.org/optoverview.html)
