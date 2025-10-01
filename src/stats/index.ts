import { Database } from 'sqlite3'
import { config } from '../config'
import { createDB, runCreate, close } from '../storage/sqlite3storage'
import { createDirectories } from '../utils'
import * as ValidatorStatsDB from './validatorStats'
import * as TransactionStatsDB from './transactionStats'
import * as DailyTransactionStatsDB from './dailyTransactionStats'
import * as DailyAccountStatsDB from './dailyAccountStats'
import * as DailyNetworkStatsDB from './dailyNetworkStats'
import * as DailyCoinStatsDB from './dailyCoinStats'
import * as CoinStatsDB from './coinStats'
import * as NodeStatsDB from './nodeStats'
import * as MetadataDB from './metadata'
import * as TotalAccountBalanceDB from '../stats/totalAccountBalance'

export let validatorStatsDatabase: Database
export let transactionStatsDatabase: Database
export let dailyTransactionStatsDatabase: Database
export let dailyAccountStatsDatabase: Database
export let dailyNetworkStatsDatabase: Database
export let dailyCoinStatsDatabase: Database
export let coinStatsDatabase: Database
export let nodeStatsDatabase: Database
export let metadataDatabase: Database
export let totalAccountBalanceDatabase: Database

export const initializeStatsDB = async (): Promise<void> => {
  createDirectories(config.COLLECTOR_STATS_DB_DIR_PATH)
  validatorStatsDatabase = await createDB(
    `${config.COLLECTOR_STATS_DB_DIR_PATH}/${config.COLLECTOR_STATS_DATA.validatorStatsDB}`,
    'ValidatorStats'
  )
  transactionStatsDatabase = await createDB(
    `${config.COLLECTOR_STATS_DB_DIR_PATH}/${config.COLLECTOR_STATS_DATA.transactionStatsDB}`,
    'TransactionStats'
  )
  dailyTransactionStatsDatabase = await createDB(
    `${config.COLLECTOR_STATS_DB_DIR_PATH}/${config.COLLECTOR_STATS_DATA.dailyTransactionStatsDB}`,
    'DailyTransactionStats'
  )
  dailyAccountStatsDatabase = await createDB(
    `${config.COLLECTOR_STATS_DB_DIR_PATH}/${config.COLLECTOR_STATS_DATA.dailyAccountStatsDB}`,
    'DailyAccountStats'
  )
  dailyNetworkStatsDatabase = await createDB(
    `${config.COLLECTOR_STATS_DB_DIR_PATH}/${config.COLLECTOR_STATS_DATA.dailyNetworkStatsDB}`,
    'DailyNetworkStats'
  )
  dailyCoinStatsDatabase = await createDB(
    `${config.COLLECTOR_STATS_DB_DIR_PATH}/${config.COLLECTOR_STATS_DATA.dailyCoinStatsDB}`,
    'DailyCoinStats'
  )
  coinStatsDatabase = await createDB(
    `${config.COLLECTOR_STATS_DB_DIR_PATH}/${config.COLLECTOR_STATS_DATA.coinStatsDB}`,
    'CoinStats'
  )
  nodeStatsDatabase = await createDB(
    `${config.COLLECTOR_STATS_DB_DIR_PATH}/${config.COLLECTOR_STATS_DATA.nodeStatsDB}`,
    'NodeStats'
  )
  metadataDatabase = await createDB(
    `${config.COLLECTOR_STATS_DB_DIR_PATH}/${config.COLLECTOR_STATS_DATA.metadataDB}`,
    'Metadata'
  )
  totalAccountBalanceDatabase = await createDB(
    `${config.COLLECTOR_STATS_DB_DIR_PATH}/${config.COLLECTOR_STATS_DATA.totalAccountBalanceDB}`,
    'TotalAccountBalance'
  )

  await runCreate(
    validatorStatsDatabase,
    `CREATE TABLE if not exists validators (
      cycle NUMBER NOT NULL UNIQUE PRIMARY KEY,
      active NUMBER NOT NULL,
      activated NUMBER NOT NULL,
      syncing NUMBER NOT NULL,
      joined NUMBER NOT NULL,
      removed NUMBER NOT NULL,
      apoped NUMBER NOT NULL,
      timestamp BIGINT NOT NULL
    )`
  )
  // await runCreate(validatorStatsDatabase, 'Drop INDEX if exists `validators_idx`')
  await runCreate(
    validatorStatsDatabase,
    'CREATE INDEX if not exists `validators_idx` ON `validators` (`cycle` DESC, `timestamp` DESC)'
  )
  await runCreate(
    transactionStatsDatabase,
    `CREATE TABLE if not exists transactions (
      cycle NUMBER NOT NULL UNIQUE PRIMARY KEY,
      timestamp BIGINT NOT NULL,
      totalTxs NUMBER NOT NULL DEFAULT 0,
      ${TransactionStatsDB.generateTransactionStatsSchema()}
    )`
  )
  // await runCreate(transactionStatsDatabase, 'Drop INDEX if exists `transactions_idx`');
  await runCreate(
    transactionStatsDatabase,
    'CREATE INDEX if not exists `transactions_idx` ON `transactions` (`cycle` DESC, `timestamp` DESC)'
  )
  await runCreate(
    dailyTransactionStatsDatabase,
    `CREATE TABLE if not exists daily_transactions (
      dateStartTime BIGINT NOT NULL UNIQUE PRIMARY KEY,
      totalTxs NUMBER NOT NULL,
      totalUserTxs NUMBER NOT NULL DEFAULT 0,
      txsByType TEXT NOT NULL
    )`
  )

  await runCreate(
    dailyAccountStatsDatabase,
    `CREATE TABLE if not exists daily_accounts (
      dateStartTime BIGINT NOT NULL UNIQUE PRIMARY KEY,
      newAccounts NUMBER NOT NULL,
      newUserAccounts NUMBER NOT NULL,
      activeAccounts NUMBER NOT NULL,
      activeBalanceAccounts NUMBER NOT NULL DEFAULT 0
    )`
  )

  await runCreate(
    dailyNetworkStatsDatabase,
    `CREATE TABLE if not exists daily_network (
      dateStartTime BIGINT NOT NULL UNIQUE PRIMARY KEY,
      stabilityFactorStr TEXT NOT NULL,
      transactionFeeUsdStr TEXT NOT NULL,
      stakeRequiredUsdStr TEXT NOT NULL,
      nodeRewardAmountUsdStr TEXT NOT NULL,
      nodePenaltyUsdStr TEXT NOT NULL,
      defaultTollUsdStr TEXT NOT NULL,
      minTollUsdStr TEXT NOT NULL,
      activeNodes NUMBER NOT NULL,
      standbyNodes NUMBER NOT NULL
    )`
  )

  await runCreate(
    dailyCoinStatsDatabase,
    `CREATE TABLE if not exists daily_coin_stats (
      dateStartTime BIGINT NOT NULL UNIQUE PRIMARY KEY,
      mintedCoin BIGINT NOT NULL DEFAULT 0,
      transactionFee BIGINT NOT NULL DEFAULT 0,
      burntFee BIGINT NOT NULL DEFAULT 0,
      stakeAmount BIGINT NOT NULL DEFAULT 0,
      unStakeAmount BIGINT NOT NULL DEFAULT 0,
      rewardAmountRealized BIGINT NOT NULL DEFAULT 0,
      rewardAmountUnrealized BIGINT NOT NULL DEFAULT 0,
      penaltyAmount BIGINT NOT NULL DEFAULT 0
    )`
  )

  // await runCreate(dailyTransactionStatsDatabase, 'Drop INDEX if exists `daily_transactions_idx`');
  // await runCreate(
  //   dailyTransactionStatsDatabase,
  //   'CREATE INDEX if not exists `daily_transactions_idx` ON `daily_transactions` (`dateStartTime` DESC)'
  // )
  await runCreate(
    coinStatsDatabase,
    `CREATE TABLE if not exists coin_stats (
      cycle NUMBER NOT NULL UNIQUE PRIMARY KEY,
      totalSupplyChange BIGINT NOT NULL,
      totalStakeChange BIGINT NOT NULL,
      transactionFee BIGINT NOT NULL DEFAULT 0,
      networkCommission BIGINT NOT NULL DEFAULT 0,
      timestamp BIGINT NOT NULL
    )`
  )
  // await runCreate(coinStatsDatabase, 'Drop INDEX if exists `coin_stats_idx`');
  await runCreate(
    coinStatsDatabase,
    'CREATE INDEX if not exists `coin_stats_idx` ON `coin_stats` (`cycle` DESC, `timestamp` DESC)'
  )

  await runCreate(
    nodeStatsDatabase,
    `CREATE TABLE IF NOT EXISTS node_stats (
      nodeAddress STRING NOT NULL UNIQUE PRIMARY KEY,
      nominator STRING NOT NULL,
      nodeId STRING,
      currentState STRING NOT NULL,
      totalStandbyTime NUMBER NOT NULL,
      totalActiveTime NUMBER NOT NULL,
      totalSyncTime NUMBER NOT NULL,
      timestamp BIGINT NOT NULL
    )`
  )

  await runCreate(nodeStatsDatabase, 'CREATE INDEX if not exists `node_stats_idx` ON `node_stats` (`nodeId`)')

  // metadata table to store the last cycle number for which stats have been processed
  await runCreate(
    metadataDatabase,
    `CREATE TABLE IF NOT EXISTS metadata (
      type STRING NOT NULL UNIQUE PRIMARY KEY,
      cycleNumber NUMBER NOT NULL
    )`
  )

  await runCreate(
    totalAccountBalanceDatabase,
    `CREATE TABLE if not exists total_account_balances (
      cycleNumber NUMBER NOT NULL UNIQUE PRIMARY KEY,
      timestamp BIGINT NOT NULL,
      totalBalance TEXT NOT NULL,
      calculatedSupply TEXT NOT NULL,
      difference TEXT NOT NULL,
      differencePercentage REAL NOT NULL,
      isWithinTolerance INTEGER NOT NULL,
      accountsProcessed INTEGER NOT NULL
    )`
  )
  await runCreate(
    totalAccountBalanceDatabase,
    'CREATE INDEX if not exists `total_account_balances_idx` ON `total_account_balances` (`cycleNumber` DESC, `timestamp` DESC)'
  )
}

export const closeStatsDatabase = async (): Promise<void> => {
  const promises = []
  promises.push(close(validatorStatsDatabase, 'ValidatorStats'))
  promises.push(close(transactionStatsDatabase, 'TransactionStats'))
  promises.push(close(dailyTransactionStatsDatabase, 'DailyTransactionStats'))
  promises.push(close(dailyAccountStatsDatabase, 'DailyAccountStats'))
  promises.push(close(dailyNetworkStatsDatabase, 'DailyNetworkStats'))
  promises.push(close(dailyCoinStatsDatabase, 'DailyCoinStats'))
  promises.push(close(coinStatsDatabase, 'CoinStats'))
  promises.push(close(nodeStatsDatabase, 'NodeStats'))
  promises.push(close(metadataDatabase, 'Metadata'))
  promises.push(close(totalAccountBalanceDatabase, 'TotalAccountBalance'))
  await Promise.all(promises)
}

export {
  ValidatorStatsDB,
  TransactionStatsDB,
  DailyTransactionStatsDB,
  DailyAccountStatsDB,
  DailyNetworkStatsDB,
  DailyCoinStatsDB,
  CoinStatsDB,
  NodeStatsDB,
  MetadataDB,
  TotalAccountBalanceDB,
}
