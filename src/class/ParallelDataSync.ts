import PQueue from 'p-queue'
import * as crypto from '@shardus/crypto-utils'
import { P2P, Utils as StringUtils } from '@shardus/types'
import { config, DISTRIBUTOR_URL } from '../config'
import { DataType } from './DataSync'
import { CycleDB, ReceiptDB, OriginalTxDataDB } from '../storage'
import { Cycle } from '../types'
import axios, { AxiosInstance } from 'axios'
import http from 'http'
import https from 'https'

/**
 * Configuration for parallel sync
 */
export interface ParallelSyncConfig {
  concurrency: number // Number of parallel workers
  retryAttempts: number // Retry failed requests
  retryDelayMs: number // Delay between retries
  cyclesPerBatch: number // Number of cycles to batch together (default: 10)
  enablePrefetch: boolean // Enable prefetching (default: true)
  prefetchDepth: number // Number of batches to prefetch ahead (default: 1)
}

/**
 * Statistics for sync operation
 */
export interface SyncStats {
  startTime: number
  endTime?: number
  totalCyclesToSync: number
  completedCycles: number
  totalCycles: number
  totalReceipts: number
  totalOriginalTxs: number
  errors: number
}

/**
 * Response size metadata attached by transformResponse and interceptor
 */
interface ResponseSizeMetadata {
  decompressedBytes: number
  decompressedKB: string
  compressedBytes?: number
  compressedKB?: string
  compressionRatio?: number
  compressionSavings?: string
}

interface ResponseDataWithMetadata {
  __responseSize?: ResponseSizeMetadata
  __networkElapsed?: number
  [key: string]: unknown
}

/**
 * Sync receipts and originalTxs data by cycle range with timestamp pagination
 * Uses both timestamp and ID to handle timestamp collisions and prevent data loss
 */
export interface SyncTxDataByCycleRange {
  startCycle: number
  endCycle: number
  afterTimestamp?: number
  afterTxId?: string // receiptId or txId
  limit?: number
}

/**
 * Parallel sync orchestrator using cycle-based partitioning with timestamp + txId pagination
 * Implements the optimal sync strategy with:
 * - Cycle-level parallelization
 * - Composite cursor (timestamp + txId ) to prevent data loss
 * - Work queue for load balancing
 */
export class ParallelDataSync {
  private queue: PQueue
  private syncConfig: ParallelSyncConfig
  private stats: SyncStats
  private httpAgent: http.Agent
  private httpsAgent: https.Agent
  private axiosInstance: AxiosInstance

  constructor(syncConfig?: Partial<ParallelSyncConfig>) {
    this.syncConfig = {
      concurrency: syncConfig?.concurrency || config.parallelSyncConcurrency || 10,
      retryAttempts: syncConfig?.retryAttempts || config.syncRetryAttempts || 3,
      retryDelayMs: syncConfig?.retryDelayMs || 1000,
      cyclesPerBatch: syncConfig?.cyclesPerBatch || config.cyclesPerBatch || 10,
      enablePrefetch: syncConfig?.enablePrefetch ?? config.enablePrefetch ?? true,
      prefetchDepth: syncConfig?.prefetchDepth || 1,
    }

    // Create HTTP agents with keep-alive to reuse connections
    this.httpAgent = new http.Agent({
      keepAlive: true,
      keepAliveMsecs: 30000,
      maxSockets: this.syncConfig.concurrency * 2,
      maxFreeSockets: this.syncConfig.concurrency,
    })

    this.httpsAgent = new https.Agent({
      keepAlive: true,
      keepAliveMsecs: 30000,
      maxSockets: this.syncConfig.concurrency * 2,
      maxFreeSockets: this.syncConfig.concurrency,
    })

    // Create axios instance with keep-alive agents and custom JSON serialization with timing
    this.axiosInstance = axios.create({
      httpAgent: this.httpAgent,
      httpsAgent: this.httpsAgent,
      timeout: 45000,
      headers: {
        'Content-Type': 'application/json',
        'Accept-Encoding': 'gzip, deflate', // Request compressed responses
      },
      transformRequest: [
        (data) => {
          // Use custom stringify for request body
          const startTime = Date.now()
          const result = StringUtils.safeStringify(data)
          const elapsed = Date.now() - startTime
          if (config.verbose && elapsed > 10) {
            console.log(
              `[Client] Request stringify: ${elapsed}ms, size: ${(result.length / 1024).toFixed(2)}KB`
            )
          }
          return result
        },
      ],
      transformResponse: [
        (res) => {
          // Use custom parse for response with timing
          const startTime = Date.now()
          const result = typeof res === 'string' ? StringUtils.safeJsonParse(res) : res
          const elapsed = Date.now() - startTime

          // Calculate decompressed size from raw response string
          const decompressedBytes = typeof res === 'string' ? Buffer.byteLength(res) : 0
          const sizeKB = (decompressedBytes / 1024).toFixed(2)

          // Attach size metadata to result for later use
          if (result && typeof result === 'object') {
            Object.defineProperty(result, '__responseSize', {
              value: {
                decompressedBytes,
                decompressedKB: sizeKB,
              },
              enumerable: false, // Hidden from JSON.stringify and iteration
              configurable: true,
            })
          }

          if (config.verbose && elapsed > 50) {
            console.log(`[Client] Response parse: ${elapsed}ms, size: ${sizeKB}KB`)
          }
          return result
        },
      ],
    })

    // Add response interceptor to capture compressed size from socket bytesRead
    this.axiosInstance.interceptors.response.use(
      (response) => {
        // Get Content-Length header for fallback
        const contentLength = response.headers['content-length']

        // Get socket from the request object
        const socket = response.request?.socket

        let compressedBytes: number | undefined

        // Try to calculate compressed size from socket bytesRead (most accurate)
        // We track cumulative bytesRead on the socket across requests (due to keep-alive)
        if (socket && typeof socket.bytesRead === 'number') {
          const currentBytesRead = socket.bytesRead
          const lastBytesRead = (socket as { _lastBytesRead?: number })._lastBytesRead

          if (lastBytesRead !== undefined) {
            const rawBytes = currentBytesRead - lastBytesRead

            // Subtract estimated header size (HTTP response headers + status line)
            // Typical: "HTTP/1.1 200 OK\r\n" + headers + "\r\n\r\n" ≈ 200-400 bytes
            const estimatedHeaderSize = 250
            if (rawBytes > estimatedHeaderSize) {
              compressedBytes = rawBytes - estimatedHeaderSize
            }
          }

          // Update last bytesRead for next request on this socket
          ;(socket as { _lastBytesRead?: number })._lastBytesRead = currentBytesRead
        }

        // Fallback: Use Content-Length header if socket method didn't work
        if (!compressedBytes && contentLength) {
          compressedBytes = parseInt(contentLength, 10)
        }

        // Get existing metadata from transformResponse
        const existingMetadata = (response.data as ResponseDataWithMetadata)?.__responseSize

        // Merge compressed size with existing decompressed size metadata
        if (existingMetadata && response.data && typeof response.data === 'object') {
          const decompressedBytes = existingMetadata.decompressedBytes

          // Calculate compression metrics if both sizes are available
          const compressionRatio =
            compressedBytes && decompressedBytes > 0
              ? +(compressedBytes / decompressedBytes).toFixed(3)
              : undefined

          const compressionSavings =
            compressionRatio && compressionRatio < 1
              ? `${((1 - compressionRatio) * 100).toFixed(1)}%`
              : undefined

          // Update the metadata with compressed size info
          Object.defineProperty(response.data, '__responseSize', {
            value: {
              ...existingMetadata,
              compressedBytes,
              compressedKB: compressedBytes ? (compressedBytes / 1024).toFixed(2) : undefined,
              compressionRatio,
              compressionSavings,
            },
            enumerable: false,
            configurable: true,
          })
        }

        return response
      },
      (error) => Promise.reject(error)
    )

    // Add interval between tasks to prevent overwhelming the distributor
    this.queue = new PQueue({
      concurrency: this.syncConfig.concurrency,
      interval: 100, // 100ms between batches
      intervalCap: this.syncConfig.concurrency,
    })

    this.stats = {
      startTime: Date.now(),
      totalCyclesToSync: 0,
      completedCycles: 0,
      totalCycles: 0,
      totalReceipts: 0,
      totalOriginalTxs: 0,
      errors: 0,
    }

    console.log(
      `Parallel Sync initialized:` +
        ` concurrency=${this.syncConfig.concurrency},` +
        ` cyclesPerBatch=${this.syncConfig.cyclesPerBatch},` +
        ` prefetch=${this.syncConfig.enablePrefetch ? 'enabled' : 'disabled'},` +
        ` retryAttempts=${this.syncConfig.retryAttempts}`
    )
  }

  /**
   * Creates batches of cycles for parallel processing.
   * This is a preparatory step before calling startSyncing, which expects these batches.
   * @param startCycle The starting cycle number.
   * @param endCycle The ending cycle number.
   * @returns An array of cycle batches, each with a start and end cycle.
   */
  public createCycleBatches(
    startCycle: number,
    endCycle: number
  ): { startCycle: number; endCycle: number }[] {
    const cycleBatches: { startCycle: number; endCycle: number }[] = []

    for (let i = startCycle; i <= endCycle; i += this.syncConfig.cyclesPerBatch) {
      const batchEndCycle = Math.min(i + this.syncConfig.cyclesPerBatch - 1, endCycle)
      cycleBatches.push({ startCycle: i, endCycle: batchEndCycle })
    }

    return cycleBatches
  }

  /**
   * Main entry point for parallel sync
   */
  async startSyncing(cycleBatches: { startCycle: number; endCycle: number }[]): Promise<void> {
    if (!cycleBatches || cycleBatches.length === 0) {
      console.log('No cycle batches provided for syncing.')
      return
    }

    const startCycle = cycleBatches[0].startCycle
    const endCycle = cycleBatches[cycleBatches.length - 1].endCycle

    console.log(`\n${'='.repeat(60)}`)
    console.log(`Starting Parallel Cycle Sync: ${startCycle} → ${endCycle}`)
    console.log(`Concurrency: ${this.syncConfig.concurrency} workers`)
    console.log(`${'='.repeat(60)}\n`)

    this.stats.startTime = Date.now()
    this.stats.totalCyclesToSync = endCycle - startCycle

    try {
      console.log(
        `Syncing ${cycleBatches.length} cycle batches created with ${this.syncConfig.cyclesPerBatch} cycles per batch`
      )

      // Add all batch sync tasks to the queue
      const tasks = cycleBatches.map((batch) =>
        this.queue.add(() => this.syncDataByCycleRange(batch.startCycle, batch.endCycle))
      )

      // Wait for all tasks to complete
      await Promise.all(tasks)
      this.stats.endTime = Date.now()

      // Summary
      await this.printSummary(startCycle, endCycle)
    } catch (error) {
      console.error('Fatal error in parallel sync:', error)
      this.stats.errors++
      throw error
    }
  }

  /**
   * Sync data in parallel using adaptive multi-cycle fetching with prefetching on endpoints
   * Adaptively handles partial cycle completion (e.g., if requesting cycles 1-10 but only get data from 1-5, then sends next request for 5-10)
   */
  private async syncDataByCycleRange(startCycle: number, endCycle: number): Promise<void> {
    try {
      // Sync all data types in parallel
      await Promise.all([
        this.syncCyclesByCycleRange(startCycle, endCycle),
        this.syncReceiptsByCycleRange(startCycle, endCycle),
        this.syncOriginalTxsByCycleRange(startCycle, endCycle),
      ])

      this.stats.completedCycles += endCycle - startCycle + 1

      const progress = ((this.stats.completedCycles / this.stats.totalCyclesToSync) * 100).toFixed(1)
      console.log(
        `Progress: ${this.stats.completedCycles}/${this.stats.totalCyclesToSync} cycles (${progress}%) [batch: ${startCycle}-${endCycle}]`
      )
    } catch (error) {
      console.error(`Error syncing cycle batch ${startCycle}-${endCycle}:`, error)
      this.stats.errors++
      throw error
    }
  }

  /**
   * Sync cycles across a batch of cycles using multi-cycle fetching
   */
  private async syncCyclesByCycleRange(startCycle: number, endCycle: number): Promise<void> {
    try {
      const response = await this.fetchDataFromDistributor(
        DataType.CYCLE,
        startCycle,
        endCycle,
        this.signData({ start: startCycle, end: endCycle })
      )

      const cycles = response?.data?.cycleInfo || []

      // Get size metadata from transformResponse and interceptor
      const sizeMetadata = (response.data as ResponseDataWithMetadata)?.__responseSize
      const decompressedKB = sizeMetadata?.decompressedKB || '0.00'
      const compressedKB = sizeMetadata?.compressedKB
      const compressionRatio = sizeMetadata?.compressionRatio
      const compressionSavings = sizeMetadata?.compressionSavings
      const networkElapsed = (response.data as ResponseDataWithMetadata)?.__networkElapsed || 0

      if (config.verbose || networkElapsed > 1000) {
        // Build log message with compression info if available
        let logMessage =
          `[API Timing] Cycles fetch (cycles ${startCycle}-${endCycle}): ${networkElapsed}ms, ` +
          `records: ${cycles.length}`

        // Only show compression metrics if compression actually reduced the size (ratio < 1)
        if (compressedKB !== undefined && compressionRatio !== undefined && compressionRatio < 1) {
          logMessage += `, payload: ${compressedKB}KB, payloadUncompressed: ${decompressedKB}KB, ratio: ${compressionRatio}, savings: ${compressionSavings}`
        } else {
          // No compression or not effective, just show uncompressed size
          logMessage += `, payload: ${decompressedKB}KB`
        }

        logMessage +=
          (cycles.length === 0 && response.data ? ', response.data exists but empty' : '') +
          (!response.data ? ', response.data is null/undefined!' : '')

        console.log(logMessage)
      }

      if (!response || !response.data || !response.data.cycleInfo) {
        console.error(`Error fetching cycles for cycle batch ${startCycle}-${endCycle}:`, response)
        return // Couldn't fetch any cycles
      }

      if (cycles.length === 0) {
        return // No more originalTxs in this cycle range
      }
      const cycleRecords = cycles.map((cycleRecord: Cycle['cycleRecord']) => ({
        counter: cycleRecord.counter,
        cycleRecord,
        start: cycleRecord.start,
        cycleMarker: cycleRecord.marker,
      }))

      // Bulk insert cycles
      await CycleDB.bulkInsertCycles(cycleRecords)

      // Update stats
      this.stats.totalCycles += cycleRecords.length

      if (config.verbose) {
        console.log(`[Cycles ${startCycle}-${endCycle}] Cycles: +${response.length}`)
      }
    } catch (error) {
      console.error(`Error fetching cycles for cycle batch ${startCycle}-${endCycle}:`, error)
      throw error
    }
  }

  /**
   * Sync receipts across a batch of cycles using adaptive multi-cycle fetching with prefetching
   * Adaptively handles partial cycle completion (e.g., if requesting cycles 1-10 but only get data from 1-5, then sends next request for 5-10)
   */
  private async syncReceiptsByCycleRange(startCycle: number, endCycle: number): Promise<void> {
    let currentCycle = startCycle
    let afterTimestamp = 0
    let afterTxId = ''
    let totalFetched = 0

    const route = `receipt/cycle`

    // Prefetch: Start fetching first batch immediately
    let nextFetchPromise: Promise<any[]> | null = this.syncConfig.enablePrefetch
      ? this.fetchDataFromDistributor(
          route,
          currentCycle,
          endCycle,
          this.signData({
            startCycle: currentCycle,
            endCycle,
            afterTimestamp,
            afterTxId,
            limit: config.requestLimits.MAX_RECEIPTS_PER_REQUEST,
          })
        )
      : null

    while (currentCycle <= endCycle) {
      try {
        // Get the data (either from prefetch or fetch now)
        const response = nextFetchPromise
          ? await nextFetchPromise
          : await this.fetchDataFromDistributor(
              route,
              currentCycle,
              endCycle,
              this.signData({
                startCycle: currentCycle,
                endCycle,
                afterTimestamp,
                afterTxId,
                limit: config.requestLimits.MAX_RECEIPTS_PER_REQUEST,
              })
            )

        const receipts = response?.data?.receipts || []

        // Get size metadata from transformResponse and interceptor
        const sizeMetadata = (response.data as ResponseDataWithMetadata)?.__responseSize
        const decompressedKB = sizeMetadata?.decompressedKB || '0.00'
        const compressedKB = sizeMetadata?.compressedKB
        const compressionRatio = sizeMetadata?.compressionRatio
        const compressionSavings = sizeMetadata?.compressionSavings
        const networkElapsed = (response.data as ResponseDataWithMetadata)?.__networkElapsed || 0

        if (config.verbose || networkElapsed > 1000) {
          // Build log message with compression info if available
          let logMessage =
            `[API Timing] Receipts fetch (cycles ${startCycle}-${endCycle}): ${networkElapsed}ms, ` +
            `records: ${receipts.length}`

          // Only show compression metrics if compression actually reduced the size (ratio < 1)
          if (compressedKB !== undefined && compressionRatio !== undefined && compressionRatio < 1) {
            logMessage += `, payload: ${compressedKB}KB, payloadUncompressed: ${decompressedKB}KB, ratio: ${compressionRatio}, savings: ${compressionSavings}`
          } else {
            // No compression or not effective, just show uncompressed size
            logMessage += `, payload: ${decompressedKB}KB`
          }

          logMessage +=
            (receipts.length === 0 && response.data ? ', response.data exists but empty' : '') +
            (!response.data ? ', response.data is null/undefined!' : '')

          console.log(logMessage)
        }

        if (!response || !response.data || !response.data.receipts) {
          console.error(`Error fetching receipts for cycle batch ${startCycle}-${endCycle}:`, response)
          break // Couldn't fetch any receipts
        }

        if (receipts.length === 0) {
          break // No more originalTxs in this cycle range
        }

        // Update after timestamp and txId based on last receipt BEFORE starting next fetch
        const lastReceipt = receipts[receipts.length - 1]
        currentCycle = lastReceipt.cycle
        afterTimestamp = lastReceipt.timestamp
        afterTxId = lastReceipt.receiptId

        // Prefetch next batch while processing current batch
        if (
          this.syncConfig.enablePrefetch &&
          receipts.length >= config.requestLimits.MAX_RECEIPTS_PER_REQUEST
        ) {
          nextFetchPromise = this.fetchDataFromDistributor(
            route,
            currentCycle,
            endCycle,
            this.signData({
              startCycle: currentCycle,
              endCycle,
              afterTimestamp,
              afterTxId,
              limit: config.requestLimits.MAX_RECEIPTS_PER_REQUEST,
            })
          )
        } else {
          nextFetchPromise = null
        }

        // Process receipts (overlaps with next fetch if prefetch enabled)
        await ReceiptDB.processReceiptData(receipts)

        totalFetched += receipts.length
        this.stats.totalReceipts += receipts.length

        if (config.verbose) {
          console.log(
            `[Cycles ${startCycle}-${endCycle}] Receipts: +${receipts.length} (total: ${totalFetched}), ` +
              `last in cycle ${currentCycle}` +
              (this.syncConfig.enablePrefetch ? ' [prefetch]' : '')
          )
        }

        // If we got less than the max receipts size, we've exhausted this cycle range
        if (receipts.length < config.requestLimits.MAX_RECEIPTS_PER_REQUEST) {
          break
        }
      } catch (error) {
        console.error(`Error fetching receipts for cycle batch ${startCycle}-${endCycle}:`, error)
        throw error
      }
    }
  }

  /**
   * Sync originalTxs across a batch of cycles using adaptive multi-cycle fetching with prefetching
   * Adaptively handles partial cycle completion (e.g., if requesting cycles 1-10 but only get data from 1-5, then sends next request for 5-10)
   */
  private async syncOriginalTxsByCycleRange(startCycle: number, endCycle: number): Promise<void> {
    let currentCycle = startCycle
    let afterTimestamp = 0
    let afterTxId = ''
    let totalFetched = 0

    const route = `originalTx/cycle`

    // Prefetch: Start fetching first batch immediately
    let nextFetchPromise: Promise<any[]> | null = this.syncConfig.enablePrefetch
      ? this.fetchDataFromDistributor(
          route,
          currentCycle,
          endCycle,
          this.signData({
            startCycle: currentCycle,
            endCycle,
            afterTimestamp,
            afterTxId,
            limit: config.requestLimits.MAX_ORIGINAL_TXS_PER_REQUEST,
          })
        )
      : null

    while (currentCycle <= endCycle) {
      try {
        // Get the data (either from prefetch or fetch now)
        const response = nextFetchPromise
          ? await nextFetchPromise
          : await this.fetchDataFromDistributor(
              route,
              currentCycle,
              endCycle,
              this.signData({
                startCycle: currentCycle,
                endCycle,
                afterTimestamp,
                afterTxId,
                limit: config.requestLimits.MAX_ORIGINAL_TXS_PER_REQUEST,
              })
            )

        const originalTxs = response?.data?.originalTxs || []

        // Get size metadata from transformResponse and interceptor
        const sizeMetadata = (response.data as ResponseDataWithMetadata)?.__responseSize
        const decompressedKB = sizeMetadata?.decompressedKB || '0.00'
        const compressedKB = sizeMetadata?.compressedKB
        const compressionRatio = sizeMetadata?.compressionRatio
        const compressionSavings = sizeMetadata?.compressionSavings
        const networkElapsed = (response.data as ResponseDataWithMetadata)?.__networkElapsed || 0

        if (config.verbose || networkElapsed > 1000) {
          // Build log message with compression info if available
          let logMessage =
            `[API Timing] OriginalTxs fetch (cycles ${startCycle}-${endCycle}): ${networkElapsed}ms, ` +
            `records: ${originalTxs.length}`

          // Only show compression metrics if compression actually reduced the size (ratio < 1)
          if (compressedKB !== undefined && compressionRatio !== undefined && compressionRatio < 1) {
            logMessage += `, payload: ${compressedKB}KB, payloadUncompressed: ${decompressedKB}KB, ratio: ${compressionRatio}, savings: ${compressionSavings}`
          } else {
            // No compression or not effective, just show uncompressed size
            logMessage += `, payload: ${decompressedKB}KB`
          }

          logMessage +=
            (originalTxs.length === 0 && response.data ? ', response.data exists but empty' : '') +
            (!response.data ? ', response.data is null/undefined!' : '')

          console.log(logMessage)
        }

        if (!response || !response.data || !response.data.originalTxs) {
          console.error(`Error fetching originalTxs for cycle batch ${startCycle}-${endCycle}:`, response)
          break // Couldn't fetch any originalTxs
        }

        if (originalTxs.length === 0) {
          break // No more originalTxs in this cycle range
        }

        // Update after timestamp and txId based on last tx BEFORE starting next fetch
        const lastTx = originalTxs[originalTxs.length - 1]
        currentCycle = lastTx.cycle
        afterTimestamp = lastTx.timestamp
        afterTxId = lastTx.txId

        // Prefetch next batch while processing current batch
        if (
          this.syncConfig.enablePrefetch &&
          response.length >= config.requestLimits.MAX_ORIGINAL_TXS_PER_REQUEST
        ) {
          nextFetchPromise = this.fetchDataFromDistributor(
            route,
            currentCycle,
            endCycle,
            this.signData({
              startCycle: currentCycle,
              endCycle,
              afterTimestamp,
              afterTxId,
              limit: config.requestLimits.MAX_ORIGINAL_TXS_PER_REQUEST,
            })
          )
        } else {
          nextFetchPromise = null
        }

        // Process originalTxs (overlaps with next fetch if prefetch enabled)
        await OriginalTxDataDB.processOriginalTxData(originalTxs)

        totalFetched += originalTxs.length
        this.stats.totalOriginalTxs += originalTxs.length

        if (config.verbose) {
          console.log(
            `[Cycles ${startCycle}-${endCycle}] OriginalTxs: +${originalTxs.length} (total: ${totalFetched}), ` +
              `last in cycle ${currentCycle}` +
              (this.syncConfig.enablePrefetch ? ' [prefetch]' : '')
          )
        }

        // If we got less than the max originalTxs size, we've exhausted this cycle range
        if (originalTxs.length < config.requestLimits.MAX_ORIGINAL_TXS_PER_REQUEST) {
          break
        }
      } catch (error) {
        console.error(`Error fetching originalTxs for cycle batch ${startCycle}-${endCycle}:`, error)
        throw error
      }
    }
  }

  /**
   * Fetch data by multi-cycle  range with retry logic
   */
  private async fetchDataFromDistributor(
    route: string,
    startCycle: number,
    endCycle: number,
    data: any
  ): Promise<any> {
    const url = `${DISTRIBUTOR_URL}/${route}`

    // Retry with exponential backoff
    for (let attempt = 0; attempt <= this.syncConfig.retryAttempts; attempt++) {
      try {
        const startTime = Date.now()
        const response = await this.axiosInstance.post(url, data)
        const networkElapsed = Date.now() - startTime
        if (response && response.data) {
          ;(response.data as ResponseDataWithMetadata).__networkElapsed = networkElapsed
        }
        return response
      } catch (error: any) {
        const isLastAttempt = attempt === this.syncConfig.retryAttempts
        const isRetryableError =
          error.code === 'ECONNRESET' ||
          error.code === 'ETIMEDOUT' ||
          error.code === 'ECONNREFUSED' ||
          error.code === 'EPIPE'

        if (isRetryableError && !isLastAttempt) {
          const delay = this.syncConfig.retryDelayMs * Math.pow(2, attempt)
          console.warn(
            `ECONNRESET on ${route} fetch (cycles ${startCycle}-${endCycle}), ` +
              `attempt ${attempt + 1}/${this.syncConfig.retryAttempts + 1}, ` +
              `retrying in ${delay}ms...`
          )
          await this.sleep(delay)
          continue
        }

        // Non-retryable error or last attempt failed
        console.error(`Error fetching ${route} for (cycles ${startCycle}-${endCycle}):`, error.message)
        throw error
      }
    }

    return null
  }

  /**
   * Sign data
   */
  private signData(obj: SyncTxDataByCycleRange | { start: number; end: number }): P2P.P2PTypes.SignedObject {
    const data = {
      ...obj,
      sender: config.collectorInfo.publicKey,
      sign: undefined,
    }
    crypto.signObj(data, config.collectorInfo.secretKey, config.collectorInfo.publicKey)
    return data
  }

  /**
   * Sleep helper for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * Print sync summary
   */
  private async printSummary(startCycle: number, endCycle: number): Promise<void> {
    const elapsedMs = (this.stats.endTime || Date.now()) - this.stats.startTime
    const elapsedSec = (elapsedMs / 1000).toFixed(2)
    const elapsedMin = (elapsedMs / 60000).toFixed(2)

    const totalRecords = this.stats.totalCycles + this.stats.totalReceipts + this.stats.totalOriginalTxs
    const throughput = (totalRecords / (elapsedMs / 1000)).toFixed(0)

    console.log(`\n${'='.repeat(60)}`)
    console.log('Parallel Sync Complete!')
    console.log(`${'='.repeat(60)}`)
    console.log(`  Cycle Range:       ${startCycle} → ${endCycle}`)
    console.log(`  Data Cycles Synced:     ${this.stats.completedCycles}/${this.stats.totalCyclesToSync}`)
    console.log(`  Cycles Synced: ${this.stats.totalCycles}`)
    console.log(`  Receipts Synced:   ${this.stats.totalReceipts}`)
    console.log(`  OriginalTxs Synced: ${this.stats.totalOriginalTxs}`)
    console.log(`  Total Records:     ${totalRecords}`)
    console.log(`  Errors:            ${this.stats.errors}`)
    console.log(`  Time Elapsed:      ${elapsedSec}s (${elapsedMin} min)`)
    console.log(`  Throughput:        ${throughput} records/sec`)
    console.log(`${'='.repeat(60)}\n`)
  }

  /**
   * Get current statistics
   */
  getStats(): SyncStats {
    return { ...this.stats }
  }
}
