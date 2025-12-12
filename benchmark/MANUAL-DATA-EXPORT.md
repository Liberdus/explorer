# Manual Data Export with SQLite3

Export test data directly from SQLite databases using SQL commands - no Node.js required!

## Quick Start

```bash
# Create output directory
mkdir -p benchmark-data

# Export accounts
sqlite3 -header -csv collector-db/accounts.db \
  "SELECT accountId FROM accounts ORDER BY RANDOM() LIMIT 100000;" \
  > benchmark-data/accounts.csv

# Export transactions
sqlite3 -header -csv collector-db/transactions.db \
  "SELECT txId FROM transactions ORDER BY RANDOM() LIMIT 100000;" \
  > benchmark-data/transactions.csv

# Export receipts
sqlite3 -header -csv collector-db/receipts.db \
  "SELECT receiptId FROM receipts ORDER BY RANDOM() LIMIT 100000;" \
  > benchmark-data/receipts.csv

# Export cycles
sqlite3 -header -csv collector-db/cycles.db \
  "SELECT counter FROM cycles ORDER BY counter DESC LIMIT 100000;" \
  > benchmark-data/cycles.csv
```

Done! Now use with Artillery or autocannon.

---

## Detailed Guide

### 1. Export Accounts

```bash
# Basic export (100000 random accounts)
sqlite3 -header -csv collector-db/accounts.db \
  "SELECT accountId FROM accounts ORDER BY RANDOM() LIMIT 100000;" \
  > benchmark-data/accounts.csv

# Latest 100000 accounts
sqlite3 -header -csv collector-db/accounts.db \
  "SELECT accountId FROM accounts ORDER BY timestamp DESC LIMIT 100000;" \
  > benchmark-data/accounts.csv

# Filter by account type
sqlite3 -header -csv collector-db/accounts.db \
  "SELECT accountId FROM accounts WHERE accountType = 9 ORDER BY RANDOM() LIMIT 100000;" \
  > benchmark-data/user-accounts.csv
```

### 2. Export Transactions

```bash
# Basic export (100000 random transactions)
sqlite3 -header -csv collector-db/transactions.db \
  "SELECT txId FROM transactions ORDER BY RANDOM() LIMIT 100000;" \
  > benchmark-data/transactions.csv

# Latest transactions
sqlite3 -header -csv collector-db/transactions.db \
  "SELECT txId FROM transactions ORDER BY timestamp DESC LIMIT 100000;" \
  > benchmark-data/transactions.csv

# Specific transaction type (e.g., transfers)
sqlite3 -header -csv collector-db/transactions.db \
  "SELECT txId FROM transactions WHERE txType = 'transfer' ORDER BY RANDOM() LIMIT 100000;" \
  > benchmark-data/transfer-txs.csv

# High-value transactions
sqlite3 -header -csv collector-db/transactions.db \
  "SELECT txId FROM transactions WHERE CAST(txFee AS INTEGER) > 0 ORDER BY RANDOM() LIMIT 100000;" \
  > benchmark-data/fee-txs.csv
```

### 3. Export Receipts

```bash
# Basic export
sqlite3 -header -csv collector-db/receipts.db \
  "SELECT receiptId FROM receipts ORDER BY RANDOM() LIMIT 100000;" \
  > benchmark-data/receipts.csv

# Latest receipts
sqlite3 -header -csv collector-db/receipts.db \
  "SELECT receiptId FROM receipts ORDER BY cycle DESC, timestamp DESC LIMIT 100000;" \
  > benchmark-data/receipts.csv

# Receipts from specific cycle range
sqlite3 -header -csv collector-db/receipts.db \
  "SELECT receiptId FROM receipts WHERE cycle BETWEEN 80000 AND 81000 ORDER BY RANDOM() LIMIT 100000;" \
  > benchmark-data/receipts-recent.csv
```

### 4. Export Cycles

```bash
# Latest 100000 cycles
sqlite3 -header -csv collector-db/cycles.db \
  "SELECT counter FROM cycles ORDER BY counter DESC LIMIT 100000;" \
  > benchmark-data/cycles.csv

# Cycles with markers
sqlite3 -header -csv collector-db/cycles.db \
  "SELECT counter, marker FROM cycles ORDER BY counter DESC LIMIT 100000;" \
  > benchmark-data/cycles-with-markers.csv

# Specific cycle range
sqlite3 -header -csv collector-db/cycles.db \
  "SELECT counter FROM cycles WHERE counter BETWEEN 80000 AND 81000;" \
  > benchmark-data/cycles-range.csv
```

### 5. Combined Export

Create a combined CSV with all data types:

```bash
# Create headers
echo "accountId,txId,receiptId,cycleNumber" > benchmark-data/combined.csv

# Use a SQL join or paste command
paste -d',' \
  <(sqlite3 collector-db/accounts.db "SELECT accountId FROM accounts ORDER BY RANDOM() LIMIT 100000;") \
  <(sqlite3 collector-db/transactions.db "SELECT txId FROM transactions ORDER BY RANDOM() LIMIT 100000;") \
  <(sqlite3 collector-db/receipts.db "SELECT receiptId FROM receipts ORDER BY RANDOM() LIMIT 100000;") \
  <(sqlite3 collector-db/cycles.db "SELECT counter FROM cycles ORDER BY counter DESC LIMIT 100000;") \
  >> benchmark-data/combined.csv
```

---

## SQLite3 CLI Options Explained

```bash
sqlite3 [OPTIONS] database.db "SQL QUERY"
```

**Key Options:**

- `-header` - Include column names as first row
- `-csv` - Output in CSV format (default is pipe-separated)
- `-column` - Column-aligned output (for viewing)
- `-json` - Output as JSON array
- `-line` - One value per line

**Examples:**

```bash
# CSV with header (recommended for Artillery)
sqlite3 -header -csv collector-db/accounts.db "SELECT accountId FROM accounts LIMIT 10;"

# JSON output
sqlite3 -json collector-db/accounts.db "SELECT accountId FROM accounts LIMIT 10;"

# Pretty table format (for viewing, not exporting)
sqlite3 -column -header collector-db/accounts.db "SELECT accountId FROM accounts LIMIT 10;"

# Without header (if Artillery/autocannon expects no header)
sqlite3 -csv collector-db/accounts.db "SELECT accountId FROM accounts LIMIT 10;"
```

---

## Advanced Queries

### Export Accounts with Metadata

```bash
sqlite3 -header -csv collector-db/accounts.db "
  SELECT
    accountId,
    accountType,
    timestamp,
    cycleNumber
  FROM accounts
  ORDER BY RANDOM()
  LIMIT 100000;
" > benchmark-data/accounts-detailed.csv
```

### Export Transactions by Time Range

```bash
sqlite3 -header -csv collector-db/transactions.db "
  SELECT txId
  FROM transactions
  WHERE timestamp > strftime('%s', 'now', '-7 days') * 1000
  ORDER BY RANDOM()
  LIMIT 100000;
" > benchmark-data/transactions-last-7days.csv
```

### Export Active User Accounts Only

```bash
sqlite3 -header -csv collector-db/accounts.db "
  SELECT DISTINCT accountId
  FROM accounts
  WHERE accountType = 9
    AND data LIKE '%balance%'
  ORDER BY RANDOM()
  LIMIT 100000;
" > benchmark-data/active-user-accounts.csv
```

### Export Failed Transactions

```bash
sqlite3 -header -csv collector-db/receipts.db "
  SELECT receiptId
  FROM receipts
  WHERE result LIKE '%fail%'
  ORDER BY RANDOM()
  LIMIT 100000;
" > benchmark-data/failed-txs.csv
```

---

## One-Liner Shell Script

Create a script to export all data at once:

```bash
#!/bin/bash
# export-data.sh

DEST="benchmark-data"
mkdir -p "$DEST"

echo "Exporting test data..."

# Accounts
sqlite3 -header -csv collector-db/accounts.db \
  "SELECT accountId FROM accounts ORDER BY RANDOM() LIMIT 100000;" \
  > "$DEST/accounts.csv"
echo "✓ Accounts: $(wc -l < "$DEST/accounts.csv") rows"

# Transactions
sqlite3 -header -csv collector-db/transactions.db \
  "SELECT txId FROM transactions ORDER BY RANDOM() LIMIT 100000;" \
  > "$DEST/transactions.csv"
echo "✓ Transactions: $(wc -l < "$DEST/transactions.csv") rows"

# Receipts
sqlite3 -header -csv collector-db/receipts.db \
  "SELECT receiptId FROM receipts ORDER BY RANDOM() LIMIT 100000;" \
  > "$DEST/receipts.csv"
echo "✓ Receipts: $(wc -l < "$DEST/receipts.csv") rows"

# Cycles
sqlite3 -header -csv collector-db/cycles.db \
  "SELECT counter FROM cycles ORDER BY counter DESC LIMIT 100000;" \
  > "$DEST/cycles.csv"
echo "✓ Cycles: $(wc -l < "$DEST/cycles.csv") rows"

echo "Done! Files in $DEST/"
```

Make executable and run:

```bash
chmod +x export-data.sh
./export-data.sh
```

---

## Verify Exported Data

Check what you exported:

```bash
# Count rows (subtract 1 for header)
wc -l benchmark-data/*.csv

# View first 5 rows
head -5 benchmark-data/accounts.csv

# View random sample
tail -n +2 benchmark-data/transactions.csv | shuf -n 5

# Check for duplicates
tail -n +2 benchmark-data/accounts.csv | sort | uniq -d
```

---

## Use with Load Testing Tools

### With Artillery

```yaml
# artillery-test.yml
config:
  target: 'http://127.0.0.1:6001'
  payload:
    path: 'benchmark-data/accounts.csv'
    fields: ['accountId']
    order: 'random'
    skipHeader: true

scenarios:
  - flow:
      - get:
          url: '/api/account?accountId={{ accountId }}'
```

Run:

```bash
artillery run artillery-test.yml
```

### With autocannon CLI

```bash
# Pick random ID from exported CSV
ACCOUNT_ID=$(tail -n +2 benchmark-data/accounts.csv | shuf -n 1)

autocannon -c 100 -d 30 \
  "http://127.0.0.1:6001/api/account?accountId=$ACCOUNT_ID"
```

---

## Troubleshooting

### "database is locked"

The collector is running and has the DB locked. Either:

- Stop the collector temporarily
- Use `.mode csv` in interactive mode (doesn't lock)

```bash
# Interactive mode (doesn't lock DB)
sqlite3 collector-db/accounts.db
.mode csv
.headers on
.output benchmark-data/accounts.csv
SELECT accountId FROM accounts ORDER BY RANDOM() LIMIT 100000;
.quit
```

### "no such table: accounts"

Check table name:

```bash
sqlite3 collector-db/accounts.db ".tables"
```

### "column not found"

Check column names:

```bash
sqlite3 collector-db/accounts.db ".schema accounts"
```

### Empty CSV

Check if database has data:

```bash
sqlite3 collector-db/accounts.db "SELECT COUNT(*) FROM accounts;"
```

---

## Pro Tips

### 1. Export Only Unique Values

```bash
sqlite3 -header -csv collector-db/accounts.db \
  "SELECT DISTINCT accountId FROM accounts ORDER BY RANDOM() LIMIT 100000;" \
  > benchmark-data/accounts.csv
```

### 2. Sample from Different Cycles

```bash
sqlite3 -header -csv collector-db/transactions.db "
  SELECT txId
  FROM transactions
  WHERE cycleNumber IN (
    SELECT DISTINCT cycleNumber
    FROM transactions
    ORDER BY RANDOM()
    LIMIT 10
  )
  LIMIT 100000;
" > benchmark-data/transactions-multi-cycle.csv
```

### 3. Export to JSON for Other Tools

```bash
sqlite3 -json collector-db/accounts.db \
  "SELECT accountId FROM accounts ORDER BY RANDOM() LIMIT 100000;" \
  > benchmark-data/accounts.json
```

### 4. Stratified Sampling

```bash
# 100 accounts from each of 5 cycles
sqlite3 -header -csv collector-db/accounts.db "
  WITH cycles AS (
    SELECT DISTINCT cycleNumber
    FROM accounts
    ORDER BY cycleNumber DESC
    LIMIT 5
  )
  SELECT a.accountId
  FROM accounts a
  INNER JOIN cycles c ON a.cycleNumber = c.cycleNumber
  GROUP BY a.cycleNumber
  HAVING COUNT(*) <= 100
  ORDER BY RANDOM()
  LIMIT 100000;
" > benchmark-data/accounts-stratified.csv
```

---

## Performance Comparison

| Method                        | Speed          | Complexity | Node.js Required |
| ----------------------------- | -------------- | ---------- | ---------------- |
| SQLite3 CLI                   | ⚡⚡⚡ Fastest | Simple     | ❌ No            |
| npm run benchmark:export-data | ⚡⚡ Fast      | Easy       | ✅ Yes           |
| Custom Script                 | ⚡ Medium      | Complex    | ✅ Yes           |

**Recommendation:** Use SQLite3 CLI for quick exports, npm script for automated workflows.

---

## Summary

**Quick export (copy-paste ready):**

```bash
mkdir -p benchmark-data

sqlite3 -header -csv collector-db/accounts.db \
  "SELECT accountId FROM accounts ORDER BY RANDOM() LIMIT 100000;" \
  > benchmark-data/accounts.csv

sqlite3 -header -csv collector-db/transactions.db \
  "SELECT txId FROM transactions ORDER BY RANDOM() LIMIT 100000;" \
  > benchmark-data/transactions.csv

sqlite3 -header -csv collector-db/receipts.db \
  "SELECT receiptId FROM receipts ORDER BY RANDOM() LIMIT 100000;" \
  > benchmark-data/receipts.csv

sqlite3 -header -csv collector-db/cycles.db \
  "SELECT counter FROM cycles ORDER BY counter DESC LIMIT 100000;" \
  > benchmark-data/cycles.csv

echo "✓ Data exported to benchmark-data/"
```

**Then use with Artillery:**

```bash
artillery run benchmark/artillery-accounts.yml
```

Perfect for CI/CD, cron jobs, or quick manual testing! 🚀
