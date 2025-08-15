import { Database } from 'sqlite3'
import { config } from '../config'
import { createDB, runCreate, close } from '../storage/sqlite3storage'
import { createDirectories } from '../utils'
import * as ValidatorStatsDB from './validatorStats'
import * as TransactionStatsDB from './transactionStats'
import * as DailyTransactionStatsDB from './dailyTransactionStats'
import * as CoinStatsDB from './coinStats'
import * as NodeStatsDB from './nodeStats'
import * as MetadataDB from './metadata'
import * as TotalAccountBalanceDB from '../stats/totalAccountBalance'

export let validatorStatsDatabase: Database
export let transactionStatsDatabase: Database
export let dailyTransactionStatsDatabase: Database
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
    `${config.COLLECTOR_DB_DIR_PATH}/totalAccountBalances.sqlite3`,
    'TotalAccountBalance'
  )

  await runCreate(
    validatorStatsDatabase,
    'CREATE TABLE if not exists `validators` (`cycle` NUMBER NOT NULL UNIQUE PRIMARY KEY, `active` NUMBER NOT NULL, `activated` NUMBER NOT NULL, `syncing` NUMBER NOT NULL, `joined` NUMBER NOT NULL, `removed` NUMBER NOT NULL, `apoped` NUMBER NOT NULL, `timestamp` BIGINT NOT NULL)'
  )
  // await runCreate(validatorStatsDatabase, 'Drop INDEX if exists `validators_idx`')
  await runCreate(
    validatorStatsDatabase,
    'CREATE INDEX if not exists `validators_idx` ON `validators` (`cycle` DESC, `timestamp` DESC)'
  )
  await runCreate(
    transactionStatsDatabase,
    `
    CREATE TABLE if not exists transactions (
      cycle NUMBER NOT NULL UNIQUE PRIMARY KEY,
      timestamp BIGINT NOT NULL,
      totalTxs NUMBER NOT NULL DEFAULT 0,
      totalInitNetworkTxs NUMBER NOT NULL DEFAULT 0,
      totalNetworkWindowsTxs NUMBER NOT NULL DEFAULT 0,
      totalSnapshotTxs NUMBER NOT NULL DEFAULT 0,
      totalEmailTxs NUMBER NOT NULL DEFAULT 0,
      totalGossipEmailHashTxs NUMBER NOT NULL DEFAULT 0,
      totalVerifyTxs NUMBER NOT NULL DEFAULT 0,
      totalRegisterTxs NUMBER NOT NULL DEFAULT 0,
      totalCreateTxs NUMBER NOT NULL DEFAULT 0,
      totalTransferTxs NUMBER NOT NULL DEFAULT 0,
      totalDistributeTxs NUMBER NOT NULL DEFAULT 0,
      totalMessageTxs NUMBER NOT NULL DEFAULT 0,
      totalTollTxs NUMBER NOT NULL DEFAULT 0,
      totalFriendTxs NUMBER NOT NULL DEFAULT 0,
      totalRemoveFriendTxs NUMBER NOT NULL DEFAULT 0,
      totalStakeTxs NUMBER NOT NULL DEFAULT 0,
      totalRemoveStakeTxs NUMBER NOT NULL DEFAULT 0,
      totalRemoveStakeRequestTxs NUMBER NOT NULL DEFAULT 0,
      totalNodeRewardTxs NUMBER NOT NULL DEFAULT 0,
      totalSnapshotClaimTxs NUMBER NOT NULL DEFAULT 0,
      totalIssueTxs NUMBER NOT NULL DEFAULT 0,
      totalProposalTxs NUMBER NOT NULL DEFAULT 0,
      totalVoteTxs NUMBER NOT NULL DEFAULT 0,
      totalTallyTxs NUMBER NOT NULL DEFAULT 0,
      totalApplyTallyTxs NUMBER NOT NULL DEFAULT 0,
      totalParametersTxs NUMBER NOT NULL DEFAULT 0,
      totalApplyParametersTxs NUMBER NOT NULL DEFAULT 0,
      totalDevIssueTxs NUMBER NOT NULL DEFAULT 0,
      totalDevProposalTxs NUMBER NOT NULL DEFAULT 0,
      totalDevVoteTxs NUMBER NOT NULL DEFAULT 0,
      totalDevTallyTxs NUMBER NOT NULL DEFAULT 0,
      totalApplyDevTallyTxs NUMBER NOT NULL DEFAULT 0,
      totalDevParametersTxs NUMBER NOT NULL DEFAULT 0,
      totalApplyDevParametersTxs NUMBER NOT NULL DEFAULT 0,
      totalDeveloperPaymentTxs NUMBER NOT NULL DEFAULT 0,
      totalApplyDeveloperPaymentTxs NUMBER NOT NULL DEFAULT 0,
      totalChangeConfigTxs NUMBER NOT NULL DEFAULT 0,
      totalApplyChangeConfigTxs NUMBER NOT NULL DEFAULT 0,
      totalChangeNetworkParamTxs NUMBER NOT NULL DEFAULT 0,
      totalApplyChangeNetworkParamTxs NUMBER NOT NULL DEFAULT 0,
      totalDepositStakeTxs NUMBER NOT NULL DEFAULT 0,
      totalWithdrawStakeTxs NUMBER NOT NULL DEFAULT 0,
      totalSetCertTimeTxs NUMBER NOT NULL DEFAULT 0,
      totalInitRewardTxs NUMBER NOT NULL DEFAULT 0,
      totalClaimRewardTxs NUMBER NOT NULL DEFAULT 0,
      totalApplyPenaltyTxs NUMBER NOT NULL DEFAULT 0
    )`
  )
  // await runCreate(transactionStatsDatabase, 'Drop INDEX if exists `transactions_idx`');
  await runCreate(
    transactionStatsDatabase,
    'CREATE INDEX if not exists `transactions_idx` ON `transactions` (`cycle` DESC, `timestamp` DESC)'
  )
  await runCreate(
    dailyTransactionStatsDatabase,
    `
    CREATE TABLE if not exists daily_transactions (
      dateStartTime BIGINT NOT NULL UNIQUE PRIMARY KEY,
      totalTxs NUMBER NOT NULL,
      totalTransferTxs NUMBER NOT NULL,
      totalMessageTxs NUMBER NOT NULL,
      totalDepositStakeTxs NUMBER NOT NULL,
      totalWithdrawStakeTxs NUMBER NOT NULL
    )`
  )
  // await runCreate(dailyTransactionStatsDatabase, 'Drop INDEX if exists `daily_transactions_idx`');
  // await runCreate(
  //   dailyTransactionStatsDatabase,
  //   'CREATE INDEX if not exists `daily_transactions_idx` ON `daily_transactions` (`dateStartTime` DESC)'
  // )
  await runCreate(
    coinStatsDatabase,
    'CREATE TABLE if not exists `coin_stats` (`cycle` NUMBER NOT NULL UNIQUE PRIMARY KEY, `totalSupplyChange` BIGINT NOT NULL, `totalStakeChange` BIGINT NOT NULL, `timestamp` BIGINT NOT NULL)'
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
      totalBalances TEXT NOT NULL,
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
  CoinStatsDB,
  NodeStatsDB,
  MetadataDB,
  TotalAccountBalanceDB,
}
