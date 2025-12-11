import fs from 'fs'
import autocannon, { Instance } from 'autocannon'

/**
 * Prerequisites:
 * - Export the accountIds and txIds from the SQLite databases using the following commands
 */
// sqlite3 -noheader -separator $'\n' collector-db/accounts.sqlite3 \
//   "SELECT accountId FROM accounts;" \
// | jq -R -s 'split("\n")[:-1]' > benchmark-data/accountIds.json

// sqlite3 -noheader -separator $'\n' collector-db/transactions.sqlite3 \
//   "SELECT txId FROM transactions;" \
// | jq -R -s 'split("\n")[:-1]' > benchmark-data/txIds.json

const baseUrl = 'http://127.0.0.1:6001'
// Load accountIds/txIds as a simple array

const ids: string[] = JSON.parse(fs.readFileSync('./benchmark-data/accountIds.json', 'utf8'))
const endpoint = `/api/account`
const path = `?accountId=`

// const ids: string[] = JSON.parse(fs.readFileSync('./benchmark-data/txIds.json', 'utf8'))
// const endpoint = `/api/transaction`
// const path = `?txId=`

console.log('Loaded ids', ids.length)

function getRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

// Create autocannon instance and store it
const instance: Instance = autocannon(
  {
    url: baseUrl,
    connections: 100,
    duration: 30,
    requests: [
      {
        method: 'GET',
        path: endpoint,
        setupRequest: (req) => {
          const id = getRandom(ids)
          req.path = `${endpoint}${path}${id}`
          return req
        },
      },
    ],
  },
  (err, result) => {
    if (err) console.error(err)
    else console.log('Done!')
    // console.log(autocannon.printResult(result))
  }
)

// ✅ Optional: show live stats in the terminal
autocannon.track(instance)
