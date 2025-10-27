import * as dotenv from 'dotenv'
dotenv.config()
import path = require('path')
import fs = require('fs')
import WebSocket from 'ws'
import { Utils as StringUtils } from '@shardus/types'
import * as Storage from './storage'
import * as Crypto from './utils/crypto'
import { CycleDB, ReceiptDB, OriginalTxDataDB } from './storage'
import {
  downloadTxsDataAndCycles,
  compareWithOldReceiptsData,
  compareWithOldCyclesData,
  downloadAndSyncGenesisAccounts,
  downloadReceiptsBetweenCycles,
  compareWithOldOriginalTxsData,
  downloadOriginalTxsDataBetweenCycles,
  queryFromDistributor,
  DataType,
} from './class/DataSync'
import { validateData } from './class/validateData'
import { DistributorSocketCloseCodes } from './types'
import { initDataLogWriter } from './class/DataLogWriter'
// config variables
import { DISTRIBUTOR_URL, explorerMode, config, envEnum, overrideDefaultConfig } from './config'
import { sleep } from './utils'
import RMQCyclesConsumer from './collectors/rmq/cycles'
import RMQOriginalTxsConsumer from './collectors/rmq/original_txs'
import RMQReceiptsConsumer from './collectors/rmq/receipts'
import { setupCollectorSocketServer } from './collectorServer'

const DistributorFirehoseEvent = 'FIREHOSE'
let ws: WebSocket
let reconnecting = false
let connected = false

const env = process.env
const args = process.argv

if (config.env == envEnum.DEV) {
  //default debug mode keys
  //  pragma: allowlist nextline secret
  config.USAGE_ENDPOINTS_KEY = 'ceba96f6eafd2ea59e68a0b0d754a939'
  config.collectorInfo.secretKey =
    //  pragma: allowlist nextline secret
    '7d8819b6fac8ba2fbac7363aaeb5c517e52e615f95e1a161d635521d5e4969739426b64e675cad739d69526bf7e27f3f304a8a03dca508a9180f01e9269ce447'
  config.collectorInfo.publicKey =
    // pragma: allowlist nextline secret
    '9426b64e675cad739d69526bf7e27f3f304a8a03dca508a9180f01e9269ce447'
  config.distributorInfo.publicKey =
    // pragma: allowlist nextline secret
    '758b1c119412298802cd28dbfa394cdfeecc4074492d60844cc192d632d84de3'
} else {
  // Pull in secrets
  const secretsPath = path.join(__dirname, '../.secrets')
  const secrets = {}

  if (fs.existsSync(secretsPath)) {
    const lines = fs.readFileSync(secretsPath, 'utf-8').split('\n').filter(Boolean)

    lines.forEach((line) => {
      const [key, value] = line.split('=')
      secrets[key.trim()] = value.trim()
    })
  }
  if (secrets['USAGE_ENDPOINTS_KEY']) {
    config.USAGE_ENDPOINTS_KEY = secrets['USAGE_ENDPOINTS_KEY']
  }
  if (secrets['COLLECTOR_SECRET_KEY']) {
    config.collectorInfo.secretKey = secrets['COLLECTOR_SECRET_KEY']
  }
  if (secrets['COLLECTOR_PUBLIC_KEY']) {
    config.collectorInfo.publicKey = secrets['COLLECTOR_PUBLIC_KEY']
  }
  if (secrets['DISTRIBUTOR_PUBLIC_KEY']) {
    config.distributorInfo.publicKey = secrets['DISTRIBUTOR_PUBLIC_KEY']
  }
}

export const checkAndSyncData = async (): Promise<() => Promise<void>> => {
  // Check if there is any existing data in the db
  let lastStoredReceiptCount = await ReceiptDB.queryReceiptCount()
  let lastStoredOriginalTxDataCount = await OriginalTxDataDB.queryOriginalTxDataCount()
  let lastStoredCycleCount = await CycleDB.queryCycleCount()
  const lastStoredCycle = (await CycleDB.queryLatestCycleRecords(1))[0]

  if (lastStoredCycleCount > 0 && lastStoredCycle.counter !== lastStoredCycleCount - 1) {
    console.log(
      'lastStoredCycleCount',
      lastStoredCycleCount,
      'lastStoredCycleCounter',
      lastStoredCycle.counter
    )
    // Check if the last stored cycle counter is correct
    throw Error(
      'The last stored cycle counter does not match with the last stored cycle count! Patch the missing cycle data and start the server again!'
    )
  }
  let totalReceiptsToSync = 0
  let totalCyclesToSync = 0
  let totalOriginalTxsToSync = 0
  let lastStoredReceiptCycle = 0
  let lastStoredOriginalTxDataCycle = 0
  let response = await queryFromDistributor(DataType.TOTALDATA, {})
  if (
    response.data &&
    response.data.totalReceipts >= 0 &&
    response.data.totalCycles >= 0 &&
    response.data.totalOriginalTxs >= 0
  ) {
    totalReceiptsToSync = response.data.totalReceipts
    totalCyclesToSync = response.data.totalCycles
    totalOriginalTxsToSync = response.data.totalOriginalTxs
    console.log(
      'totalReceiptsToSync',
      totalReceiptsToSync,
      'totalCyclesToSync',
      totalCyclesToSync,
      'totalOriginalTxsToSync',
      totalOriginalTxsToSync
    )
  }
  console.log(
    'lastStoredReceiptCount',
    lastStoredReceiptCount,
    'lastStoredCycleCount',
    lastStoredCycleCount,
    'lastStoredOriginalTxDataCount',
    lastStoredOriginalTxDataCount
  )
  // Make sure the data that saved are authentic by comparing receipts count of last 10 cycles for receipts data, originalTxs count of last 10 cycles for originalTxData data and 10 last cycles for cycles data
  if (lastStoredReceiptCount > 0) {
    const lastStoredReceiptInfo = await ReceiptDB.queryReceipts({
      limit: 1,
    })
    if (lastStoredReceiptInfo && lastStoredReceiptInfo.length > 0)
      lastStoredReceiptCycle = lastStoredReceiptInfo[0].cycle
    const receiptResult = await compareWithOldReceiptsData(lastStoredReceiptCycle)
    if (!receiptResult.success) {
      throw Error(
        'The last saved receipts of last 10 cycles data do not match with the distributor data! Clear the DB and start the server again!'
      )
    }
    lastStoredReceiptCycle = receiptResult.matchedCycle
  }
  if (lastStoredOriginalTxDataCount > 0) {
    const lastStoredOriginalTxDataInfo = await OriginalTxDataDB.queryOriginalTxsData({
      limit: 1,
    })
    if (lastStoredOriginalTxDataInfo && lastStoredOriginalTxDataInfo.length > 0)
      lastStoredOriginalTxDataCycle = lastStoredOriginalTxDataInfo[0].cycle
    const originalTxResult = await compareWithOldOriginalTxsData(lastStoredOriginalTxDataCycle)
    if (!originalTxResult.success) {
      throw Error(
        'The last saved originalTxsData of last 10 cycles data do not match with the distributor data! Clear the DB and start the server again!'
      )
    }
    lastStoredOriginalTxDataCycle = originalTxResult.matchedCycle
  }
  if (totalCyclesToSync > lastStoredCycleCount && lastStoredCycleCount > 10) {
    const cycleResult = await compareWithOldCyclesData(lastStoredCycleCount)
    if (!cycleResult.success) {
      throw Error(
        'The last saved 10 cycles data does not match with the distributor data! Clear the DB and start the server again!'
      )
    }

    lastStoredCycleCount = cycleResult.cycle
  }
  if (lastStoredReceiptCount > 0 || lastStoredOriginalTxDataCount > 0) {
    if (lastStoredReceiptCount > totalReceiptsToSync) {
      throw Error(
        'The existing db has more receipts data than the network data! Clear the DB and start the server again!'
      )
    }
    if (lastStoredOriginalTxDataCount > totalOriginalTxsToSync) {
      throw Error(
        'The existing db has more originalTxsData data than the network data! Clear the DB and start the server again!'
      )
    }
  }

  // Refresh the total data to sync after collector connected to distributor
  response = await queryFromDistributor(DataType.TOTALDATA, {})
  if (
    response.data &&
    response.data.totalReceipts >= 0 &&
    response.data.totalCycles >= 0 &&
    response.data.totalOriginalTxs >= 0
  ) {
    totalReceiptsToSync = response.data.totalReceipts
    totalCyclesToSync = response.data.totalCycles
    totalOriginalTxsToSync = response.data.totalOriginalTxs
    console.log(
      'totalReceiptsToSync',
      totalReceiptsToSync,
      'totalCyclesToSync',
      totalCyclesToSync,
      'totalOriginalTxsToSync',
      totalOriginalTxsToSync
    )
  }
  console.log(
    lastStoredReceiptCount,
    totalReceiptsToSync,
    lastStoredCycleCount,
    totalCyclesToSync,
    lastStoredOriginalTxDataCount,
    totalOriginalTxsToSync
  )
  const needSyncing =
    totalReceiptsToSync > lastStoredReceiptCount ||
    totalOriginalTxsToSync > lastStoredOriginalTxDataCount ||
    totalCyclesToSync > lastStoredCycleCount
  if (!needSyncing) {
    if (!needSyncing) {
      const syncData = async (): Promise<void> => {
        console.log('No need to sync data')
      }
      return syncData
    }
  }

  const syncData = async (): Promise<void> => {
    // If there is already some data in the db, we can assume that the genesis accounts data has been synced already
    if (lastStoredCycleCount === 0) await downloadAndSyncGenesisAccounts() // To sync accounts data that are from genesis accounts/accounts data that the network start with
    // Sync receipts and originalTxsData data first if there is old data
    if (
      lastStoredReceiptCycle > 0 &&
      totalCyclesToSync > lastStoredReceiptCycle &&
      totalReceiptsToSync > lastStoredReceiptCount
    ) {
      await downloadReceiptsBetweenCycles(lastStoredReceiptCycle, totalCyclesToSync)
      lastStoredReceiptCount = await ReceiptDB.queryReceiptCount()
    }
    if (
      lastStoredOriginalTxDataCycle > 0 &&
      totalCyclesToSync > lastStoredOriginalTxDataCycle &&
      totalOriginalTxsToSync > lastStoredOriginalTxDataCount
    ) {
      await downloadOriginalTxsDataBetweenCycles(lastStoredOriginalTxDataCycle, totalCyclesToSync)
      lastStoredOriginalTxDataCount = await OriginalTxDataDB.queryOriginalTxDataCount()
    }
    await downloadTxsDataAndCycles(
      totalReceiptsToSync,
      lastStoredReceiptCount,
      totalOriginalTxsToSync,
      lastStoredOriginalTxDataCount,
      totalCyclesToSync,
      lastStoredCycleCount
    )
  }
  return syncData
}

const attemptReconnection = (): void => {
  console.log(`Re-connecting Distributor in ${config.DISTRIBUTOR_RECONNECT_INTERVAL / 1000}s...`)
  reconnecting = true
  setTimeout(connectToDistributor, config.DISTRIBUTOR_RECONNECT_INTERVAL)
}

const connectToDistributor = (): void => {
  const collectorInfo = {
    subscriptionType: DistributorFirehoseEvent,
    timestamp: Date.now(),
  }
  const queryString = encodeURIComponent(
    StringUtils.safeStringify(Crypto.sign({ collectorInfo, sender: config.collectorInfo.publicKey }))
  )
  const URL = `${DISTRIBUTOR_URL}?data=${queryString}`
  ws = new WebSocket(URL)
  ws.onopen = () => {
    console.log(
      `✅ Socket connected to the Distributor @ ${config.distributorInfo.ip}:${config.distributorInfo.port}}`
    )
    connected = true
    reconnecting = false
  }

  // Listening to messages from the server (child process)
  ws.on('message', (data: string) => {
    try {
      validateData(StringUtils.safeJsonParse(data))
    } catch (e) {
      console.log('Error in processing received data!', e)
    }
  })
  ws.onerror = (error) => {
    console.error('Distributor WebSocket error:', error.message)
    reconnecting = false
  }

  // Listening to Socket termination event from the Distributor
  ws.onclose = (closeEvent: WebSocket.CloseEvent) => {
    console.log('❌ Connection with Server Terminated!.')
    switch (closeEvent.code) {
      case DistributorSocketCloseCodes.DUPLICATE_CONNECTION_CODE:
        console.log(
          '❌ Socket Connection w/ same client credentials attempted. Dropping existing connection.'
        )
        break
      case DistributorSocketCloseCodes.SUBSCRIBER_EXPIRATION_CODE:
        console.log('❌ Subscription Validity Expired. Connection Terminated.')
        break
      default:
        console.log(`❌ Socket Connection w/ Distributor Terminated with code: ${closeEvent.code}`)
        reconnecting = false
        break
    }
    if (!reconnecting) attemptReconnection()
  }
}

// start queue consumers for cycles, transactions and receipts events
const startRMQEventsConsumers = (): void => {
  const rmqCyclesConsumer = new RMQCyclesConsumer()
  const rmqTransactionsConsumer = new RMQOriginalTxsConsumer()
  const rmqReceiptsConsumer = new RMQReceiptsConsumer()

  rmqCyclesConsumer.start()
  rmqTransactionsConsumer.start()
  rmqReceiptsConsumer.start()

  // add signal listeners
  process.on('SIGTERM', async () => {
    console.log(`Initiated RabbitMQ connections cleanup`)
    await rmqCyclesConsumer.cleanUp()
    await rmqTransactionsConsumer.cleanUp()
    await rmqReceiptsConsumer.cleanUp()
    console.log(`Completed RabbitMQ connections cleanup`)
  })
  process.on('SIGINT', async () => {
    console.log(`Initiated RabbitMQ connections cleanup`)
    await rmqCyclesConsumer.cleanUp()
    await rmqTransactionsConsumer.cleanUp()
    await rmqReceiptsConsumer.cleanUp()
    console.log(`Completed RabbitMQ connections cleanup`)
  })
}

const addSigListeners = (): void => {
  process.on('SIGUSR1', async () => {
    console.log('DETECTED SIGUSR1 SIGNAL')
    // Reload the config.json
    overrideDefaultConfig(env, args)
    console.log('Config reloaded', config)
  })
  console.log('Registerd signal listeners.')
}

export const addExitListeners = (): void => {
  process.on('SIGINT', async () => {
    console.log('Exiting on SIGINT')
    ws?.close()
    await Storage.closeDatabase()
    process.exit(0)
  })
  process.on('SIGTERM', async () => {
    console.log('Exiting on SIGTERM')
    ws?.close()
    await Storage.closeDatabase()
    process.exit(0)
  })
}

const startServer = async (): Promise<void> => {
  console.log(`Explorer Collector Mode: ${config.explorerMode}`)
  overrideDefaultConfig(env, args)
  // Set crypto hash keys from config
  Crypto.setCryptoHashKey(config.hashKey)

  await Storage.initializeDB()
  addExitListeners()

  const syncData = await checkAndSyncData()
  if (config.dataLogWrite) await initDataLogWriter()

  addSigListeners()

  if (config.collectorSockerServer.enabled) setupCollectorSocketServer()

  if (config.explorerMode === explorerMode.MQ) {
    startRMQEventsConsumers()
  } else {
    let retry = 0
    // Connect to the distributor
    while (!connected) {
      connectToDistributor()
      retry++
      await sleep(config.DISTRIBUTOR_RECONNECT_INTERVAL)
      if (!connected && retry > config.CONNECT_TO_DISTRIBUTOR_MAX_RETRY) {
        throw Error(`Cannot connect to the Distributor @ ${DISTRIBUTOR_URL}`)
      }
    }
  }

  await syncData()
}

startServer()

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception in Collector: ', error)
})
