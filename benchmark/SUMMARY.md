# Benchmark Suite - Implementation Summary

## 🎉 What's Been Added

A production-ready API load testing suite that uses **real data from your database** to benchmark all major endpoints.

### Files Created

```
benchmark/
├── README.md           # Comprehensive documentation (400+ lines)
├── QUICKSTART.md       # Quick start guide for immediate use
├── SUMMARY.md          # This file
├── data-collector.ts   # Fetches real accountIds, txIds, etc. from DB
├── test-suite.ts       # Main benchmark suite with 25+ tests
└── example.ts          # Simple example for quick testing
```

### NPM Scripts Added

```json
{
  "benchmark": "Full test suite (25+ tests, ~20-30 min)",
  "benchmark:collect-data": "Verify database has data",
  "benchmark:quick": "Quick test (transactions & accounts only)",
  "benchmark:example": "Simple 3-endpoint test (~30 seconds)",
  "benchmark:stats": "Test statistics endpoints only",
  "benchmark:cycles": "Test cycle endpoints only"
}
```

## 🚀 Quick Start (3 Steps)

### 1. Make sure server is running

```bash
npm run server
```

### 2. Run a quick benchmark

```bash
# In another terminal
npm run benchmark:example
```

### 3. View results

```
✓ Results:
  Requests/sec:  1523.45
  Latency (avg): 65.32ms
  Latency (p95): 142.67ms
  Latency (p99): 198.23ms
  Throughput:    2.45 MB/s
  Errors:        0
```

## 💡 Key Features

### Real Data Testing

- ✅ Queries actual `accountId`, `txId`, `receiptId` from your database
- ✅ Tests real cycle numbers and markers
- ✅ Randomizes data to avoid cache effects
- ✅ Simulates realistic user query patterns

### Comprehensive Coverage

Tests all major endpoints:

- `/totalData` - Aggregate stats
- `/api/cycleinfo` - By count, number, marker, range
- `/api/account` - By ID, paginated, by type
- `/api/transaction` - By ID, by account, with balance changes
- `/api/receipt` - By ID, by cycle range
- `/api/stats/*` - Validator, transaction, account, coin, network stats

### Performance Metrics

- **Requests per second** - Server throughput
- **Latency** - Average, p50, p95, p99 percentiles
- **Throughput** - MB/s data transfer
- **Error rates** - Failed requests and timeouts
- **Comparative analysis** - Slowest vs fastest endpoints

## 📊 What Gets Tested

### Sample Test Breakdown

| Category         | Tests | Description                                     |
| ---------------- | ----- | ----------------------------------------------- |
| **Cycles**       | 5     | Latest, by number, by marker, range queries     |
| **Accounts**     | 3     | By ID, latest, paginated                        |
| **Transactions** | 6     | By ID, by account, with/without balance changes |
| **Receipts**     | 2     | By ID, latest                                   |
| **Stats**        | 8     | Validator, transaction, account, coin, network  |
| **Basic**        | 2     | Port, total data                                |

**Total: 25+ test configurations**

### Load Parameters

- **Connections**: 50-150 concurrent (per test)
- **Duration**: 10-30 seconds per test
- **Sample size**: 100000 real IDs from database
- **Randomization**: Each request uses different IDs

## 🎯 Use Cases

### 1. Pre-Deployment Testing

```bash
# Quick sanity check before deploying
npm run benchmark:quick
```

### 2. Performance Monitoring

```bash
# Weekly performance check
npm run benchmark > weekly-$(date +%Y%m%d).txt
```

### 3. Optimization Validation

```bash
# Before optimization
npm run benchmark > before.txt

# After adding indexes/caching
npm run benchmark > after.txt

# Compare
diff before.txt after.txt
```

### 4. Bottleneck Identification

```bash
# Run full suite to identify slow endpoints
npm run benchmark

# Check the "Slowest endpoints" section
```

### 5. Capacity Planning

```bash
# Test with different connection counts
# Edit test-suite.ts: connections: 500
npm run benchmark
```

## 📈 Expected Performance

### Good Benchmarks (Reference)

Based on typical Fastify + SQLite setup:

| Endpoint Type          | Req/s     | p99 Latency |
| ---------------------- | --------- | ----------- |
| Simple queries (by ID) | 1000-2000 | < 200ms     |
| Aggregate queries      | 500-1000  | < 500ms     |
| Cached stats           | 2000-5000 | < 100ms     |
| Basic endpoints        | 3000+     | < 50ms      |

### Red Flags 🚩

- p99 latency > 1000ms
- Error rate > 0%
- Req/s < 100 for simple queries
- High variance between runs

## 🔧 Customization

### Add Custom Tests

Edit [test-suite.ts](./test-suite.ts:39):

```typescript
{
  name: 'My Custom Endpoint',
  urlGenerator: (data) => {
    const txId = getRandomItem(data.txIds)
    return `/api/my-endpoint?txId=${txId}`
  },
  connections: 100,
  duration: 30,
  description: 'Tests my custom endpoint'
}
```

### Change Test Parameters

```bash
# Custom server URL
npm run benchmark -- --url=http://127.0.0.1:3000

# Larger sample size
npm run benchmark -- --sample=200

# Less delay between tests
npm run benchmark -- --delay=2000

# Filter specific tests
npm run benchmark -- transaction stats
```

### Programmatic Usage

```typescript
import { runBenchmarkSuite } from './benchmark/test-suite'

const results = await runBenchmarkSuite({
  baseUrl: 'http://127.0.0.1:6001',
  sampleSize: 100000,
  testsToRun: ['transaction'],
})

// Process results
console.log(results[0].requestsPerSec)
```

## 📚 Documentation Structure

1. **QUICKSTART.md** (this is where most users should start)

   - 5-minute getting started guide
   - Common commands
   - Troubleshooting

2. **README.md** (comprehensive reference)

   - Detailed feature explanation
   - All configuration options
   - Best practices
   - CI/CD integration
   - Performance optimization tips

3. **example.ts** (learning by example)

   - Simple, commented code
   - Tests 3 critical endpoints
   - Easy to modify

4. **test-suite.ts** (production-ready suite)
   - 25+ comprehensive tests
   - Real data integration
   - Detailed metrics

## 🎓 Learning Path

### Beginner

```bash
1. Read QUICKSTART.md
2. Run: npm run benchmark:example
3. Understand the output
```

### Intermediate

```bash
1. Run: npm run benchmark:quick
2. Analyze slow endpoints
3. Add database indexes
4. Re-run and compare
```

### Advanced

```bash
1. Run: npm run benchmark
2. Customize tests in test-suite.ts
3. Set up CI/CD integration
4. Create performance dashboards
```

## 🔍 Example Output

### Individual Test

```
═══════════════════════════════════════════════════════════════════
Running: Transaction - By TxId
Description: Query specific transaction by ID (critical path)
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

### Summary Report

```
BENCHMARK SUMMARY
═══════════════════════════════════════════════════════════════
Test Name                          | Req/s      | P99(ms)
───────────────────────────────────────────────────────────────
Transaction - By TxId              |  1523.45   |  198.23
Account - By ID                    |  1845.67   |  145.89
Total Data Endpoint                |  2145.23   |  89.45

Aggregate Statistics:
  Total tests run:       25
  Total requests:        342,156
  Average latency:       87.45ms
  Total errors:          0

⚠️  Slowest endpoints (p99 latency):
  1. Transaction with Balance Changes: 456.78ms
  2. Cycle Range Query: 234.56ms
  3. Account Paginated: 198.23ms

✓ Highest throughput endpoints:
  1. Port Endpoint: 5234.12 req/s
  2. Total Data: 2145.23 req/s
  3. Validator Stats: 1845.67 req/s
```

## ⚙️ Dependencies Added

```json
{
  "devDependencies": {
    "@types/autocannon": "^7.12.7",
    "autocannon": "^7.15.0"
  }
}
```

**autocannon** - Official Fastify benchmarking tool

- Fast, accurate HTTP/1.1 benchmarking
- Written in Node.js
- Highly configurable
- Well-maintained by the Fastify team

## 🚦 Next Steps

### Immediate (5 minutes)

```bash
npm run benchmark:example
```

### Short Term (today)

1. Run `npm run benchmark:quick`
2. Identify any slow endpoints (p99 > 500ms)
3. Check database indexes

### Medium Term (this week)

1. Run full `npm run benchmark`
2. Establish performance baselines
3. Document expected performance
4. Set up weekly monitoring

### Long Term

1. Add to CI/CD pipeline
2. Set performance budgets
3. Create alerts for regressions
4. Dashboard integration

## 💼 Production Recommendations

### Before Deploying

```bash
# 1. Run quick test
npm run benchmark:quick

# 2. Verify no errors
grep "Errors:" results.txt

# 3. Check p99 latencies
grep "p99:" results.txt
```

### Regular Monitoring

```bash
# Weekly benchmark (cron job)
0 2 * * 0 cd /path/to/explorer && npm run benchmark > /var/log/benchmarks/$(date +\%Y\%m\%d).txt
```

### Performance Budgets

Set thresholds and alert if exceeded:

- Transaction by ID: p99 < 200ms
- Account by ID: p99 < 200ms
- Stats endpoints: p99 < 500ms
- Error rate: 0%

## 🆘 Getting Help

Issues? Check these in order:

1. **QUICKSTART.md** - Common problems and solutions
2. **README.md** - Detailed documentation
3. **example.ts** - Simple working example
4. **Server logs** - Check for errors during tests
5. **Database** - Ensure it has data and isn't locked

## ✅ Checklist

Before running benchmarks:

- [ ] Server is running (`npm run server`)
- [ ] Database has data (`npm run collector`)
- [ ] Dependencies installed (`npm install`)
- [ ] TypeScript compiled (`npm run prepare`)

For best results:

- [ ] Run on dedicated test environment
- [ ] No other heavy processes running
- [ ] Consistent test conditions
- [ ] Warm up server first (run once, ignore results)

---

**Ready to benchmark? Start here:**

```bash
npm run benchmark:example
```

**Want more details? Read:**

- [QUICKSTART.md](./QUICKSTART.md) - Quick start guide
- [README.md](./README.md) - Full documentation
