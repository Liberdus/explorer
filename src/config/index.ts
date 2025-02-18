import { readFileSync } from 'fs'
import merge from 'deepmerge'
import minimist from 'minimist'
import { join } from 'path'

export const envEnum = {
  DEV: 'development',
  PROD: 'production',
}

export enum explorerMode {
  WS = 'WS',
  MQ = 'MQ',
}

export interface Config {
  env: string
  host: string
  dbPath: string
  dataLogWrite: boolean
  dataLogWriter: {
    dirName: string
    maxLogFiles: number
    maxReceiptEntries: number
    maxCycleEntries: number
    maxOriginalTxEntries: number
  }
  collectorInfo: {
    publicKey: string
    secretKey: string
  }
  hashKey: string
  COLLECTOR_DB_DIR_PATH: string // Collectot DB folder name and path
  COLLECTOR_DATA: {
    cycleDB: string
    accountDB: string
    transactionDB: string
    receiptDB: string
    originalTxDataDB: string
    accountHistoryStateDB: string
  }
  COLLECTOR_STATS_DB_DIR_PATH: string // Collector stats DB folder name and path
  COLLECTOR_STATS_DATA: {
    validatorStatsDB: string
    transactionStatsDB: string
    dailyTransactionStatsDB: string
    coinStatsDB: string
    nodeStatsDB: string
    metadataDB: string
  }
  port: {
    collector: string
    server: string
  }
  distributorInfo: {
    ip: string
    port: string
    publicKey: string
  }
  verbose: boolean
  fastifyDebugLog: boolean
  rateLimit: number
  patchData: boolean
  subscription: {
    enabled: boolean
  }
  rpcUrl: string
  genesisLIBSupply: number
  apiUrl: string
  GTM_Id: string
  enableTxIdCache: boolean
  findTxIdInOriginalTx: boolean
  USAGE_ENDPOINTS_KEY: string
  processData: {
    indexReceipt: boolean
    indexOriginalTxData: boolean
  }
  saveAccountHistoryState: boolean
  DISTRIBUTOR_RECONNECT_INTERVAL: number
  CONNECT_TO_DISTRIBUTOR_MAX_RETRY: number
  explorerMode: string
  storeReceiptBeforeStates: boolean
  requestLimits: {
    MAX_RECEIPTS_PER_REQUEST: number
    MAX_ORIGINAL_TXS_PER_REQUEST: number
    MAX_CYCLES_PER_REQUEST: number
    MAX_ACCOUNTS_PER_REQUEST: number
    MAX_TRANSACTIONS_PER_REQUEST: number
    MAX_BETWEEN_CYCLES_PER_REQUEST: number
    MAX_ACCOUNT_HISTORY_STATES_PER_REQUEST: number
  }
  dexScreenerAPI: string // Dex Screener API URL for Liberdus token
}

let config: Config = {
  env: process.env.EXPLORER_SERVER_MODE || envEnum.DEV, //default to safe if no env is set
  host: process.env.HOST || '127.0.0.1',
  dbPath: process.env.DB_PATH?.replace(/\/+$/, '') || '.', // remove
  dataLogWrite: false,
  dataLogWriter: {
    dirName: 'data-logs',
    maxLogFiles: 10,
    maxReceiptEntries: 1000, // This value should be equivalent to the max TPS experiened by the network.
    maxCycleEntries: 1000,
    maxOriginalTxEntries: 1000, // This value should be equivalent to the max TPS experiened by the network.
  },
  subscription: {
    enabled: false,
  },
  collectorInfo: {
    publicKey:
      process.env.COLLECTOR_PUBLIC_KEY || '9426b64e675cad739d69526bf7e27f3f304a8a03dca508a9180f01e9269ce447',
    secretKey:
      process.env.COLLECTOR_SECRET_KEY ||
      '7d8819b6fac8ba2fbac7363aaeb5c517e52e615f95e1a161d635521d5e4969739426b64e675cad739d69526bf7e27f3f304a8a03dca508a9180f01e9269ce447',
  },
  hashKey: '69fa4195670576c0160d660c3be36556ff8d504725be8a59b5a96509e0c994bc',
  COLLECTOR_DB_DIR_PATH: 'collector-db',
  COLLECTOR_DATA: {
    cycleDB: 'cycles.sqlite3',
    accountDB: 'accounts.sqlite3',
    transactionDB: 'transactions.sqlite3',
    receiptDB: 'receipts.sqlite3',
    originalTxDataDB: 'originalTxsData.sqlite3',
    accountHistoryStateDB: 'accountHistoryState.sqlite3',
  },
  COLLECTOR_STATS_DB_DIR_PATH: 'collector-stats-db',
  COLLECTOR_STATS_DATA: {
    validatorStatsDB: 'validatorStats.sqlite3',
    transactionStatsDB: 'transactionStats.sqlite3',
    dailyTransactionStatsDB: 'dailyTransactionStats.sqlite3',
    coinStatsDB: 'coinStats.sqlite3',
    nodeStatsDB: 'nodeStats.sqlite3',
    metadataDB: 'metadata.sqlite3',
  },
  port: {
    collector: process.env.COLLECTORPORT || '4444',
    server: process.env.PORT || '6001',
  },
  distributorInfo: {
    ip: process.env.DISTRIBUTOR_IP || '127.0.0.1',
    port: process.env.DISTRIBUTOR_PORT || '6100',
    publicKey:
      process.env.DISTRIBUTOR_PUBLIC_KEY ||
      '758b1c119412298802cd28dbfa394cdfeecc4074492d60844cc192d632d84de3',
  },
  rpcUrl: process.env.RPC_URL || 'http://127.0.0.1:8080',
  apiUrl: '',
  verbose: false,
  fastifyDebugLog: false,
  genesisLIBSupply: 100000000,
  rateLimit: 100,
  patchData: false,
  GTM_Id: '',
  USAGE_ENDPOINTS_KEY: '',
  enableTxIdCache: true,
  findTxIdInOriginalTx: true,
  processData: {
    indexReceipt: true,
    indexOriginalTxData: true,
  },
  saveAccountHistoryState: false,
  DISTRIBUTOR_RECONNECT_INTERVAL: 10_000, // in ms
  CONNECT_TO_DISTRIBUTOR_MAX_RETRY: 10,
  explorerMode: process.env.EXPLORER_MODE || explorerMode.WS.toString(),
  storeReceiptBeforeStates: false,
  requestLimits: {
    MAX_RECEIPTS_PER_REQUEST: 100,
    MAX_ORIGINAL_TXS_PER_REQUEST: 100,
    MAX_CYCLES_PER_REQUEST: 100,
    MAX_ACCOUNTS_PER_REQUEST: 100,
    MAX_TRANSACTIONS_PER_REQUEST: 100,
    MAX_BETWEEN_CYCLES_PER_REQUEST: 100,
    MAX_ACCOUNT_HISTORY_STATES_PER_REQUEST: 100,
  },
  dexScreenerAPI:
    'https://api.dexscreener.com/latest/dex/search?q=0x693ed886545970F0a3ADf8C59af5cCdb6dDF0a76',
}

let DISTRIBUTOR_URL = `http://${config.distributorInfo.ip}:${config.distributorInfo.port}`

// Override default config params from config file, env vars, and cli args
export function overrideDefaultConfig(env: NodeJS.ProcessEnv, args: string[]): void {
  const file = join(process.cwd(), 'config.json')
  // Override config from config file
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const fileConfig = JSON.parse(readFileSync(file, { encoding: 'utf8' }))
    const overwriteMerge = (target: [], source: []): [] => source
    config = merge(config, fileConfig, { arrayMerge: overwriteMerge })
  } catch (err) {
    if (err && err.code !== 'ENOENT') {
      console.warn('Failed to parse config file:', err)
    }
  }

  // Override config from env vars
  for (const param in config) {
    if (env[param]) {
      switch (typeof config[param]) {
        case 'number': {
          config[param] = Number(env[param])
          break
        }
        case 'string': {
          config[param] = String(env[param])
          break
        }
        case 'object': {
          try {
            const parameterStr = env[param]
            if (parameterStr) {
              const parameterObj = JSON.parse(parameterStr)
              config[param] = parameterObj
            }
          } catch (e) {
            console.error(e)
            console.error('Unable to JSON parse', env[param])
          }
          break
        }
        case 'boolean': {
          config[param] = String(env[param]).toLowerCase() === 'true'
          break
        }
      }
    }
  }

  // Override config from cli args
  const parsedArgs = minimist(args.slice(2))
  for (const param of Object.keys(config)) {
    if (parsedArgs[param]) {
      switch (typeof config[param]) {
        case 'number': {
          config[param] = Number(parsedArgs[param])
          break
        }
        case 'string': {
          config[param] = String(parsedArgs[param])
          break
        }
        case 'boolean': {
          if (typeof parsedArgs[param] === 'boolean') {
            config[param] = parsedArgs[param]
          } else {
            config[param] = String(parsedArgs[param]).toLowerCase() === 'true'
          }
          break
        }
      }
    }
  }

  DISTRIBUTOR_URL = `http://${config.distributorInfo.ip}:${config.distributorInfo.port}`
}

export { config, DISTRIBUTOR_URL }

export const NetworkAccountId = '0'.repeat(64)
