import PQueue from 'p-queue'
import * as crypto from '@shardus/crypto-utils'
import { P2P, Utils as StringUtils } from '@shardus/types'
import { config, DISTRIBUTOR_URL } from '../config'
import { DataType } from './DataSync'
import {
  CycleDB,
  ReceiptDB,
  OriginalTxDataDB,
  // receiptDatabase,
  // originalTxDataDatabase,
  // cycleDatabase,
} from '../storage'
import { Cycle, Receipt, OriginalTxData } from '../types'
import axios, { AxiosInstance } from 'axios'
import http from 'http'
import https from 'https'
// import { checkpointWAL } from '../storage/sqlite3storage'

// For Debugging Purpose - Set to false to skip processing data and saving to DB
const processData = true

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
  _deserializedTime?: number
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

  // Accumulation buffers for batching DB writes - only write when threshold is reached
  private receiptBuffer: Receipt[] = []
  private originalTxBuffer: OriginalTxData[] = []
  private cycleBuffer: Cycle[] = []
  private readonly ACCUMULATION_THRESHOLD = 1000 // Write to DB when buffer reaches this size

  // Mutex locks to prevent concurrent buffer access (race conditions)
  private receiptBufferLock = false
  private originalTxBufferLock = false
  private cycleBufferLock = false

  // // WAL checkpoint tracking
  // private flushCount = 0 // Total number of buffer flushes
  // private readonly CHECKPOINT_FREQUENCY = 10 // Run WAL checkpoint every N flushes to prevent WAL from growing too large

  // // Flush pending flag to prevent multiple workers from waiting to flush
  // private receiptFlushPending = false

  // // Adaptive flush delay system - adds delays before DB writes to prevent overload
  // private flushTimestamps: number[] = [] // Timestamps of recent flushes
  // private readonly FLUSH_WINDOW_MS = 10000 // Track flushes in last 10 seconds
  // private readonly FAST_FLUSH_THRESHOLD = 5 // If 5+ flushes in window, system is overloaded
  // private minFlushDelay = 200 // Min delay before flush (ms)
  // private maxFlushDelay = 1000 // Max delay before flush (ms)
  // private readonly OVERLOAD_MIN_DELAY = 3000 // When overloaded, min delay increases to 3s
  // private readonly OVERLOAD_MAX_DELAY = 5000 // When overloaded, max delay increases to 5s

  constructor(syncConfig?: Partial<ParallelSyncConfig>) {
    this.syncConfig = {
      concurrency: syncConfig?.concurrency || config.parallelSyncConcurrency || 10,
      cyclesPerBatch: syncConfig?.cyclesPerBatch || config.cyclesPerBatch || 100,
      retryAttempts: syncConfig?.retryAttempts || config.syncRetryAttempts || 5,
      retryDelayMs: syncConfig?.retryDelayMs || 1000,
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
          const deserializedTime = Date.now() - startTime

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
            // Attach deserialization time
            ;(result as ResponseDataWithMetadata)._deserializedTime = deserializedTime
          }

          if (config.verbose && deserializedTime > 50) {
            console.log(`[Client] Response deserialization: ${deserializedTime}ms, size: ${sizeKB}KB`)
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
    this.stats.totalCyclesToSync = endCycle - startCycle + 1

    try {
      console.log(
        `Syncing ${cycleBatches.length} cycle batches created with ${this.syncConfig.cyclesPerBatch} cycles per batch`
      )

      // Three-phase approach for optimal performance:
      // Phase 1: Use main queue (concurrency: 5) for parallel API fetching
      // Phase 2: Buffer data in memory until ACCUMULATION_THRESHOLD (1000) is reached
      // Phase 3: DB writes are batched and serialized via storage-level queue
      // This combines parallel I/O with batched, serialized DB writes to minimize contention
      const tasks = cycleBatches.map((batch) =>
        this.queue.add(() => this.syncDataByCycleRange(batch.startCycle, batch.endCycle))
      )

      console.log(`Waiting for ${tasks.length} tasks to complete...`)

      // Wait for all tasks to complete (even if some fail)
      const results = await Promise.allSettled(tasks)

      console.log('All tasks completed, flushing remaining buffers...')

      // Flush any remaining buffered data to database
      await this.flushAllBuffers()

      this.stats.endTime = Date.now()

      // Count successful and failed tasks
      const successful = results.filter((r) => r.status === 'fulfilled').length
      const failed = results.filter((r) => r.status === 'rejected').length

      console.log(`Tasks completed: ${successful} successful, ${failed} failed`)

      // Log failed task errors
      if (failed > 0) {
        console.error(`\n${failed} tasks failed with errors:`)
        results.forEach((result, index) => {
          if (result.status === 'rejected') {
            const batch = cycleBatches[index]
            console.error(
              `  Batch ${index} (cycles ${batch.startCycle}-${batch.endCycle}): ${
                result.reason?.message || result.reason
              }`
            )
          }
        })
      }

      console.log('Printing summary...')
      // Summary
      await this.printSummary(startCycle, endCycle)

      console.log('Summary printed successfully')

      // Throw if there were any failures so the caller knows sync was incomplete
      if (failed > 0) {
        throw new Error(`Parallel sync completed with ${failed} failed batches out of ${tasks.length} total`)
      }
    } catch (error) {
      console.error('Fatal error in parallel sync:', error)
      this.stats.errors++
      // Try to flush buffers even on error to preserve data
      try {
        await this.flushAllBuffers()
      } catch (flushError) {
        console.error('Error flushing buffers during error handling:', flushError)
      }
      throw error
    }
  }

  /**
   * Sync data in parallel using adaptive multi-cycle fetching with prefetching on endpoints
   * Adaptively handles partial cycle completion (e.g., if requesting cycles 1-10 but only get data from 1-5, then sends next request for 5-10)
   */
  private async syncDataByCycleRange(startCycle: number, endCycle: number): Promise<void> {
    // Sync all data types in parallel with individual error tracking
    const results = await Promise.allSettled([
      this.syncCycleRecordsByCycleRange(startCycle, endCycle),
      this.syncReceiptsByCycleRange(startCycle, endCycle),
      this.syncOriginalTxsByCycleRange(startCycle, endCycle),
    ])

    const dataTypes = ['Cycle Records', 'Receipts', 'OriginalTxs']
    const failedTypes: string[] = []
    const errors: unknown[] = []

    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        failedTypes.push(dataTypes[index])
        errors.push(result.reason)
      }
    })

    if (failedTypes.length > 0) {
      console.error(
        `Error syncing cycle batch ${startCycle}-${endCycle}: Failed data types: ${failedTypes.join(', ')}`
      )
      errors.forEach((error, index) => {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error(`  ${failedTypes[index]}: ${errorMessage}`)
      })
      this.stats.errors++
      throw new Error(
        `Failed to sync ${
          failedTypes.length
        } data type(s) for batch ${startCycle}-${endCycle}: ${failedTypes.join(', ')}`
      )
    }

    this.stats.completedCycles += endCycle - startCycle + 1

    const progress = ((this.stats.completedCycles / this.stats.totalCyclesToSync) * 100).toFixed(1)
    console.log(
      `Progress: ${this.stats.completedCycles}/${this.stats.totalCyclesToSync} cycles (${progress}%) [batch: ${startCycle}-${endCycle}]`
    )
  }

  /**
   * Sync cycle records across a batch of cycles using multi-cycle fetching
   */
  private async syncCycleRecordsByCycleRange(startCycle: number, endCycle: number): Promise<void> {
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
      const deserializedTime = (response.data as ResponseDataWithMetadata)?._deserializedTime || 0

      if (config.verbose || networkElapsed > 1000) {
        // Build log message with compression info if available
        let logMessage =
          `[API Timing] Cycle Records fetch (cycles ${startCycle}-${endCycle}): ${networkElapsed}ms, ` +
          `deserialization: ${deserializedTime}ms, ` +
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
        console.error(`Error fetching cycle records for cycle batch ${startCycle}-${endCycle}:`, response)
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

      // Add cycles to buffer - will flush to DB when buffer reaches threshold
      await this.addToBuffer('cycle', cycleRecords)

      // Update stats
      this.stats.totalCycles += cycleRecords.length

      if (config.verbose) {
        console.log(`[Cycles ${startCycle}-${endCycle}] Cycle Records: +${cycleRecords.length}`)
      }
    } catch (error) {
      console.error(`Error fetching cycle records for cycle batch ${startCycle}-${endCycle}:`, error)
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
        const deserializedTime = (response.data as ResponseDataWithMetadata)?._deserializedTime || 0

        if (config.verbose || networkElapsed > 1000) {
          // Build log message with compression info if available
          let logMessage =
            `[API Timing] Receipts fetch (cycles ${startCycle}-${endCycle}): ${networkElapsed}ms, ` +
            `deserialization: ${deserializedTime}ms, ` +
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

        // Add receipts to buffer - will flush to DB when buffer reaches threshold
        await this.addToBuffer('receipt', receipts)

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
        const deserializedTime = (response.data as ResponseDataWithMetadata)?._deserializedTime || 0

        if (config.verbose || networkElapsed > 1000) {
          // Build log message with compression info if available
          let logMessage =
            `[API Timing] OriginalTxs fetch (cycles ${startCycle}-${endCycle}): ${networkElapsed}ms, ` +
            `deserialization: ${deserializedTime}ms, ` +
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

        const startTime = Date.now()
        // Deserialize originalTxs
        originalTxs.forEach((originalTx) => {
          OriginalTxDataDB.deserializeDbOriginalTxData(originalTx)
        })
        const elapsed = Date.now() - startTime
        if (elapsed > 100) {
          console.log(`Deserializing ${originalTxs.length} originalTxs took ${elapsed}ms`)
        }

        // Add originalTxs to buffer - will flush to DB when buffer reaches threshold
        await this.addToBuffer('originalTx', originalTxs)

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

        // Retry ALL errors (network errors, socket hang up, timeouts, etc.)
        // This gives the collector time to recover when overloaded
        if (!isLastAttempt) {
          // Exponential backoff with longer delays to give collector time to recover
          const delay = this.syncConfig.retryDelayMs * Math.pow(2, attempt)
          const errorCode = error.code || error.cause?.code || 'UNKNOWN'
          const errorMsg = error.message || 'Unknown error'
          console.warn(
            `Error (${errorCode}: ${errorMsg}) on ${route} fetch (cycles ${startCycle}-${endCycle}), ` +
              `attempt ${attempt + 1}/${this.syncConfig.retryAttempts}, ` +
              `retrying in ${delay}ms... (Giving collector time to process DB writes)`
          )
          await this.sleep(delay)
          continue
        }

        // Last attempt failed - throw error
        console.error(
          `Error fetching ${route} for (cycles ${startCycle}-${endCycle}) after ${
            this.syncConfig.retryAttempts + 1
          } attempts:`,
          error.message
        )
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
   * Generic function to add data to buffer and flush if threshold reached
   * Handles all buffer types (receipts, originalTxs, cycles)
   */
  private async addToBuffer(
    type: 'receipt' | 'originalTx' | 'cycle',
    data: Receipt[] | OriginalTxData[] | Cycle[]
  ): Promise<void> {
    if (type === 'receipt') {
      // Wait for lock to be released (prevents concurrent modification during flush)
      while (this.receiptBufferLock) {
        await new Promise((resolve) => setTimeout(resolve, 10))
      }

      // Add data to buffer
      this.receiptBuffer.push(...(data as Receipt[]))

      // Check if buffer reached threshold
      if (this.receiptBuffer.length >= this.ACCUMULATION_THRESHOLD) {
        await this.flushBuffer('receipt')
      }
    } else if (type === 'originalTx') {
      // Wait for lock to be released (prevents concurrent modification during flush)
      while (this.originalTxBufferLock) {
        await new Promise((resolve) => setTimeout(resolve, 10))
      }

      // Add data to buffer
      this.originalTxBuffer.push(...(data as OriginalTxData[]))

      // Check if buffer reached threshold
      if (this.originalTxBuffer.length >= this.ACCUMULATION_THRESHOLD) {
        await this.flushBuffer('originalTx')
      }
    } else {
      // Wait for lock to be released (prevents concurrent modification during flush)
      while (this.cycleBufferLock) {
        await new Promise((resolve) => setTimeout(resolve, 10))
      }

      // Add data to buffer
      this.cycleBuffer.push(...(data as Cycle[]))

      // Check if buffer reached threshold
      if (this.cycleBuffer.length >= this.ACCUMULATION_THRESHOLD) {
        await this.flushBuffer('cycle')
      }
    }
  }

  /**
   * Generic function to flush buffer to database
   * Handles all buffer types with adaptive delay and locking (adaptive cooling only for receipts)
   */
  private async flushBuffer(type: 'receipt' | 'originalTx' | 'cycle'): Promise<void> {
    if (type === 'receipt') {
      if (this.receiptBuffer.length === 0) return

      // // If another worker is already flushing, return immediately (it will flush our data too)
      // if (this.receiptFlushPending) {
      //   return
      // }

      // // Mark flush as pending
      // this.receiptFlushPending = true

      // // Apply adaptive delay BEFORE acquiring lock to spread out DB writes (receipts only)
      // const delay = this.getAdaptiveFlushDelay()
      // if (delay > 0) {
      //   const recentFlushCount = this.flushTimestamps.length
      //   const delayRange = `${this.minFlushDelay}-${this.maxFlushDelay}ms`
      //   console.log(
      //     `[Adaptive Cooling] Receipts - Waiting ${delay}ms before flush ` +
      //       `(recent flushes: ${recentFlushCount}, range: ${delayRange})`
      //   )
      //   await new Promise((resolve) => setTimeout(resolve, delay))
      // }

      // // If another worker is already locking, return immediately (it will flush our data too)
      // if (this.receiptBufferLock) {
      //   return
      // }

      this.receiptBufferLock = true
      try {
        const toFlush = [...this.receiptBuffer] as any
        this.receiptBuffer = []

        const startTime = Date.now()
        // Deserialize receipts in chunks to prevent event loop blocking
        const CHUNK_SIZE = 20
        for (let i = 0; i < toFlush.length; i += CHUNK_SIZE) {
          const end = Math.min(i + CHUNK_SIZE, toFlush.length)
          // Deserialize chunk of receipts
          for (let j = i; j < end; j++) {
            // eslint-disable-next-line security/detect-object-injection
            ReceiptDB.deserializeDbReceipt(toFlush[j])
          }
          // Yield to event loop after each chunk (except the last one)
          if (end < toFlush.length) {
            await new Promise((resolve) => setImmediate(resolve))
          }
        }
        const elapsed = Date.now() - startTime
        if (elapsed > 100) {
          console.log(`Deserializing ${toFlush.length} receipts took: ${elapsed}ms`)
        }
        console.log(`[Buffer Flush] Flushing ${toFlush.length} receipts to database`)
        if (processData) await ReceiptDB.processReceiptData(toFlush, false, false)

        // // Track flush timestamp for adaptive delay system (receipts only)
        // this.recordFlushTimestamp()
      } finally {
        this.receiptBufferLock = false

        // // Clear flush pending flag
        // this.receiptFlushPending = false
      }
    } else if (type === 'originalTx') {
      if (this.originalTxBuffer.length === 0) return

      // If another worker is already locking, return immediately (it will flush our data too)
      if (this.originalTxBufferLock) {
        return
      }

      this.originalTxBufferLock = true
      try {
        const toFlush = [...this.originalTxBuffer]
        this.originalTxBuffer = []
        console.log(`[Buffer Flush] Flushing ${toFlush.length} originaltxs to database`)
        if (processData) await OriginalTxDataDB.processOriginalTxData(toFlush)
      } finally {
        this.originalTxBufferLock = false
      }
    } else {
      if (this.cycleBuffer.length === 0) return

      // If another worker is already locking, return immediately (it will flush our data too)
      if (this.cycleBufferLock) {
        return
      }

      this.cycleBufferLock = true
      try {
        const toFlush = [...this.cycleBuffer]
        this.cycleBuffer = []
        console.log(`[Buffer Flush] Flushing ${toFlush.length} cycles to database`)
        if (processData) await CycleDB.bulkInsertCycles(toFlush)
      } finally {
        this.cycleBufferLock = false
      }
    }
  }

  /**
   * Flush all buffers (call at end of sync)
   */
  private async flushAllBuffers(): Promise<void> {
    await this.flushBuffer('receipt')
    await this.flushBuffer('originalTx')
    await this.flushBuffer('cycle')
  }

  // /**
  //  * Conditionally checkpoint WAL files if enough flushes have occurred
  //  * This prevents WAL files from growing too large during long sync operations
  //  */
  // private async maybeCheckpointWAL(): Promise<void> {
  //   if (this.flushCount % this.CHECKPOINT_FREQUENCY === 0) {
  //     console.log(
  //       `[WAL Checkpoint] Running periodic checkpoint after ${this.flushCount} buffer flushes (~${
  //         this.flushCount * this.ACCUMULATION_THRESHOLD
  //       } records)`
  //     )
  //     // Run checkpoints on all three databases in parallel
  //     // Use PASSIVE mode to avoid blocking readers
  //     await Promise.all([
  //       checkpointWAL(receiptDatabase, 'PASSIVE'),
  //       checkpointWAL(originalTxDataDatabase, 'PASSIVE'),
  //       checkpointWAL(cycleDatabase, 'PASSIVE'),
  //     ])
  //   }
  // }

  // /**
  //  * Record flush timestamp and clean up old timestamps
  //  * Used to track flush frequency and detect system overload
  //  */
  // private recordFlushTimestamp(): void {
  //   const now = Date.now()
  //   this.flushTimestamps.push(now)

  //   // Clean up old timestamps outside the tracking window
  //   this.flushTimestamps = this.flushTimestamps.filter((timestamp) => now - timestamp < this.FLUSH_WINDOW_MS)
  // }

  // /**
  //  * Calculate adaptive flush delay based on recent flush frequency
  //  * Returns a random delay within a range that adapts to system load
  //  */
  // private getAdaptiveFlushDelay(): number {
  //   // Clean up old timestamps first
  //   const now = Date.now()
  //   this.flushTimestamps = this.flushTimestamps.filter((timestamp) => now - timestamp < this.FLUSH_WINDOW_MS)

  //   // Check if system is overloaded (too many flushes in recent window)
  //   const recentFlushCount = this.flushTimestamps.length
  //   const isOverloaded = recentFlushCount >= this.FAST_FLUSH_THRESHOLD
  //   const wasOverloaded = this.minFlushDelay === this.OVERLOAD_MIN_DELAY

  //   // Adjust delay range based on system load
  //   if (isOverloaded) {
  //     // System overloaded - use longer delays
  //     const wasNormal = this.minFlushDelay === 200
  //     this.minFlushDelay = this.OVERLOAD_MIN_DELAY
  //     this.maxFlushDelay = this.OVERLOAD_MAX_DELAY
  //     if (wasNormal) {
  //       // Log when transitioning from normal to overloaded
  //       console.log(
  //         `[Adaptive Cooling] ⚠️  OVERLOAD DETECTED! ${recentFlushCount} flushes in last ${
  //           this.FLUSH_WINDOW_MS / 1000
  //         }s. ` + `Increasing cooling delay: ${this.minFlushDelay}-${this.maxFlushDelay}ms`
  //       )
  //     }
  //   } else if (recentFlushCount < this.FAST_FLUSH_THRESHOLD / 2) {
  //     // System healthy - reduce delays back to normal
  //     if (wasOverloaded) {
  //       // Log when recovering from overload
  //       console.log(
  //         `[Adaptive Cooling] ✓ System recovered! ${recentFlushCount} flushes in last ${
  //           this.FLUSH_WINDOW_MS / 1000
  //         }s. ` + `Reducing cooling delay: 200-1000ms`
  //       )
  //     }
  //     this.minFlushDelay = 200
  //     this.maxFlushDelay = 1000
  //   }

  //   // Return random delay within current range to stagger DB writes
  //   const delay = this.minFlushDelay + Math.floor(Math.random() * (this.maxFlushDelay - this.minFlushDelay))
  //   return delay
  // }

  /**
   * Get current statistics
   */
  getStats(): SyncStats {
    return { ...this.stats }
  }
}
