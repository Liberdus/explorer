# CLI-Based Load Testing Guide

This guide shows how to run load tests directly from the command line using exported test data files, without needing to write custom scripts.

## Quick Start

### 1. Export Test Data

First, export your database IDs to files (collected in random order):

```bash
npm run benchmark:export-data
```

This creates:

```
benchmark-data/
├── test-data.json         # All data in JSON format
├── accounts.csv           # Account IDs (one per line)
├── transactions.csv       # Transaction IDs (one per line)
├── receipts.csv           # Receipt IDs (one per line)
├── cycles.csv             # Cycle numbers (one per line)
└── combined.csv           # All data in one CSV
```

**Note**: Data is retrieved using `ORDER BY RANDOM()` to ensure diverse sampling and avoid sequential patterns.

### 2. Choose Your Tool

#### **Option A: Artillery (Recommended for CLI)**

Best for: Data-driven testing, realistic scenarios, HTML reports

#### **Option B: autocannon**

Best for: Raw performance, Node.js apps, quick tests

---

## Artillery CLI Testing

### Installation

```bash
npm install -g artillery
```

### Pre-configured Tests

#### Test Accounts Only

```bash
# Auto-generates HTML report + shows console metrics
npm run benchmark:artillery-accounts

# Or run directly with Artillery CLI (console only, no HTML)
artillery run benchmark/artillery-accounts.yml
```

**What it does:**

- Loads 100000 account IDs from CSV (collected randomly)
- Tests: `GET /api/account?accountId={randomId}`
- Phases: 60s warmup → 120s sustained load → 60s spike
- Connections: 50 → 100 → 200 per second
- **npm script auto-generates**: JSON results + HTML report

#### Test Transactions Only

```bash
# Auto-generates HTML report + shows console metrics
npm run benchmark:artillery-transactions

# Or run directly with Artillery CLI (console only, no HTML)
artillery run benchmark/artillery-transactions.yml
```

**What it does:**

- Loads 100000 transaction IDs from CSV (collected randomly)
- 70% regular queries, 30% with balance changes
- Same load phases as accounts
- **npm script auto-generates**: JSON results + HTML report

#### Test Combined Workload

```bash
# Auto-generates HTML report + shows console metrics (recommended)
npm run benchmark:artillery-combined

# Or run directly with Artillery CLI (console only, no HTML)
artillery run benchmark/artillery-combined.yml
```

**What it does:**

- Uses combined CSV with all data types
- 50% transactions, 30% accounts, 10% receipts, 10% cycles
- Simulates realistic mixed traffic
- Data collected in random order for diverse sampling
- **npm script auto-generates**: JSON results + HTML report

### What You Get

When using the npm scripts (`npm run benchmark:artillery-*`), you automatically get:

1. **Real-time console metrics** during the test
2. **JSON results** saved to `artillery-results.json`
3. **Interactive HTML report** (`artillery-results.json.html`) with:
   - 📊 Interactive charts and graphs
   - 📈 Response time distribution
   - 🎯 Latency percentiles visualization
   - 📋 Detailed scenario breakdowns
   - 🔥 Request rate over time

**Note**: You may see a deprecation warning about `artillery report` - it still works fine for local HTML generation.

### Custom Artillery Options

#### Change Target URL

```bash
artillery run --target http://production-server.com benchmark/artillery-accounts.yml
```

#### Adjust Load Parameters

```bash
# Run for 5 minutes with 200 req/s
artillery run --duration 300 --arrival-rate 200 benchmark/artillery-accounts.yml

# Add --quiet for cleaner output
artillery run --quiet --duration 300 --arrival-rate 200 benchmark/artillery-accounts.yml
```

#### Override Environment Variables

```bash
API_URL=http://127.0.0.1:3000 artillery run benchmark/artillery-accounts.yml
```

### Artillery Configuration

Edit the YAML files to customize:

```yaml
config:
  target: 'http://127.0.0.1:6001'
  phases:
    - duration: 60 # Test for 60 seconds
      arrivalRate: 100 # 100 users per second
      name: 'Load test'

  payload:
    path: '../benchmark-data/accounts.csv'
    order: 'random' # or "sequence"
    skipHeader: true

  ensure: # Performance thresholds (test fails if exceeded)
    maxErrorRate: 1 # Max 1% error rate
    p95: 200 # 95th percentile < 200ms
    p99: 500 # 99th percentile < 500ms
```

---

## autocannon CLI Testing

### Simple CLI Usage

#### Test Single Account ID

```bash
# Pick a random account from the CSV
ACCOUNT_ID=$(tail -n +2 benchmark-data/accounts.csv | shuf -n 1)

autocannon \
  -c 100 \              # 100 concurrent connections
  -d 30 \               # Duration: 30 seconds
  -m GET \              # HTTP method
  "http://127.0.0.1:6001/api/account?accountId=$ACCOUNT_ID"
```

#### Test Single Transaction ID

```bash
TX_ID=$(tail -n +2 benchmark-data/transactions.csv | shuf -n 1)

autocannon \
  -c 100 \
  -d 30 \
  "http://127.0.0.1:6001/api/transaction?txId=$TX_ID"
```

#### Save Results to JSON

```bash
TX_ID=$(tail -n +2 benchmark-data/transactions.csv | shuf -n 1)

autocannon \
  -c 100 \
  -d 30 \
  -j \                  # JSON output
  "http://127.0.0.1:6001/api/transaction?txId=$TX_ID" \
  > results.json
```

### Shell Script (Multiple IDs)

Run the provided shell script:

```bash
./benchmark/autocannon-cli.sh
```

This tests:

1. Random account ID query
2. Random transaction ID query
3. Shows examples of multi-URL testing

### Advanced autocannon (Programmatic)

For testing with **rotating/random IDs from the CSV**, use the advanced script:

```bash
# Test all endpoints
npm run benchmark:autocannon-advanced

# Test only accounts (rotates through all 100000 account IDs)
npm run benchmark:autocannon-advanced accounts

# Test only transactions (rotates through all 100000 tx IDs)
npm run benchmark:autocannon-advanced transactions

# Test mixed load (50% accounts, 50% transactions, random IDs)
npm run benchmark:autocannon-advanced mixed
```

**What makes this "advanced":**

- Each request uses a **different random ID** from your data
- Simulates real user traffic patterns
- Real-time progress counter
- Detailed breakdown by query type

### Direct autocannon CLI with Options

```bash
autocannon \
  -c 200 \                    # 200 concurrent connections
  -d 60 \                     # 60 seconds
  -p 10 \                     # Pipelining: 10 requests per connection
  -m GET \                    # HTTP method
  -H "Accept: application/json" \  # Custom headers
  --on-port 6001 \            # Wait for port to be ready
  http://127.0.0.1:6001/api/account?accountId=abc123
```

---

## Comparison: Artillery vs autocannon CLI

| Feature                | Artillery         | autocannon CLI      |
| ---------------------- | ----------------- | ------------------- |
| **CSV/JSON data**      | ✅ Native support | ⚠️ Manual scripting |
| **Random IDs**         | ✅ Built-in       | ⚠️ Needs script     |
| **Multiple scenarios** | ✅ Easy           | ❌ Complex          |
| **HTML reports**       | ✅ Beautiful      | ❌ JSON only        |
| **Performance**        | Good              | ⚡ Excellent        |
| **Ease of use**        | ⭐⭐⭐⭐⭐        | ⭐⭐⭐              |
| **Best for**           | Realistic testing | Raw benchmarks      |

**Recommendation:**

- Use **Artillery** for data-driven testing with your exported CSVs
- Use **autocannon-advanced** (Node script) for rotating through many IDs
- Use **autocannon CLI** for quick one-off tests

---

## Common Workflows

### Workflow 1: Daily Performance Check

```bash
# Export latest data
npm run benchmark:export-data

# Run combined test
artillery run --output daily-$(date +%Y%m%d).json benchmark/artillery-combined.yml

# Generate report
artillery report daily-$(date +%Y%m%d).json
```

### Workflow 2: Load Test Specific Endpoint

```bash
# Export data
npm run benchmark:export-data

# Edit artillery-accounts.yml to adjust load
# Then run:
artillery run benchmark/artillery-accounts.yml
```

### Workflow 3: Stress Test with Growing Load

```bash
# Edit artillery config with ramping phases:
# phases:
#   - duration: 60, arrivalRate: 50
#   - duration: 60, arrivalRate: 100
#   - duration: 60, arrivalRate: 200
#   - duration: 60, arrivalRate: 500

artillery run benchmark/artillery-combined.yml
```

### Workflow 4: Quick autocannon Test

```bash
# Export data (if not already done)
npm run benchmark:export-data

# Run advanced script with rotating IDs
npm run benchmark:autocannon-advanced transactions
```

---

## Understanding Results

### Artillery Output

```
Summary report @ 16:30:15
Scenarios launched:  12000
Scenarios completed: 12000
Requests completed:  12000
Mean response time:  65.3 ms
p50:                 58 ms
p95:                 142 ms
p99:                 198 ms
Errors:              0
```

**Good signs:**

- ✅ p95 < 200ms
- ✅ p99 < 500ms
- ✅ Errors: 0
- ✅ All scenarios completed

### autocannon Output

```
┌─────────┬──────┬──────┬───────┬──────┬─────────┬─────────┬────────┐
│ Stat    │ 2.5% │ 50%  │ 97.5% │ 99%  │ Avg     │ Stdev   │ Max    │
├─────────┼──────┼──────┼───────┼──────┼─────────┼─────────┼────────┤
│ Latency │ 5 ms │ 8 ms │ 18 ms │ 23ms │ 9.25 ms │ 4.12 ms │ 156 ms │
└─────────┴──────┴──────┴───────┴──────┴─────────┴─────────┴────────┘

┌───────────┬─────────┬─────────┬─────────┬─────────┬─────────┬─────────┬─────────┐
│ Stat      │ 1%      │ 2.5%    │ 50%     │ 97.5%   │ Avg     │ Stdev   │ Min     │
├───────────┼─────────┼─────────┼─────────┼─────────┼─────────┼─────────┼─────────┤
│ Req/Sec   │ 11,455  │ 11,455  │ 12,543  │ 12,799  │ 12,473  │ 389.23  │ 11,448  │
└───────────┴─────────┴─────────┴─────────┴─────────┴─────────┴─────────┴─────────┘

12k requests in 30.03s, 15.2 MB read
```

**What to look for:**

- **Req/Sec**: Higher is better (your 12k is excellent!)
- **Latency p99**: Should be < 500ms
- **Max latency**: Check for outliers
- **Errors**: Should be 0

---

## Troubleshooting

### "No such file: benchmark-data/accounts.csv"

```bash
npm run benchmark:export-data
```

### "Connection refused"

Make sure server is running:

```bash
npm run server
```

### "Too many open files" (macOS)

```bash
ulimit -n 10000
```

### Artillery not found

```bash
npm install -g artillery
```

### Test data is stale

Re-export with fresh data:

```bash
npm run benchmark:export-data
```

---

## Advanced Tips

### 1. CI/CD Integration

**GitHub Actions:**

```yaml
- name: Export test data
  run: npm run benchmark:export-data

- name: Run load test
  run: artillery run --output results.json benchmark/artillery-combined.yml

- name: Check thresholds
  run: |
    if grep -q '"errors": [^0]' results.json; then
      echo "Load test failed!"
      exit 1
    fi
```

### 2. Compare Before/After

```bash
# Before optimization
npm run benchmark:export-data
artillery run -o before.json benchmark/artillery-accounts.yml

# After optimization
artillery run -o after.json benchmark/artillery-accounts.yml

# Compare
artillery report before.json --output before.html
artillery report after.json --output after.html
```

### 3. Custom Artillery Processors

Create `benchmark/processors.js`:

```javascript
module.exports = {
  logRequest: function (requestParams, context, ee, next) {
    console.log(`Testing with ID: ${context.vars.accountId}`)
    return next()
  },
}
```

Then in YAML:

```yaml
config:
  processor: './benchmark/processors.js'

scenarios:
  - flow:
      - function: 'logRequest'
      - get:
          url: '/api/account?accountId={{ accountId }}'
```

---

## Summary

✅ **For CLI testing with your data:**

1. `npm run benchmark:export-data` (once)
2. `npm run benchmark:artillery-combined` (Artillery - easiest)
3. `npm run benchmark:autocannon-advanced` (autocannon - most flexible)

✅ **For one-off tests:**

```bash
TX_ID=$(tail -n +2 benchmark-data/transactions.csv | shuf -n 1)
autocannon -c 100 -d 30 "http://127.0.0.1:6001/api/transaction?txId=$TX_ID"
```

✅ **For production monitoring:**

```bash
artillery run --environment production benchmark/artillery-combined.yml
```
