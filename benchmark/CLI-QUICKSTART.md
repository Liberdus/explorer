# CLI Load Testing - Quick Start

Load test your API from the command line using exported test data!

## 🚀 Quick Start (3 Steps)

### 1. Export Test Data

```bash
npm run benchmark:export-data
```

This creates `benchmark-data/` with CSV/JSON files containing 100000+ real IDs.

### 2. Choose Your Tool

#### **Option A: Artillery (Easiest for CLI)**

```bash
# Install globally (one time)
npm install -g artillery

# Test accounts with real IDs
npm run benchmark:artillery-accounts

# Test transactions with real IDs
npm run benchmark:artillery-transactions

# Test combined workload (50% tx, 30% accounts, etc.)
npm run benchmark:artillery-combined
```

#### **Option B: autocannon (Advanced, Random IDs)**

```bash
# Rotates through different IDs automatically
npm run benchmark:autocannon-advanced

# Or specific test:
npm run benchmark:autocannon-advanced accounts      # Accounts only
npm run benchmark:autocannon-advanced transactions  # Transactions only
npm run benchmark:autocannon-advanced mixed         # 50/50 mix
```

#### **Option C: autocannon CLI (Simple, Single ID)**

```bash
# Pick random ID and test
TX_ID=$(tail -n +2 benchmark-data/transactions.csv | shuf -n 1)
autocannon -c 100 -d 30 "http://127.0.0.1:6001/api/transaction?txId=$TX_ID"
```

## 📊 What You Get

### Artillery Output

```
Summary report @ 16:30:15
Scenarios launched:  12000
Requests completed:  12000
Mean response time:  65 ms
p95:                 142 ms
p99:                 198 ms
Errors:              0
```

### autocannon-advanced Output

```
🔥 Test 1: Account Queries (Random IDs)
[Progress bar]
✓ Account Test Results:
  Requests/sec:  12472.80
  Latency (avg): 8.25ms
  Latency (p95): 13.45ms
  Latency (p99): 18.23ms
  Total requests: 374184
  Errors: 0
```

## 📁 Files Created

```
benchmark/
├── artillery-accounts.yml         # Artillery config for accounts
├── artillery-transactions.yml     # Artillery config for transactions
├── artillery-combined.yml         # Combined workload
├── autocannon-advanced.ts         # Advanced autocannon (rotates IDs)
├── autocannon-cli.sh             # Shell script examples
├── export-test-data.ts           # Data export script
└── CLI-TESTING.md                # Full documentation

benchmark-data/                    # Created after export
├── test-data.json                # All data in JSON
├── accounts.csv                  # 100000 account IDs
├── transactions.csv              # 100000 transaction IDs
├── receipts.csv                  # 100000 receipt IDs
├── cycles.csv                    # 100000 cycle numbers
└── combined.csv                  # All in one CSV
```

## 🎯 Use Cases

**Quick sanity check:**

```bash
npm run benchmark:export-data
npm run benchmark:artillery-accounts
```

**Production readiness:**

```bash
artillery run --target https://prod.example.com benchmark/artillery-combined.yml
```

**Stress test with rotating IDs:**

```bash
npm run benchmark:autocannon-advanced mixed
```

## 📖 Full Documentation

- **[CLI-TESTING.md](./CLI-TESTING.md)** - Complete guide with all options
- **[QUICKSTART.md](./QUICKSTART.md)** - Original benchmark suite guide
- **[README.md](./README.md)** - Full API benchmark documentation

## 💡 Pro Tips

1. **Re-export data regularly:**

   ```bash
   npm run benchmark:export-data  # Gets latest IDs from DB
   ```

2. **Save results:**

   ```bash
   artillery run -o results.json benchmark/artillery-combined.yml
   artillery report results.json  # HTML report
   ```

3. **Custom target:**

   ```bash
   artillery run --target http://staging.example.com benchmark/artillery-accounts.yml
   ```

4. **More load:**
   ```bash
   artillery run --duration 300 --arrival-rate 100000 benchmark/artillery-combined.yml
   ```

---

**Your results were amazing! 🎉**

- Transaction queries: **12,473 req/s**
- Account queries: **11,977 req/s**
- Total data: **8,311 req/s**

All with p99 latency under 20ms! 🔥
