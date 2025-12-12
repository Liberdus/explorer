#!/bin/bash
# autocannon CLI examples using exported test data
# These examples show how to use autocannon directly from command line

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

BASE_URL="${API_URL:-http://127.0.0.1:6001}"
DATA_DIR="benchmark-data"

echo -e "${BLUE}=== autocannon CLI Load Tests ===${NC}\n"

# Check if data files exist
if [ ! -d "$DATA_DIR" ]; then
  echo "Error: Test data not found. Run: npm run benchmark:export-data"
  exit 1
fi

# Test 1: Account queries
echo -e "${GREEN}Test 1: Account Queries${NC}"
echo "Reading random account IDs from $DATA_DIR/accounts.csv..."

# Use a random account ID from the CSV
ACCOUNT_ID=$(tail -n +2 "$DATA_DIR/accounts.csv" | shuf -n 1)
echo "Testing with Account ID: $ACCOUNT_ID"

autocannon \
  -c 100 \
  -d 30 \
  -m GET \
  "$BASE_URL/api/account?accountId=$ACCOUNT_ID"

echo ""
echo -e "${GREEN}Test 2: Transaction Queries${NC}"
echo "Reading random transaction IDs from $DATA_DIR/transactions.csv..."

# Use a random transaction ID from the CSV
TX_ID=$(tail -n +2 "$DATA_DIR/transactions.csv" | shuf -n 1)
echo "Testing with Transaction ID: $TX_ID"

autocannon \
  -c 100 \
  -d 30 \
  -m GET \
  "$BASE_URL/api/transaction?txId=$TX_ID"

echo ""
echo -e "${GREEN}Test 3: Mixed Load (Multiple IDs)${NC}"
echo "Testing with 10 random transaction IDs (simulates varied queries)..."

# Create a temp file with multiple URLs
TEMP_URLS=$(mktemp)
tail -n +2 "$DATA_DIR/transactions.csv" | shuf -n 10 | \
  awk -v base="$BASE_URL" '{print base "/api/transaction?txId=" $1}' > "$TEMP_URLS"

echo "Generated test URLs:"
cat "$TEMP_URLS"
echo ""

# Note: autocannon doesn't support multiple URLs from file in CLI mode
# But you can pipe them or use the Node.js script approach below
echo "For multiple URLs, use: npm run benchmark:autocannon-advanced"

rm "$TEMP_URLS"

echo ""
echo -e "${BLUE}=== Tests Complete ===${NC}"
echo ""
echo "For advanced multi-URL testing, see:"
echo "  - benchmark/autocannon-advanced.ts"
echo "  - npm run benchmark:autocannon-advanced"
