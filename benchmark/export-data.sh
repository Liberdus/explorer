#!/bin/bash
# Quick data export script using SQLite3 CLI
# Usage: ./benchmark/export-data.sh [num_rows]

set -e

# Number of rows to export (default: 100000)
NUM_ROWS="${1:-100000}"
DEST="benchmark-data"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Exporting test data using SQLite3 CLI...${NC}"
echo "Rows per table: $NUM_ROWS"
echo ""

# Create destination directory
mkdir -p "$DEST"

# Check if databases exist
if [ ! -d "collector-db" ]; then
  echo "Error: collector-db/ directory not found"
  echo "Make sure you're in the project root directory"
  exit 1
fi

# Export Accounts
echo -n "Exporting accounts... "
sqlite3 -header -csv collector-db/accounts.db \
  "SELECT accountId FROM accounts ORDER BY RANDOM() LIMIT $NUM_ROWS;" \
  > "$DEST/accounts.csv"
ACCOUNT_COUNT=$(tail -n +2 "$DEST/accounts.csv" | wc -l | tr -d ' ')
echo -e "${GREEN}✓${NC} $ACCOUNT_COUNT rows"

# Export Transactions
echo -n "Exporting transactions... "
sqlite3 -header -csv collector-db/transactions.db \
  "SELECT txId FROM transactions ORDER BY RANDOM() LIMIT $NUM_ROWS;" \
  > "$DEST/transactions.csv"
TX_COUNT=$(tail -n +2 "$DEST/transactions.csv" | wc -l | tr -d ' ')
echo -e "${GREEN}✓${NC} $TX_COUNT rows"

# Export Receipts
echo -n "Exporting receipts... "
sqlite3 -header -csv collector-db/receipts.db \
  "SELECT receiptId FROM receipts ORDER BY RANDOM() LIMIT $NUM_ROWS;" \
  > "$DEST/receipts.csv"
RECEIPT_COUNT=$(tail -n +2 "$DEST/receipts.csv" | wc -l | tr -d ' ')
echo -e "${GREEN}✓${NC} $RECEIPT_COUNT rows"

# Export Cycles
echo -n "Exporting cycles... "
sqlite3 -header -csv collector-db/cycles.db \
  "SELECT counter FROM cycles ORDER BY counter DESC LIMIT $NUM_ROWS;" \
  > "$DEST/cycles.csv"
CYCLE_COUNT=$(tail -n +2 "$DEST/cycles.csv" | wc -l | tr -d ' ')
echo -e "${GREEN}✓${NC} $CYCLE_COUNT rows"

# Export Cycle Markers (for marker-based queries)
echo -n "Exporting cycle markers... "
sqlite3 -csv collector-db/cycles.db \
  "SELECT marker FROM cycles ORDER BY counter DESC LIMIT $NUM_ROWS;" \
  > "$DEST/cycle-markers.csv"
MARKER_COUNT=$(wc -l < "$DEST/cycle-markers.csv" | tr -d ' ')
echo -e "${GREEN}✓${NC} $MARKER_COUNT rows"

# Create combined CSV
echo -n "Creating combined CSV... "
echo "accountId,txId,receiptId,cycleNumber" > "$DEST/combined.csv"
paste -d',' \
  <(tail -n +2 "$DEST/accounts.csv") \
  <(tail -n +2 "$DEST/transactions.csv") \
  <(tail -n +2 "$DEST/receipts.csv") \
  <(tail -n +2 "$DEST/cycles.csv") \
  >> "$DEST/combined.csv"
COMBINED_COUNT=$(tail -n +2 "$DEST/combined.csv" | wc -l | tr -d ' ')
echo -e "${GREEN}✓${NC} $COMBINED_COUNT rows"

# Export as JSON for other tools
echo -n "Creating JSON exports... "
sqlite3 -json collector-db/accounts.db \
  "SELECT accountId FROM accounts ORDER BY RANDOM() LIMIT $NUM_ROWS;" \
  > "$DEST/accounts.json"

sqlite3 -json collector-db/transactions.db \
  "SELECT txId FROM transactions ORDER BY RANDOM() LIMIT $NUM_ROWS;" \
  > "$DEST/transactions.json"
echo -e "${GREEN}✓${NC}"

echo ""
echo -e "${GREEN}=== Export Complete ===${NC}"
echo "Output directory: $DEST/"
echo ""
echo "Files created:"
ls -lh "$DEST" | tail -n +2 | awk '{printf "  %s (%s)\n", $9, $5}'
echo ""
echo "Usage:"
echo "  - Artillery: artillery run benchmark/artillery-accounts.yml"
echo "  - autocannon: npm run benchmark:autocannon-advanced"
echo "  - CLI test:   TX_ID=\$(tail -n +2 $DEST/transactions.csv | shuf -n 1) && autocannon http://127.0.0.1:6001/api/transaction?txId=\$TX_ID"
