import axios, { AxiosResponse } from 'axios'
import * as crypto from '@shardus/crypto-utils'
import { AccountDB, CycleDB, ReceiptDB, TransactionDB, OriginalTxDataDB } from '../storage'
import { config, DISTRIBUTOR_URL } from '../config'
import { Cycle } from '../types'
import { Utils as StringUtils } from '@shardus/types'

export enum DataType {
  CYCLE = 'cycleinfo',
  RECEIPT = 'receipt',
  ORIGINALTX = 'originalTx',
  ACCOUNT = 'account',
  TRANSACTION = 'transaction',
  TOTALDATA = 'totalData',
}

interface queryFromDistributorParameters {
  count?: number
  start?: number
  end?: number
  page?: number
  type?: string
  startCycle?: number
  endCycle?: number
}

// Sync tracker interface for data synchronization based on cycles
interface SyncTracker {
  lastSavedCycle: number
  updateLastSavedCycle(cycle: number): void
}

export const queryFromDistributor = async (
  type: DataType,
  queryParameters: queryFromDistributorParameters
): Promise<AxiosResponse> => {
  const data = {
    ...queryParameters,
    sender: config.collectorInfo.publicKey,
    sign: undefined,
  }
  crypto.signObj(data, config.collectorInfo.secretKey, config.collectorInfo.publicKey)
  let url
  switch (type) {
    case DataType.CYCLE:
      url = `${DISTRIBUTOR_URL}/cycleinfo`
      break
    case DataType.RECEIPT:
      url = `${DISTRIBUTOR_URL}/receipt`
      break
    case DataType.ORIGINALTX:
      url = `${DISTRIBUTOR_URL}/originalTx`
      break
    case DataType.ACCOUNT:
      url = `${DISTRIBUTOR_URL}/account`
      break
    case DataType.TRANSACTION:
      url = `${DISTRIBUTOR_URL}/transaction`
      break
    case DataType.TOTALDATA:
      url = `${DISTRIBUTOR_URL}/totalData`
      break
  }
  try {
    const response = await axios.post(url, data, {
      headers: {
        'Content-Type': 'application/json',
        'Accept-Encoding': 'gzip, deflate', // Request compressed responses
      },
      timeout: 45000,
      transformResponse: (res) => {
        return StringUtils.safeJsonParse(res)
      },
    })
    return response
  } catch (e) {
    console.log(`Error while querying ${url} for data ${data}`, e)
    return null
  }
}

// Tracker instances for data synchronization
export const cycleTracker: SyncTracker = {
  lastSavedCycle: 0,
  updateLastSavedCycle(cycle: number): void {
    console.log(`Updating lastSavedCycle from ${this.lastSavedCycle} to ${cycle}`)
    this.lastSavedCycle = cycle
  },
}

export const receiptTracker: SyncTracker = {
  lastSavedCycle: 0,
  updateLastSavedCycle(cycle: number): void {
    console.log(`Updating lastSavedReceiptCycle from ${this.lastSavedCycle} to ${cycle}`)
    this.lastSavedCycle = cycle
  },
}

export const originalTxTracker: SyncTracker = {
  lastSavedCycle: 0,
  updateLastSavedCycle(cycle: number): void {
    console.log(`Updating lastSavedOriginalTxCycle from ${this.lastSavedCycle} to ${cycle}`)
    this.lastSavedCycle = cycle
  },
}

export async function compareWithOldReceiptsData(
  lastStoredReceiptCycle = 0
): Promise<{ success: boolean; matchedCycle: number }> {
  const numberOfCyclesTocompare = 20
  const endCycle = lastStoredReceiptCycle
  const startCycle = endCycle - numberOfCyclesTocompare > 0 ? endCycle - numberOfCyclesTocompare : 0
  let downloadedReceiptCountByCycles: { cycle: number; receipts: number }[]
  const response = await queryFromDistributor(DataType.RECEIPT, { startCycle, endCycle, type: 'tally' })
  if (response && response.data && response.data.receipts) {
    downloadedReceiptCountByCycles = response.data.receipts
  } else {
    throw Error(
      `Can't fetch receipts data from cycle ${startCycle} to cycle ${endCycle}  from distributor ${DISTRIBUTOR_URL}`
    )
  }
  const oldReceiptCountByCycle = await ReceiptDB.queryReceiptCountByCycles(startCycle, endCycle)
  let success = false
  let matchedCycle = 0
  for (let i = 0; i < downloadedReceiptCountByCycles.length; i++) {
    /* eslint-disable security/detect-object-injection */
    const downloadedReceipt = downloadedReceiptCountByCycles[i]
    const oldReceipt = oldReceiptCountByCycle[i]
    /* eslint-enable security/detect-object-injection */
    console.log(downloadedReceipt, oldReceipt)
    if (downloadedReceipt.cycle !== oldReceipt.cycle || downloadedReceipt.receipts !== oldReceipt.receipts) {
      return {
        success,
        matchedCycle,
      }
    }
    success = true
    matchedCycle = downloadedReceipt.cycle
  }
  success = true
  return { success, matchedCycle }
}

export async function compareWithOldOriginalTxsData(
  lastStoredOriginalTxDataCycle = 0
): Promise<{ success: boolean; matchedCycle: number }> {
  const numberOfCyclesTocompare = 20
  const endCycle = lastStoredOriginalTxDataCycle
  const startCycle = endCycle - numberOfCyclesTocompare > 0 ? endCycle - numberOfCyclesTocompare : 0
  let downloadedOriginalTxDataCountByCycles: { cycle: number; originalTxsData: number }[]
  const response = await queryFromDistributor(DataType.ORIGINALTX, { startCycle, endCycle, type: 'tally' })
  if (response && response.data && response.data.originalTxs) {
    downloadedOriginalTxDataCountByCycles = response.data.originalTxs
  } else {
    throw Error(
      `Can't fetch originalTxsData data from cycle ${startCycle} to cycle ${endCycle}  from distributor ${DISTRIBUTOR_URL}`
    )
  }
  const oldOriginalTxDataCountByCycle = await OriginalTxDataDB.queryOriginalTxDataCountByCycles(
    startCycle,
    endCycle
  )
  let success = false
  let matchedCycle = 0
  for (let i = 0; i < downloadedOriginalTxDataCountByCycles.length; i++) {
    /* eslint-disable security/detect-object-injection */
    const downloadedOriginalTxData = downloadedOriginalTxDataCountByCycles[i]
    const oldOriginalTxData = oldOriginalTxDataCountByCycle[i]
    /* eslint-enable security/detect-object-injection */
    console.log(downloadedOriginalTxData, oldOriginalTxData)
    if (
      downloadedOriginalTxData.cycle !== oldOriginalTxData.cycle ||
      downloadedOriginalTxData.originalTxsData !== oldOriginalTxData.originalTxsData
    ) {
      return {
        success,
        matchedCycle,
      }
    }
    success = true
    matchedCycle = downloadedOriginalTxData.cycle
  }
  success = true
  return { success, matchedCycle }
}

export const compareWithOldCyclesData = async (
  lastCycleCounter: number
): Promise<{ success: boolean; cycle: number }> => {
  let downloadedCycles: Cycle[]

  const numberOfCyclesTocompare = 20
  const response = await queryFromDistributor(DataType.CYCLE, {
    start: lastCycleCounter - numberOfCyclesTocompare,
    end: lastCycleCounter - 1,
  })

  if (response && response.data && response.data.cycleInfo) {
    downloadedCycles = response.data.cycleInfo
  } else {
    throw Error(
      `Can't fetch data from cycle ${
        lastCycleCounter - numberOfCyclesTocompare
      } to cycle ${lastCycleCounter}  from distributor server`
    )
  }
  const oldCycles = await CycleDB.queryCycleRecordsBetween(
    lastCycleCounter - numberOfCyclesTocompare,
    lastCycleCounter + 1
  )
  downloadedCycles.sort((a, b) => (a.counter > b.counter ? 1 : -1))
  oldCycles.sort((a: { cycleRecord: { counter: number } }, b: { cycleRecord: { counter: number } }) =>
    a.cycleRecord.counter > b.cycleRecord.counter ? 1 : -1
  )
  let success = false
  let cycle = 0
  for (let i = 0; i < downloadedCycles.length; i++) {
    /* eslint-disable security/detect-object-injection */
    const downloadedCycle = downloadedCycles[i]
    const oldCycle = oldCycles[i]
    /* eslint-enable security/detect-object-injection */
    console.log(downloadedCycle.counter, oldCycle.cycleRecord.counter)
    if (StringUtils.safeStringify(downloadedCycle) !== StringUtils.safeStringify(oldCycle.cycleRecord)) {
      return {
        success,
        cycle,
      }
    }
    success = true
    cycle = downloadedCycle.counter
  }
  return { success, cycle }
}

export const downloadTxsDataAndCycles = async (
  totalReceiptsToSync: number,
  fromReceipt = 0,
  totalOriginalTxsToSync: number,
  fromOriginalTxData = 0,
  totalCyclesToSync: number,
  fromCycle = 0
): Promise<void> => {
  let completeForReceipt = false
  let completeForCycle = false
  let completeForOriginalTxData = false
  let startReceipt = fromReceipt
  let startCycle = fromCycle
  let startOriginalTxData = fromOriginalTxData
  let endReceipt = startReceipt + config.requestLimits.MAX_RECEIPTS_PER_REQUEST
  let endCycle = startCycle + config.requestLimits.MAX_CYCLES_PER_REQUEST
  let endOriginalTxData = startOriginalTxData + config.requestLimits.MAX_ORIGINAL_TXS_PER_REQUEST
  if (fromCycle >= totalCyclesToSync) completeForCycle = true
  if (fromReceipt >= totalReceiptsToSync) completeForReceipt = true
  if (fromOriginalTxData >= totalOriginalTxsToSync) completeForOriginalTxData = true
  let totalDownloadedReceipts = fromReceipt
  while (!completeForReceipt) {
    console.log(`Downloading receipts from ${startReceipt} to ${endReceipt}`)
    const response = await queryFromDistributor(DataType.RECEIPT, { start: startReceipt, end: endReceipt })
    if (response && response.data && response.data.receipts) {
      console.log(`Downloaded receipts`, response.data.receipts.length)
      await ReceiptDB.processReceiptData(response.data.receipts)
      totalDownloadedReceipts += response.data.receipts.length
      startReceipt = endReceipt + 1
      endReceipt += config.requestLimits.MAX_RECEIPTS_PER_REQUEST
      if (totalDownloadedReceipts >= totalReceiptsToSync) {
        completeForReceipt = true
        console.log('Download completed for receipts')
      }
    } else {
      console.log('Receipt', 'Invalid download response', startReceipt, endReceipt)
    }
  }
  let totalDownloadedOriginalTxsData = fromOriginalTxData
  while (!completeForOriginalTxData) {
    console.log(`Downloading originalTxsData from ${startOriginalTxData} to ${endOriginalTxData}`)
    const response = await queryFromDistributor(DataType.ORIGINALTX, {
      start: startOriginalTxData,
      end: endOriginalTxData,
    })
    if (response && response.data && response.data.originalTxs) {
      console.log(`Downloaded originalTxsData`, response.data.originalTxs.length)
      await OriginalTxDataDB.processOriginalTxData(response.data.originalTxs)
      totalDownloadedOriginalTxsData += response.data.originalTxs.length
      startOriginalTxData = endOriginalTxData + 1
      endOriginalTxData += config.requestLimits.MAX_ORIGINAL_TXS_PER_REQUEST
      if (totalDownloadedOriginalTxsData >= totalOriginalTxsToSync) {
        completeForOriginalTxData = true
        console.log('Download completed for originalTxsData')
      }
    } else {
      console.log('OriginalTxData', 'Invalid download response', startOriginalTxData, endOriginalTxData)
    }
  }
  let totalDownloadedCycles = fromCycle
  while (!completeForCycle) {
    console.log(`Downloading cycles from ${startCycle} to ${endCycle}`)
    const response = await queryFromDistributor(DataType.CYCLE, { start: startCycle, end: endCycle })
    if (response && response.data && response.data.cycleInfo) {
      console.log(`Downloaded cycles`, response.data.cycleInfo.length)
      const cycles = response.data.cycleInfo
      let combineCycles: Cycle[] = []
      for (let i = 0; i < cycles.length; i++) {
        // eslint-disable-next-line security/detect-object-injection
        const cycle = cycles[i]
        if (!cycle.marker || cycle.counter < 0) {
          console.log('Invalid Cycle Received', cycle)
          continue
        }
        const cycleObj: Cycle = {
          counter: cycle.counter,
          cycleRecord: cycle,
          start: cycle.start,
          cycleMarker: cycle.marker,
        }
        combineCycles.push(cycleObj)
        // await Cycle.insertOrUpdateCycle(cycleObj);
        if (combineCycles.length >= config.requestLimits.MAX_CYCLES_PER_REQUEST || i === cycles.length - 1) {
          await CycleDB.bulkInsertCycles(combineCycles)
          combineCycles = []
        }
      }
      totalDownloadedCycles += response.data.cycleInfo.length
      startCycle = endCycle + 1
      endCycle += config.requestLimits.MAX_CYCLES_PER_REQUEST
      if (totalDownloadedCycles >= totalCyclesToSync) {
        completeForCycle = true
        console.log('Download completed for cycles')
      }
    } else {
      console.log('Cycle', 'Invalid download response', startCycle, endCycle)
    }
  }
  console.log('Sync Cycle and Txs data completed!')
}

export const downloadAndSyncGenesisAccounts = async (): Promise<void> => {
  let completeSyncingAccounts = false
  let completeSyncTransactions = false
  let startAccount = 0
  let endAccount = startAccount + config.requestLimits.MAX_ACCOUNTS_PER_REQUEST
  let startTransaction = 0
  let endTransaction = startTransaction + config.requestLimits.MAX_TRANSACTIONS_PER_REQUEST
  let combineTransactions = []

  let totalGenesisAccounts = 0
  let totalGenesisTransactionReceipts = 0
  const totalExistingGenesisAccounts = await AccountDB.queryAccountCount({
    startCycleNumber: 0,
    endCycleNumber: 5,
  })
  const totalExistingGenesisTransactionReceipts = await TransactionDB.queryTransactionCount({
    startCycleNumber: 0,
    endCycleNumber: 5,
  })
  if (totalExistingGenesisAccounts > 0 && totalExistingGenesisTransactionReceipts > 0) {
    // Let's assume it has synced data for now, update to sync account count between them
    return
  }

  if (totalExistingGenesisAccounts === 0) {
    const res = await queryFromDistributor(DataType.ACCOUNT, { startCycle: 0, endCycle: 5 })
    if (res && res.data && res.data.totalAccounts) {
      totalGenesisAccounts = res.data.totalAccounts
    } else {
      console.log('Genesis Account', 'Invalid download response')
      return
    }
    if (totalGenesisAccounts <= 0) return
    let page = 1
    while (!completeSyncingAccounts) {
      console.log(`Downloading accounts from ${startAccount} to ${endAccount}`)
      const response = await queryFromDistributor(DataType.ACCOUNT, { startCycle: 0, endCycle: 5, page })
      if (response && response.data && response.data.accounts) {
        if (response.data.accounts.length < config.requestLimits.MAX_ACCOUNTS_PER_REQUEST) {
          completeSyncingAccounts = true
          console.log('Download completed for accounts')
        }
        console.log(`Downloaded accounts`, response.data.accounts.length)
        const transactions = await AccountDB.processAccountData(response.data.accounts)
        combineTransactions = [...combineTransactions, ...transactions]
      } else {
        console.log('Genesis Account', 'Invalid download response')
      }
      startAccount = endAccount
      endAccount += config.requestLimits.MAX_ACCOUNTS_PER_REQUEST
      page++
      // await sleep(1000);
    }
    await TransactionDB.processTransactionData(combineTransactions)
  }
  if (totalExistingGenesisTransactionReceipts === 0) {
    const res = await queryFromDistributor(DataType.TRANSACTION, { startCycle: 0, endCycle: 5 })
    if (res && res.data && res.data.totalTransactions) {
      totalGenesisTransactionReceipts = res.data.totalTransactions
    } else {
      console.log('Genesis Transaction Receipt', 'Invalid download response')
      return
    }
    if (totalGenesisTransactionReceipts <= 0) return
    let page = 1
    while (!completeSyncTransactions) {
      console.log(`Downloading transactions from ${startTransaction} to ${endTransaction}`)
      const response = await queryFromDistributor(DataType.TRANSACTION, { startCycle: 0, endCycle: 5, page })
      if (response && response.data && response.data.transactions) {
        if (response.data.transactions.length < config.requestLimits.MAX_TRANSACTIONS_PER_REQUEST) {
          completeSyncTransactions = true
          console.log('Download completed for transactions')
        }
        console.log(`Downloaded transactions`, response.data.transactions.length)
        await TransactionDB.processTransactionData(response.data.transactions)
      } else {
        console.log('Genesis Transaction Receipt', 'Invalid download response')
      }
      startTransaction = endTransaction
      endTransaction += config.requestLimits.MAX_TRANSACTIONS_PER_REQUEST
      page++
    }
  }
  console.log('Sync Genesis accounts and transaction receipts completed!')
}

// TODO: We can have compareWithOldReceiptsData and compareReceiptsCountByCycles to be the same function, needs a bit of refactor
export async function compareReceiptsCountByCycles(
  startCycle: number,
  endCycle: number
): Promise<{ cycle: number; receipts: number }[]> {
  const unMatchedCycle = []
  let downloadedReceiptCountByCycle: { cycle: number; receipts: number }[]

  const response = await queryFromDistributor(DataType.RECEIPT, { startCycle, endCycle, type: 'tally' })
  if (response && response.data && response.data.receipts) {
    downloadedReceiptCountByCycle = response.data.receipts
  } else {
    console.log(
      `Can't fetch receipts count between cycle ${startCycle} and cycle ${endCycle} from distributor ${DISTRIBUTOR_URL}`
    )
    return
  }
  const existingReceiptCountByCycle = await ReceiptDB.queryReceiptCountByCycles(startCycle, endCycle)
  if (config.verbose) console.log('downloadedReceiptCountByCycle', downloadedReceiptCountByCycle)
  if (config.verbose) console.log('existingReceiptCountByCycle', existingReceiptCountByCycle)
  for (const downloadedReceipt of downloadedReceiptCountByCycle) {
    const existingReceipt = existingReceiptCountByCycle.find(
      (rc: { cycle: number }) => rc.cycle === downloadedReceipt.cycle
    )
    if (config.verbose) console.log(downloadedReceipt, existingReceipt)
    if (existingReceipt) {
      if (downloadedReceipt.receipts !== existingReceipt.receipts) {
        unMatchedCycle.push(downloadedReceipt)
      }
    } else unMatchedCycle.push(downloadedReceipt)
  }
  return unMatchedCycle
}

// TODO: We can have compareWithOriginalTxsData and compareOriginalTxsCountByCycles to be the same function, needs a bit of refactor
export async function compareOriginalTxsCountByCycles(
  startCycle: number,
  endCycle: number
): Promise<{ cycle: number; originalTxsData: number }[]> {
  const unMatchedCycle = []
  let downloadedOriginalTxDataCountByCycle: { cycle: number; originalTxsData: number }[]

  const response = await queryFromDistributor(DataType.ORIGINALTX, { startCycle, endCycle, type: 'tally' })
  if (response && response.data && response.data.originalTxs) {
    downloadedOriginalTxDataCountByCycle = response.data.originalTxs
  } else {
    console.log(
      `Can't fetch originalTxs count between cycle ${startCycle} and cycle ${endCycle} from distributor ${DISTRIBUTOR_URL}`
    )
    return
  }
  const existingOriginalTxDataCountByCycle = await OriginalTxDataDB.queryOriginalTxDataCountByCycles(
    startCycle,
    endCycle
  )
  if (config.verbose)
    console.log('downloadedOriginalTxDataCountByCycle', downloadedOriginalTxDataCountByCycle)
  if (config.verbose) console.log('existingOriginalTxDataCountByCycle', existingOriginalTxDataCountByCycle)
  for (const downloadedOriginalTxData of downloadedOriginalTxDataCountByCycle) {
    const existingOriginalTxData = existingOriginalTxDataCountByCycle.find(
      (rc: { cycle: number }) => rc.cycle === downloadedOriginalTxData.cycle
    )
    if (config.verbose) console.log(downloadedOriginalTxData, existingOriginalTxData)
    if (existingOriginalTxData) {
      if (downloadedOriginalTxData.originalTxsData !== existingOriginalTxData.originalTxsData) {
        unMatchedCycle.push(downloadedOriginalTxData)
      }
    } else unMatchedCycle.push(downloadedOriginalTxData)
  }
  return unMatchedCycle
}

export async function downloadReceiptsByCycle(
  data: { cycle: number; receipts: number }[] = []
): Promise<void> {
  for (const { cycle, receipts } of data) {
    let page = 1
    let totalDownloadedReceipts = 0

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const response = await queryFromDistributor(DataType.RECEIPT, {
        startCycle: cycle,
        endCycle: cycle,
        page,
      })
      if (response && response.data && response.data.receipts) {
        const downloadedReceipts = response.data.receipts
        if (downloadedReceipts.length > 0) {
          totalDownloadedReceipts += downloadedReceipts.length
          await ReceiptDB.processReceiptData(downloadedReceipts)
        } else {
          console.log(
            `Got 0 receipts when querying for page ${page} of cycle ${cycle} from distributor ${DISTRIBUTOR_URL}`
          )
          break
        }
        page++
        if (config.verbose) console.log('totalDownloadedReceipts', totalDownloadedReceipts, receipts)
        if (totalDownloadedReceipts === receipts) {
          console.log('totalDownloadedReceipts for cycle', cycle, totalDownloadedReceipts)
          break
        }
      } else {
        console.log(
          `Can't fetch receipts for  page ${page} of cycle ${cycle} from distributor ${DISTRIBUTOR_URL}`
        )
        break
      }
    }
  }
}

export async function downloadOriginalTxsDataByCycle(
  data: { cycle: number; originalTxsData: number }[] = []
): Promise<void> {
  for (const { cycle, originalTxsData } of data) {
    let page = 1
    let totalDownloadOriginalTxsData = 0

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const response = await queryFromDistributor(DataType.ORIGINALTX, {
        startCycle: cycle,
        endCycle: cycle,
        page,
      })
      if (response && response.data && response.data.originalTxs) {
        const downloadedOriginalTxsData = response.data.originalTxs
        if (downloadedOriginalTxsData.length > 0) {
          totalDownloadOriginalTxsData += downloadedOriginalTxsData.length
          await OriginalTxDataDB.processOriginalTxData(downloadedOriginalTxsData)
        } else {
          console.log(
            `Got 0 originalTxData when querying for page ${page} of cycle ${cycle} from distributor ${DISTRIBUTOR_URL}`
          )
          break
        }
        page++
        if (config.verbose)
          console.log('totalDownloadOriginalTxsData', totalDownloadOriginalTxsData, downloadedOriginalTxsData)
        if (totalDownloadOriginalTxsData === originalTxsData) {
          console.log('totalDownloadOriginalTxsData for cycle', cycle, totalDownloadOriginalTxsData)
          break
        }
      } else {
        console.log(
          `Can't fetch originalTxsData for  page ${page} of cycle ${cycle} from distributor ${DISTRIBUTOR_URL}`
        )
        break
      }
    }
  }
}

/**
 * Calculate the safe sync cycle with buffer
 * If new cycle is 9, we can safely sync up to cycle 7 (9 - 2)
 * This maintains a 1-cycle buffer for safety
 * @param newCycle - The current/latest cycle number
 * @returns The cycle number that is safe to sync up to
 */
export function getSafeSyncCycle(newCycle: number): number {
  const CYCLE_BUFFER = 2
  return Math.max(0, newCycle - CYCLE_BUFFER)
}
/**
 * Validate and synchronize receipts data based on cycle tracker
 * @param newCycle - The current/latest cycle number from incoming data
 */
export async function validateAndSyncReceipts(newCycle: number): Promise<void> {
  const targetCycle = getSafeSyncCycle(newCycle)

  // Initialize tracker if it's at 0 (first call) - set it to the safe sync cycle
  // This prevents trying to sync from cycle 0 on first run
  if (receiptTracker.lastSavedCycle === 0) {
    receiptTracker.lastSavedCycle = targetCycle
    if (config.verbose) {
      console.log(
        `Initialized receipt sync tracker lastSavedCycle to ${targetCycle} (current cycle: ${newCycle})`
      )
    }
  }

  const startCycle = receiptTracker.lastSavedCycle + 1
  const shouldSyncCheck = targetCycle > receiptTracker.lastSavedCycle

  if (!shouldSyncCheck) {
    if (config.verbose) console.log('Receipts are already synchronized')
    return
  }
  try {
    // Compare and validate receipts count between cycles
    const unmatchedCycles = await compareReceiptsCountByCycles(startCycle, targetCycle)

    if (unmatchedCycles && unmatchedCycles.length > 0) {
      console.log(`Found ${unmatchedCycles.length} cycles with mismatched receipt counts`, unmatchedCycles)
      await downloadReceiptsByCycle(unmatchedCycles)
    }
  } catch (error) {
    console.error('Error sync checking receipts:', newCycle, targetCycle, error)
  }
  // Update the tracker after sync check
  receiptTracker.updateLastSavedCycle(targetCycle)
  console.log(`✅ Receipts synchronized up to cycle ${targetCycle}`)
}

/**
 * Validate and synchronize original transactions data based on cycle tracker
 * @param newCycle - The current/latest cycle number from incoming data
 */
export async function validateAndSyncOriginalTxs(newCycle: number): Promise<void> {
  const targetCycle = getSafeSyncCycle(newCycle)

  // Initialize tracker if it's at 0 (first call) - set it to the safe sync cycle
  // This prevents trying to sync from cycle 0 on first run
  if (originalTxTracker.lastSavedCycle === 0) {
    originalTxTracker.lastSavedCycle = targetCycle
    if (config.verbose) {
      console.log(
        `Initialized originalTx sync tracker lastSavedCycle to ${targetCycle} (current cycle: ${newCycle})`
      )
    }
  }

  const startCycle = originalTxTracker.lastSavedCycle + 1
  const shouldSyncCheck = targetCycle > originalTxTracker.lastSavedCycle

  if (!shouldSyncCheck) {
    if (config.verbose) console.log('OriginalTxs are already synchronized')
    return
  }
  console.log(`Syncing originalTxs from cycle ${startCycle} to ${targetCycle} (current cycle: ${newCycle})`)
  try {
    // Compare and validate originalTxs count between cycles
    const unmatchedCycles = await compareOriginalTxsCountByCycles(startCycle, targetCycle)

    if (unmatchedCycles && unmatchedCycles.length > 0) {
      console.log(`Found ${unmatchedCycles.length} cycles with mismatched originalTx counts`, unmatchedCycles)
      await downloadOriginalTxsDataByCycle(unmatchedCycles)
    }
  } catch (error) {
    console.error('Error sync checking originalTxs:', newCycle, targetCycle, error)
  }
  // Update the tracker after sync check
  originalTxTracker.updateLastSavedCycle(targetCycle)
  console.log(`✅ OriginalTxs synchronized up to cycle ${targetCycle}`)
}

/**
 * Validate and synchronize cycle data based on cycle tracker
 * @param newCycle - The current/latest cycle number from incoming data
 */
export async function validateAndSyncCycles(newCycle: number): Promise<void> {
  const targetCycle = getSafeSyncCycle(newCycle)

  // Initialize tracker if it's at 0 (first call) - set it to the safe sync cycle
  // This prevents trying to sync from cycle 0 on first run
  if (cycleTracker.lastSavedCycle === 0) {
    cycleTracker.lastSavedCycle = targetCycle
    if (config.verbose) {
      console.log(
        `Initialized cycle sync tracker lastSavedCycle to ${targetCycle} (current cycle: ${newCycle})`
      )
    }
  }

  const startCycle = cycleTracker.lastSavedCycle + 1
  const shouldSyncCheck = targetCycle > cycleTracker.lastSavedCycle

  if (!shouldSyncCheck) {
    if (config.verbose) console.log('Cycles are already synchronized')
    return
  }

  const isInSync = targetCycle === startCycle

  if (!isInSync) {
    try {
      console.log(`Syncing cycles from ${startCycle} to ${targetCycle} (current cycle: ${newCycle})`)
      await downloadCyclcesBetweenCycles(startCycle, targetCycle, true)
    } catch (error) {
      console.error('Error syncing cycles:', error)
    }
  } else {
    if (config.verbose) console.log('Cycles are already synchronized')
  }

  // Update the tracker after sync check
  cycleTracker.updateLastSavedCycle(targetCycle)
  console.log(`✅ Cycles synchronized up to cycle ${targetCycle}`)
}

/**
 * Check and synchronize all data types based on the current cycle
 * This should be called when new cycle data is inserted/updated
 * @param newCycle - The current cycle number from newly inserted/updated cycle
 */
export async function checkAndSyncDataByCycle(newCycle: number): Promise<void> {
  if (config.verbose) console.log(`Checking and syncing data for cycle: ${newCycle}`)

  // Run all sync operations in parallel
  await Promise.all([
    validateAndSyncCycles(newCycle),
    validateAndSyncReceipts(newCycle),
    validateAndSyncOriginalTxs(newCycle),
  ])
}

export const downloadCyclcesBetweenCycles = async (
  startCycle: number,
  totalCyclesToSync: number,
  saveOnlyNewData = false
): Promise<void> => {
  let endCycle = startCycle + config.requestLimits.MAX_CYCLES_PER_REQUEST
  for (; startCycle <= totalCyclesToSync; ) {
    if (endCycle > totalCyclesToSync) endCycle = totalCyclesToSync
    const response = await queryFromDistributor(DataType.CYCLE, { start: startCycle, end: endCycle })
    if (response && response.data && response.data.cycleInfo) {
      console.log(`Downloaded cycles`, response.data.cycleInfo.length)
      const cycles = response.data.cycleInfo
      let combineCycles: Cycle[] = []
      for (let i = 0; i < cycles.length; i++) {
        // eslint-disable-next-line security/detect-object-injection
        const cycle = cycles[i]
        if (!cycle.marker || cycle.counter < 0) {
          console.log('Invalid Cycle Received', cycle)
          continue
        }
        const cycleObj: Cycle = {
          counter: cycle.counter,
          start: cycle.start,
          cycleRecord: cycle,
          cycleMarker: cycle.marker,
        }
        if (saveOnlyNewData) {
          const existingCycle = await CycleDB.queryCycleByCounter(cycleObj.counter)
          if (!existingCycle) combineCycles.push(cycleObj)
        } else combineCycles.push(cycleObj)
        // await Cycle.insertOrUpdateCycle(cycleObj);
        if (combineCycles.length >= config.requestLimits.MAX_CYCLES_PER_REQUEST || i === cycles.length - 1) {
          if (combineCycles.length > 0) await CycleDB.bulkInsertCycles(combineCycles)
          combineCycles = []
        }
      }
    }
    startCycle = endCycle + 1
    endCycle += config.requestLimits.MAX_CYCLES_PER_REQUEST
  }
  console.log('Download completed for cycles between counter', startCycle, 'and', endCycle)
}

export const downloadReceiptsBetweenCycles = async (
  startCycle: number,
  totalCyclesToSync: number,
  saveOnlyNewData = false
): Promise<void> => {
  let endCycle = startCycle + config.requestLimits.MAX_BETWEEN_CYCLES_PER_REQUEST
  for (; startCycle <= totalCyclesToSync; ) {
    if (endCycle > totalCyclesToSync) endCycle = totalCyclesToSync
    console.log(`Downloading receipts from cycle ${startCycle} to cycle ${endCycle}`)
    let response = await queryFromDistributor(DataType.RECEIPT, { startCycle, endCycle, type: 'count' })
    if (response && response.data && response.data.receipts) {
      console.log(`Download receipts Count`, response.data.receipts)
      const receiptsCount = response.data.receipts
      for (let i = 1; i <= Math.ceil(receiptsCount / config.requestLimits.MAX_RECEIPTS_PER_REQUEST); i++) {
        response = await queryFromDistributor(DataType.RECEIPT, { startCycle, endCycle, page: i })
        if (response && response.data && response.data.receipts) {
          console.log(`Downloaded receipts`, response.data.receipts.length)
          const receipts = response.data.receipts
          await ReceiptDB.processReceiptData(receipts, saveOnlyNewData)
        }
      }
    } else {
      if (response && response.data && response.data.receipts !== 0)
        console.log('Receipt', 'Invalid download response')
    }
    startCycle = endCycle + 1
    endCycle += config.requestLimits.MAX_BETWEEN_CYCLES_PER_REQUEST
  }
}

export const downloadOriginalTxsDataBetweenCycles = async (
  startCycle: number,
  totalCyclesToSync: number,
  saveOnlyNewData = false
): Promise<void> => {
  let endCycle = startCycle + config.requestLimits.MAX_BETWEEN_CYCLES_PER_REQUEST
  for (; startCycle <= totalCyclesToSync; ) {
    if (endCycle > totalCyclesToSync) endCycle = totalCyclesToSync
    console.log(`Downloading originalTxsData from cycle ${startCycle} to cycle ${endCycle}`)
    let response = await queryFromDistributor(DataType.ORIGINALTX, { startCycle, endCycle, type: 'count' })
    if (response && response.data && response.data.originalTxs) {
      console.log(`Download originalTxsData Count`, response.data.originalTxs)
      const originalTxsDataCount = response.data.originalTxs
      for (
        let i = 1;
        i <= Math.ceil(originalTxsDataCount / config.requestLimits.MAX_ORIGINAL_TXS_PER_REQUEST);
        i++
      ) {
        response = await queryFromDistributor(DataType.ORIGINALTX, { startCycle, endCycle, page: i })
        if (response && response.data && response.data.originalTxs) {
          console.log(`Downloaded originalTxsData`, response.data.originalTxs.length)
          const originalTxsData = response.data.originalTxs
          await OriginalTxDataDB.processOriginalTxData(originalTxsData, saveOnlyNewData)
        }
      }
    } else {
      if (response && response.data && response.data.originalTxs !== 0)
        console.log('OriginalTxData', 'Invalid download response')
    }
    startCycle = endCycle + 1
    endCycle += config.requestLimits.MAX_BETWEEN_CYCLES_PER_REQUEST
  }
}
