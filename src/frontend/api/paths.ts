// config variables
import { config } from '../../config'

const port = process.argv[2]
if (port && Number.isInteger(Number(port))) {
  config.port.server = port
}
let BASE_URL = `http://${config.host}:${config.port.server}`

if (config.apiUrl != '') BASE_URL = config.apiUrl

console.log('BASE_URL', BASE_URL)

export const PATHS = {
  BASE_URL,
  TOTAL_DATA: BASE_URL + '/totalData',
  TRANSACTION: BASE_URL + '/api/transaction',
  TRANSACTION_DETAIL: BASE_URL + '/api/transaction',
  RECEIPT_DETAIL: BASE_URL + '/api/receipt',
  CYCLE: BASE_URL + '/api/cycleinfo',
  ACCOUNT: BASE_URL + '/api/account',
  ORIGINAL_TX: BASE_URL + '/api/originalTx',
  STATS_VALIDATOR: BASE_URL + '/api/stats/validator',
  STATS_ACCOUNT: BASE_URL + '/api/stats/account',
  STATS_TRANSACTION: BASE_URL + '/api/stats/transaction',
  STATS_COIN: BASE_URL + '/api/stats/coin',
}
