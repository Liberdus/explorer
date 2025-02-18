import * as crypto from '@shardus/crypto-utils'
import cron from 'node-cron'
import * as StatsStorage from './stats'
import {
  ValidatorStatsDB,
  TransactionStatsDB,
  DailyTransactionStatsDB,
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

const measure_time = false
let start_time

const start = async (): Promise<void> => {
  await Storage.initializeDB()
  await StatsStorage.initializeStatsDB()
  addExitListeners()

  let lastCheckedCycleForValidators = -1
  let lastCheckedCycleForTxs = -1
  let lastCheckedCycleForCoinStats = -1
  let lastCheckedDateStartTime = -1
  const waitCycleForStats = 5 // Calculate transactions count per Cycle after 5 cycles

  const lastStoredValidators = await ValidatorStatsDB.queryLatestValidatorStats(1)
  if (lastStoredValidators.length > 0) lastCheckedCycleForValidators = lastStoredValidators[0].cycle

  const lastStoredTransactions = await TransactionStatsDB.queryLatestTransactionStats(1)
  if (lastStoredTransactions.length > 0) lastCheckedCycleForTxs = lastStoredTransactions[0].cycle

  const lastStoredDailyTransactions = await DailyTransactionStatsDB.queryLatestDailyTransactionStats(1)
  if (lastStoredDailyTransactions.length > 0)
    lastCheckedDateStartTime = lastStoredDailyTransactions[0].dateStartTime
  if (lastCheckedDateStartTime === -1) {
    const firstCycle = await CycleDB.queryCycleByCounter(0)
    if (!firstCycle) {
      console.log(`Cycle 0 not found`)
      return
    }
    lastCheckedDateStartTime = firstCycle.cycleRecord.start * 1000
    console.log('lastCheckedDateStartTime', lastCheckedDateStartTime)
    // Convert it to be the start of the day
    const date = new Date(lastCheckedDateStartTime)
    date.setUTCHours(0, 0, 0, 0)
    lastCheckedDateStartTime = date.getTime()
    console.log('New adjustedlastCheckedDateStartTime', lastCheckedDateStartTime)
  }

  const lastStoredCoinStats = await CoinStatsDB.queryLatestCoinStats(1)
  if (lastStoredCoinStats.length > 0) lastCheckedCycleForCoinStats = lastStoredCoinStats[0].cycle

  let lastCheckedCycleForNodeStats = await MetadataDB.getLastStoredCycleNumber(
    MetadataDB.MetadataType.NodeStats
  )

  if (measure_time) start_time = process.hrtime()

  // Cron job to run every minute
  cron.schedule('* * * * *', async () => {
    console.log('Running cron task....')
    if (measure_time && start_time) {
      const end_time = process.hrtime(start_time)
      console.log('End Time', end_time)
      start_time = process.hrtime()
    }

    const latestCycleRecord = (await CycleDB.queryLatestCycleRecords(1))[0]
    if (!latestCycleRecord) {
      console.log('No cycle record found')
      return
    }
    const latestCycleCounter = latestCycleRecord.cycleRecord.counter
    console.log('latestCycleCounter', latestCycleCounter)
    const cycleDuration = latestCycleRecord.cycleRecord.duration

    if (latestCycleCounter > lastCheckedCycleForValidators) {
      if (latestCycleCounter - lastCheckedCycleForValidators === 1)
        await StatsFunctions.insertValidatorStats(latestCycleRecord[0].cycleRecord)
      else StatsFunctions.recordOldValidatorsStats(latestCycleCounter, lastCheckedCycleForValidators)
      lastCheckedCycleForValidators = latestCycleCounter
    }

    // /* prettier-ignore */ if (config.verbose)  console.log(latestCycleCounter - waitCycleForTxs, lastCheckedCycleForTxs)
    if (latestCycleCounter - waitCycleForStats > lastCheckedCycleForTxs) {
      StatsFunctions.recordTransactionsStats(latestCycleCounter - waitCycleForStats, lastCheckedCycleForTxs)
      lastCheckedCycleForTxs = latestCycleCounter - waitCycleForStats
    }

    if (latestCycleCounter - waitCycleForStats > lastCheckedCycleForCoinStats) {
      StatsFunctions.recordCoinStats(latestCycleCounter - waitCycleForStats, lastCheckedCycleForCoinStats)
      lastCheckedCycleForCoinStats = latestCycleCounter - waitCycleForStats
    }

    if (latestCycleCounter > lastCheckedCycleForNodeStats) {
      await StatsFunctions.recordNodeStats(latestCycleCounter, lastCheckedCycleForNodeStats)
      lastCheckedCycleForNodeStats = latestCycleCounter
      StatsFunctions.insertOrUpdateMetadata(MetadataDB.MetadataType.NodeStats, lastCheckedCycleForNodeStats)
    }

    // Check if day has changed
    const currentTimestamp = Date.now()
    const timeSinceLastChecked = currentTimestamp - lastCheckedDateStartTime
    const one_day_in_ms = 24 * 60 * 60 * 1000
    const isNewDay = timeSinceLastChecked >= one_day_in_ms
    if (isNewDay) {
      // Give some extra safety margin
      const extra_safety_margin = waitCycleForStats * cycleDuration * 1000 // extra safety margin
      if (timeSinceLastChecked > one_day_in_ms + extra_safety_margin) {
        // calculate end timestamp for the day
        const dateEndTimestamp = currentTimestamp - (timeSinceLastChecked % one_day_in_ms) - 1
        StatsFunctions.recordDailyTransactionsStats(lastCheckedDateStartTime, dateEndTimestamp)
        // Reset counter and update date/boundaries
        lastCheckedDateStartTime = dateEndTimestamp + 1
      }
    }
  })
}

start()
