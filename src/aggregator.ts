import * as crypto from '@shardus/crypto-utils'
import cron from 'node-cron'
import * as StatsStorage from './stats'
import {
  ValidatorStatsDB,
  TransactionStatsDB,
  DailyTransactionStatsDB,
  DailyAccountStatsDB,
  DailyNetworkStatsDB,
  DailyCoinStatsDB,
  CoinStatsDB,
  MetadataDB,
} from './stats'
import * as Storage from './storage'
import { CycleDB } from './storage'
import * as StatsFunctions from './class/StatsFunctions'
import { Utils as StringUtils } from '@shardus/types'
import { config } from './config'

crypto.init(config.hashKey)
crypto.setCustomStringifier(StringUtils.safeStringify, 'shardus_safeStringify')

export const addExitListeners = (): void => {
  process.on('SIGINT', async () => {
    console.log('Exiting on SIGINT')
    await Storage.closeDatabase()
    await StatsStorage.closeStatsDatabase()
    process.exit(0)
  })
  process.on('SIGTERM', async () => {
    console.log('Exiting on SIGTERM')
    await Storage.closeDatabase()
    await StatsStorage.closeStatsDatabase()
    process.exit(0)
  })
}

const one_day_in_ms = 24 * 60 * 60 * 1000

const measure_time = false
let start_time

const start = async (): Promise<void> => {
  await Storage.initializeDB()
  await StatsStorage.initializeStatsDB()
  addExitListeners()

  let lastCheckedCycleForValidators = -1
  let lastCheckedCycleForTxs = -1
  let lastCheckedCycleForCoinStats = -1

  // Sliding window offset for recalculation (number of cycles before startCycle)
  const slidingWindowOffset = 5

  // Interval in minutes to record total account balance
  const minutesToRecordAccountBalance = 10
  let lastCheckedTimestampForAccountBalance = minutesToRecordAccountBalance

  const firstCycle = await CycleDB.queryCycleByCounter(0)
  if (!firstCycle) {
    console.log(`Cycle 0 not found`)
    return
  }
  const firstCycleStartTime = firstCycle.cycleRecord.start * 1000
  console.log('firstCycleStartTime', firstCycleStartTime)
  // Convert it to be the start of the day
  const date = new Date(firstCycleStartTime)
  date.setUTCHours(0, 0, 0, 0)
  let lastCheckedDateTime = date.getTime()

  let lastCheckedDateTimeForTransactions = lastCheckedDateTime
  let lastCheckedDateTimeForAccounts = lastCheckedDateTime
  let lastCheckedDateTimeForNetworkStats = lastCheckedDateTime
  let lastCheckedDateTimeForCoinStats = lastCheckedDateTime

  console.log('Adjusted lastCheckedDateTime', lastCheckedDateTime)

  const lastStoredValidators = await ValidatorStatsDB.queryLatestValidatorStats(1)
  if (lastStoredValidators.length > 0) lastCheckedCycleForValidators = lastStoredValidators[0].cycle

  const lastStoredTransactions = await TransactionStatsDB.queryLatestTransactionStats(1)
  if (lastStoredTransactions.length > 0) lastCheckedCycleForTxs = lastStoredTransactions[0].cycle

  const lastStoredCoinStats = await CoinStatsDB.queryLatestCoinStats(1)
  if (lastStoredCoinStats.length > 0) lastCheckedCycleForCoinStats = lastStoredCoinStats[0].cycle

  const lastStoredDailyTransactions = await DailyTransactionStatsDB.queryLatestDailyTransactionStats(1)
  if (lastStoredDailyTransactions.length > 0)
    lastCheckedDateTimeForTransactions = lastStoredDailyTransactions[0].dateStartTime + one_day_in_ms

  const lastStoredDailyAccounts = await DailyAccountStatsDB.queryLatestDailyAccountStats(1)
  if (lastStoredDailyAccounts.length > 0)
    lastCheckedDateTimeForAccounts = lastStoredDailyAccounts[0].dateStartTime + one_day_in_ms

  const lastStoredDailyNetwork = await DailyNetworkStatsDB.queryLatestDailyNetworkStats(1)
  if (lastStoredDailyNetwork.length > 0)
    lastCheckedDateTimeForNetworkStats = lastStoredDailyNetwork[0].dateStartTime + one_day_in_ms

  const lastStoredDailyCoinStats = await DailyCoinStatsDB.queryLatestDailyCoinStats(1)
  if (lastStoredDailyCoinStats.length > 0)
    lastCheckedDateTimeForCoinStats = lastStoredDailyCoinStats[0].dateStartTime + one_day_in_ms

  let lastCheckedCycleForNodeStats = await MetadataDB.getLastStoredCycleNumber(
    MetadataDB.MetadataType.NodeStats
  )
  let nodeStatsInProgress = false

  if (measure_time) start_time = process.hrtime()

  const runStats = async (): Promise<void> => {
    const latestCycleRecord = (await CycleDB.queryLatestCycleRecords(1))[0]
    if (!latestCycleRecord) {
      console.log('No cycle record found')
      return
    }
    const latestCycleCounter = latestCycleRecord.cycleRecord.counter
    console.log('latestCycleCounter', latestCycleCounter)
    const cycleDuration = latestCycleRecord.cycleRecord.duration

    // ----- Validator Stats -----
    if (latestCycleCounter > lastCheckedCycleForValidators) {
      if (latestCycleCounter - lastCheckedCycleForValidators === 1)
        await StatsFunctions.insertValidatorStats(latestCycleRecord.cycleRecord)
      else StatsFunctions.recordOldValidatorsStats(latestCycleCounter, lastCheckedCycleForValidators)
      lastCheckedCycleForValidators = latestCycleCounter
    }

    // ----- Transactions Stats -----
    StatsFunctions.recordTransactionsStats(latestCycleCounter, lastCheckedCycleForTxs - slidingWindowOffset)
    lastCheckedCycleForTxs = latestCycleCounter

    // ----- Total Balance  -----
    let recordTotalAccountBalance = false
    if (lastCheckedTimestampForAccountBalance === minutesToRecordAccountBalance) {
      recordTotalAccountBalance = true
      lastCheckedTimestampForAccountBalance = 0
    } else {
      lastCheckedTimestampForAccountBalance++
    }

    // ----- Coin Stats -----
    StatsFunctions.recordCoinStats(
      latestCycleCounter,
      lastCheckedCycleForCoinStats - slidingWindowOffset,
      recordTotalAccountBalance
    )
    lastCheckedCycleForCoinStats = latestCycleCounter

    // ----- Daily Stats -----
    const currentTimestamp = Date.now()
    const timeSinceLastChecked = currentTimestamp - lastCheckedDateTime
    const isNewDay = timeSinceLastChecked >= one_day_in_ms
    // Check if day has changed
    if (isNewDay) {
      // Give some extra safety margin
      const extra_safety_margin = slidingWindowOffset * cycleDuration * 1000 // extra safety margin
      if (timeSinceLastChecked > one_day_in_ms + extra_safety_margin) {
        // calculate end timestamp for the day
        const dateEndTimestamp = currentTimestamp - (timeSinceLastChecked % one_day_in_ms)
        StatsFunctions.recordDailyTransactionStats(lastCheckedDateTimeForTransactions, dateEndTimestamp)
        StatsFunctions.recordDailyAccountStats(lastCheckedDateTimeForAccounts, dateEndTimestamp)
        StatsFunctions.recordDailyCoinStats(lastCheckedDateTimeForCoinStats, dateEndTimestamp)
        StatsFunctions.recordDailyNetworkStats(lastCheckedDateTimeForNetworkStats, dateEndTimestamp)
        // Reset lastCheckedDateTime
        lastCheckedDateTime = dateEndTimestamp
        lastCheckedDateTimeForTransactions = lastCheckedDateTime
        lastCheckedDateTimeForAccounts = lastCheckedDateTime
        lastCheckedDateTimeForNetworkStats = lastCheckedDateTime
        lastCheckedDateTimeForCoinStats = lastCheckedDateTime
      }
    }

    // ----- Node Stats -----
    if (!nodeStatsInProgress && latestCycleCounter > lastCheckedCycleForNodeStats) {
      nodeStatsInProgress = true
      await StatsFunctions.recordNodeStats(latestCycleCounter, lastCheckedCycleForNodeStats)
      lastCheckedCycleForNodeStats = latestCycleCounter
      nodeStatsInProgress = false
      StatsFunctions.insertOrUpdateMetadata(MetadataDB.MetadataType.NodeStats, lastCheckedCycleForNodeStats)
    }
  }

  // Cron job to run every minute
  const job = cron.schedule(
    '* * * * *',
    async () => {
      console.log('Running cron task....')
      if (measure_time && start_time) {
        const end_time = process.hrtime(start_time)
        console.log('End Time', end_time)
        start_time = process.hrtime()
      }
      runStats()
    },
    {
      scheduled: false,
    }
  )

  // Run once immediately
  runStats()

  // Then start cron
  job.start()
}

start()
