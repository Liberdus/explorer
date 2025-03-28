import * as fs from 'fs'
import axios from 'axios'

const EXPLORE_URL = 'http://localhost:6001'
// Get the startTimestamp and endTimestamp from the arguments
const startTimestamp = process.argv[2] || Date.now()
const endTimestamp = process.argv[3] || Date.now()
console.log(startTimestamp, endTimestamp)

/**
 * Fetches and analyzes transactions from the explorer API
 * Generates a map of accounts with their registration and first transaction details
 */
const analyzeAccountTransactions = async (): Promise<void> => {
  // Add the startTimestamp and endTimestamp to the url
  const url = `${EXPLORE_URL}/api/transaction?startTimestamp=${startTimestamp}&endTimestamp=${endTimestamp}`

  const accountsMap = {}

  let result = await axios.get(url)
  if (result.data && result.data.success) {
    // console.log(result.data)
    const totalPages = result.data.totalPages
    for (let i = 1; i <= totalPages; i++) {
      console.log(`Getting txs from page ${i}`)
      const a = url + `&page=${i}`
      result = await axios.get(a)
      if (result.data && result.data.success) {
        result.data.transactions.forEach((tx) => {
          // Track first transaction of the registered account
          if (accountsMap[tx.txFrom]) {
            if (!accountsMap[tx.txFrom].firstTx)
              accountsMap[tx.txFrom].firstTx = {
                txId: tx.txId,
                timestamp: tx.timestamp,
                transactionType: tx.transactionType,
                txTo: tx.txTo,
              }
          }

          // Track account registration
          if (tx.transactionType === 'register') {
            accountsMap[tx.txFrom] = {
              address: tx.txFrom,
              alias: tx.originalTxData.tx.alias,
              aliasHash: tx.originalTxData.tx.aliasHash,
            }
          }
        })
      }
    }
    console.dir(accountsMap, { depth: null })
    const fileName = `registered-accounts-${startTimestamp}-${endTimestamp}.json`

    fs.writeFileSync(fileName, JSON.stringify(accountsMap, null, 2))
  }
}
analyzeAccountTransactions()
