# Benchmark Suite - Quick Start Guide

## What Was Created

A comprehensive API load testing suite with real database data:

```
benchmark/
├── README.md           # Full documentation
├── QUICKSTART.md       # This file
├── data-collector.ts   # Collects real IDs from your database
├── test-suite.ts       # Main benchmark suite (25+ tests)
└── example.ts          # Simple example for quick tests
```

## Prerequisites

✅ **Server must be running**
```bash
npm run server
```

✅ **Database must have data**
```bash
npm run collector
```

## Run Your First Benchmark

### Option 1: Simple Example (Recommended First)

Test the 3 most critical endpoints in 30 seconds:

```bash
npm run benchmark:example
```

**Output:**
```
Quick Benchmark - Testing Critical Endpoints

Collecting test data from database...
  ✓ Collected 50 account IDs
  ✓ Collected 50 transaction IDs

Testing: GET /api/transaction?txId=...
Transaction Query Results:
  Requests/sec: 1523.45
  Latency p99:  198.23ms

Testing: GET /api/account?accountId=...
Account Query Results:
  Requests/sec: 1845.67
  Latency p99:  145.89ms

Testing: GET /totalData
Total Data Results:
  Requests/sec: 2145.23
  Latency p99:  89.45ms

✅ All endpoints performing well
```

### Option 2: Quick Test Suite (5-10 minutes)

Test transactions and accounts only:

```bash
npm run benchmark:quick
```

### Option 3: Full Test Suite (20-30 minutes)

Run all 25+ tests across all endpoints:

```bash
npm run benchmark
```

## Understanding the Results

### Good Performance ✅
```
Requests/sec:  1523.45    # > 1000 is good for query endpoints
Latency (avg): 65.32ms    # Average response time
Latency (p95): 142.67ms   # 95% of requests faster than this
Latency (p99): 198.23ms   # 99% faster (should be < 500ms)
Throughput:    2.45 MB/s  # Data transfer rate
Errors:        0          # Should always be 0
```

### Performance Issues ⚠️
```
Requests/sec:  124.45     # Too low - investigate bottleneck
Latency (p99): 2845.67ms  # Too high - needs optimization
Errors:        15         # Server errors - check logs
```

## Common Commands

```bash
# 1. Verify database has data
npm run benchmark:collect-data

# 2. Quick 30-second test
npm run benchmark:example

# 3. Test specific categories
npm run benchmark:quick        # Transactions & accounts
npm run benchmark:stats        # Statistics endpoints
npm run benchmark:cycles       # Cycle endpoints

# 4. Full benchmark suite
npm run benchmark

# 5. Custom options
npm run benchmark -- --url=http://127.0.0.1:3000  # Different server
npm run benchmark -- --sample=200                 # More test data
npm run benchmark -- transaction                  # Filter by keyword
```

## What Each Test Does

### Real Data Testing
The benchmark suite:
1. **Connects to your database** and collects 100000 real IDs in random order
2. **Randomizes requests** to simulate different users
3. **Tests actual query patterns** (by ID, by range, paginated, etc.)
4. **Measures performance** under realistic load

**Note**: Data collection uses `ORDER BY RANDOM()` to ensure a diverse sample set and avoid sequential query patterns.

### Test Coverage
- ✅ 25+ different endpoint configurations
- ✅ 50-150 concurrent connections per test
- ✅ 10-30 second duration per test
- ✅ Real accountIds, txIds, cycle numbers
- ✅ Cached and uncached queries

## Interpreting Results

### Summary Table
```
BENCHMARK SUMMARY
═══════════════════════════════════════════════════════════════
Test Name                          | Req/s      | Avg(ms)    | P95(ms)
───────────────────────────────────────────────────────────────
Transaction - By TxId              |  1523.45   |  65.32     |  142.67
Account - By ID                    |  1845.67   |  54.23     |  145.89
Total Data Endpoint                |  2145.23   |  46.32     |  89.45
Stats - Validator (cached)         |  3245.89   |  30.12     |  67.23
```

**What to look for:**
1. **Req/s** - Higher is better (target > 1000 for queries)
2. **P95/P99** - These matter more than average (target < 200ms)
3. **Consistency** - Similar numbers across runs means stable
4. **Errors** - Should always be 0

### Performance Rankings

After tests complete, you'll see:

```
⚠️  Slowest endpoints (p99 latency):
  1. Transaction - By TxId with Balance Changes: 456.78ms
  2. Account - Paginated: 234.56ms
  3. Cycle Info - Range Query: 198.23ms

✓ Highest throughput endpoints:
  1. Port Endpoint: 5234.12 req/s
  2. Total Data Endpoint: 2145.23 req/s
  3. Stats - Validator (cached): 1845.67 req/s
```

## Troubleshooting

### "No test data found"
```bash
⚠️  Warning: No accounts found in database
```
**Solution:** Run collector first: `npm run collector`

### "Connection refused"
```bash
Error: connect ECONNREFUSED 127.0.0.1:6001
```
**Solution:** Start server: `npm run server`

### "Too many errors"
```bash
Errors: 150
```
**Solution:**
- Check server logs for errors
- Verify database is not locked
- Reduce connections: Edit test to use fewer concurrent connections

## Next Steps

1. **Establish Baseline**
   ```bash
   npm run benchmark > baseline-$(date +%Y%m%d).txt
   ```

2. **Make Optimizations**
   - Add database indexes
   - Enable caching
   - Optimize queries

3. **Re-run Benchmarks**
   ```bash
   npm run benchmark > after-optimization-$(date +%Y%m%d).txt
   ```

4. **Compare Results**
   ```bash
   diff baseline-*.txt after-optimization-*.txt
   ```

## Example Optimization Workflow

```bash
# Day 1: Establish baseline
npm run server &
npm run benchmark > results-day1.txt

# Day 2: After adding indexes
npm run server &
npm run benchmark > results-day2.txt

# Compare
grep "Transaction - By TxId" results-day1.txt
grep "Transaction - By TxId" results-day2.txt
```

## Need Help?

- 📖 Full docs: [benchmark/README.md](./README.md)
- 🔧 Customize tests: Edit [benchmark/test-suite.ts](./test-suite.ts)
- 💡 Simple example: See [benchmark/example.ts](./example.ts)

## Quick Reference Card

| Command | Duration | Tests | Use Case |
|---------|----------|-------|----------|
| `npm run benchmark:example` | 30s | 3 | Quick health check |
| `npm run benchmark:quick` | 5-10m | ~10 | Pre-deployment test |
| `npm run benchmark:stats` | 5-10m | 8 | Stats performance |
| `npm run benchmark` | 20-30m | 25+ | Full analysis |
| `npm run benchmark:collect-data` | 10s | 0 | Verify database |

---

**Ready to start?**

```bash
# Make sure server is running
npm run server

# In another terminal, run quick benchmark
npm run benchmark:example
```
