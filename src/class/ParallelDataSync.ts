import PQueue from 'p-queue'
import * as crypto from '@shardus/crypto-utils'
import { Utils as StringUtils } from '@shardus/types'
import { config, DISTRIBUTOR_URL } from '../config'
import { queryFromDistributor, DataType } from './DataSync'
import { CycleDB, ReceiptDB, OriginalTxDataDB } from '../storage'
import { ParallelSyncCheckpointManager } from './ParallelSyncCheckpoint'
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
  totalCycles: number
  completedCycles: number
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
 * - Automatic resume from database
 * - Work queue for load balancing
 */
export class ParallelDataSync {
  private checkpointManager: ParallelSyncCheckpointManager
  private queue: PQueue
  private syncConfig: ParallelSyncConfig
  private stats: SyncStats
  private httpAgent: http.Agent
  private httpsAgent: https.Agent
  private axiosInstance: AxiosInstance

  constructor(syncConfig?: Partial<ParallelSyncConfig>) {
    this.checkpointManager = new ParallelSyncCheckpointManager()
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
      totalCycles: 0,
      completedCycles: 0,
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
   * Main entry point for parallel sync
   */
  async startSyncing(startCycle: number, endCycle: number): Promise<void> {
    console.log(`\n${'='.repeat(60)}`)
    console.log(`Starting Parallel Cycle Sync: ${startCycle} → ${endCycle}`)
    console.log(`Concurrency: ${this.syncConfig.concurrency} workers`)
    console.log(`${'='.repeat(60)}\n`)

    this.stats.startTime = Date.now()
    this.stats.totalCycles = endCycle - startCycle

    try {
      // Split cycles into batches
      const cycleBatches: { startCycle: number; endCycle: number }[] = []

      for (let i = startCycle; i <= endCycle; ) {
        let batchEnd = i + this.syncConfig.cyclesPerBatch
        if (batchEnd > endCycle) {
          batchEnd = endCycle
        }
        cycleBatches.push({ startCycle: i, endCycle: batchEnd })
        i = batchEnd + 1
      }

      console.log(
        `Created ${cycleBatches.length} cycle batches (${this.syncConfig.cyclesPerBatch} cycles per batch)`
      )

      // Add all batch sync tasks to the queue
      const tasks = cycleBatches.map((batch) =>
        this.queue.add(() => this.syncDataByCycleRange(batch.startCycle, batch.endCycle))
      )

      // Wait for all tasks to complete
      await Promise.all(tasks)
      this.stats.endTime = Date.now()

      // Summary
      await this.printSummary()
    } catch (error) {
      console.error('Fatal error in parallel sync:', error)
      this.stats.errors++
      throw error
    }
  }

  /**
   * Sync data in parallel using adaptive multi-cycle fetching with prefetching on endpoints
   * Adaptively handles partial cycle completion (e.g., if requesting cycles 1-10 but only get data from 1-5)
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

      if (config.verbose || this.stats.completedCycles % 10 === 0) {
        const progress = ((this.stats.completedCycles / this.stats.totalCycles) * 100).toFixed(1)
        console.log(
          `Progress: ${this.stats.completedCycles}/${this.stats.totalCycles} cycles (${progress}%) [batch: ${startCycle}-${endCycle}]`
        )
      }
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
      const response = await this.fetchCyclesByCycleRange(startCycle, endCycle)

      if (!response || response.length === 0) {
        if (config.verbose) {
          console.log(`[Cycles ${startCycle}-${endCycle}] No cycle data returned`)
        }
        return
      }

      // Process cycles using bulkInsertCycles
      await CycleDB.bulkInsertCycles(response)

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
   */
  private async syncReceiptsByCycleRange(startCycle: number, endCycle: number): Promise<void> {
    let currentCycle = startCycle
    let afterTimestamp = 0
    let afterTxId = ''
    let totalFetched = 0

    // Prefetch: Start fetching first batch immediately
    let nextFetchPromise: Promise<any[]> | null = this.syncConfig.enablePrefetch
      ? this.fetchReceiptsByCycleRange({ startCycle: currentCycle, endCycle, afterTimestamp, afterTxId })
      : null

    while (currentCycle <= endCycle) {
      try {
        // Get the data (either from prefetch or fetch now)
        const response = nextFetchPromise
          ? await nextFetchPromise
          : await this.fetchReceiptsByCycleRange({
              startCycle: currentCycle,
              endCycle,
              afterTimestamp,
              afterTxId,
            })

        if (!response || response.length === 0) {
          break // No more receipts in this cycle range
        }

        // Update after timestamp and txId based on last receipt BEFORE starting next fetch
        const lastReceipt = response[response.length - 1]
        currentCycle = lastReceipt.cycle
        afterTimestamp = lastReceipt.timestamp
        afterTxId = lastReceipt.receiptId

        // Prefetch next batch while processing current batch
        if (
          this.syncConfig.enablePrefetch &&
          response.length >= config.requestLimits.MAX_RECEIPTS_PER_REQUEST
        ) {
          nextFetchPromise = this.fetchReceiptsByCycleRange({
            startCycle: currentCycle,
            endCycle,
            afterTimestamp,
            afterTxId,
          })
        } else {
          nextFetchPromise = null
        }

        // Process receipts (overlaps with next fetch if prefetch enabled)
        await ReceiptDB.processReceiptData(response)

        totalFetched += response.length
        this.stats.totalReceipts += response.length

        if (config.verbose) {
          console.log(
            `[Cycles ${startCycle}-${endCycle}] Receipts: +${response.length} (total: ${totalFetched}), ` +
              `last in cycle ${currentCycle}` +
              (this.syncConfig.enablePrefetch ? ' [prefetch]' : '')
          )
        }

        // If we got less than the max response size, we've exhausted this cycle range
        if (response.length < config.requestLimits.MAX_RECEIPTS_PER_REQUEST) {
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
   */
  private async syncOriginalTxsByCycleRange(startCycle: number, endCycle: number): Promise<void> {
    let currentCycle = startCycle
    let afterTimestamp = 0
    let afterTxId = ''
    let totalFetched = 0

    // Prefetch: Start fetching first batch immediately
    let nextFetchPromise: Promise<any[]> | null = this.syncConfig.enablePrefetch
      ? this.fetchOriginalTxsByCycleRange({
          startCycle: currentCycle,
          endCycle,
          afterTimestamp,
          afterTxId,
        })
      : null

    while (currentCycle <= endCycle) {
      try {
        // Get the data (either from prefetch or fetch now)
        const response = nextFetchPromise
          ? await nextFetchPromise
          : await this.fetchOriginalTxsByCycleRange({
              startCycle: currentCycle,
              endCycle,
              afterTimestamp,
              afterTxId,
            })

        if (!response || response.length === 0) {
          break // No more originalTxs in this cycle range
        }

        // Update after timestamp and txId based on last tx BEFORE starting next fetch
        const lastTx = response[response.length - 1]
        currentCycle = lastTx.cycle
        afterTimestamp = lastTx.timestamp
        afterTxId = lastTx.txId

        // Prefetch next batch while processing current batch
        if (
          this.syncConfig.enablePrefetch &&
          response.length >= config.requestLimits.MAX_ORIGINAL_TXS_PER_REQUEST
        ) {
          nextFetchPromise = this.fetchOriginalTxsByCycleRange({
            startCycle: currentCycle,
            endCycle,
            afterTimestamp,
            afterTxId,
          })
        } else {
          nextFetchPromise = null
        }

        // Process originalTxs (overlaps with next fetch if prefetch enabled)
        await OriginalTxDataDB.processOriginalTxData(response)

        totalFetched += response.length
        this.stats.totalOriginalTxs += response.length

        if (config.verbose) {
          console.log(
            `[Cycles ${startCycle}-${endCycle}] OriginalTxs: +${response.length} (total: ${totalFetched}), ` +
              `last in cycle ${currentCycle}` +
              (this.syncConfig.enablePrefetch ? ' [prefetch]' : '')
          )
        }

        // If we got less than the max response size, we've exhausted this cycle range
        if (response.length < config.requestLimits.MAX_ORIGINAL_TXS_PER_REQUEST) {
          break
        }
      } catch (error) {
        console.error(`Error fetching originalTxs for cycle batch ${startCycle}-${endCycle}:`, error)
        throw error
      }
    }
  }

  /**
   * Fetch cycles by cycle range with retry logic
   */
  private async fetchCyclesByCycleRange(startCycle: number, endCycle: number): Promise<Cycle[]> {
    // Retry with exponential backoff
    for (let attempt = 0; attempt <= this.syncConfig.retryAttempts; attempt++) {
      try {
        const startTime = Date.now()
        const response = await queryFromDistributor(DataType.CYCLE, {
          start: startCycle,
          end: endCycle,
        })
        const networkElapsed = Date.now() - startTime

        if (response && response.data && response.data.cycleInfo) {
          const cycleRecords = response.data.cycleInfo.map((cycleRecord: any) => ({
            counter: cycleRecord.counter,
            cycleRecord,
            start: cycleRecord.start,
            cycleMarker: cycleRecord.marker,
          }))

          if (config.verbose) {
            console.log(
              `[API Timing] Cycles fetch (cycles ${startCycle}-${endCycle}): ${networkElapsed}ms, ` +
                `records: ${cycleRecords.length}`
            )
          }
          return cycleRecords
        }
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
            `Error on cycles fetch (cycles ${startCycle}-${endCycle}), ` +
              `attempt ${attempt + 1}/${this.syncConfig.retryAttempts + 1}, ` +
              `retrying in ${delay}ms...`
          )
          await this.sleep(delay)
          continue
        }

        // Non-retryable error or last attempt failed
        console.error(`Error fetching cycles (cycles ${startCycle}-${endCycle}):`, error.message)
        throw error
      }
    }

    return []
  }

  /**
   * Fetch receipts by multi-cycle  range with retry logic
   * Automatically adapts to cycle sizes - if cycles 1-10 only have data in 1-5, returns that subset
   */
  private async fetchReceiptsByCycleRange({
    startCycle,
    endCycle,
    afterTimestamp,
    afterTxId,
  }: SyncTxDataByCycleRange): Promise<any[]> {
    const data = {
      startCycle,
      endCycle,
      afterTimestamp,
      afterTxId,
      limit: config.requestLimits.MAX_RECEIPTS_PER_REQUEST,
      sender: config.collectorInfo.publicKey,
      sign: undefined,
    }

    crypto.signObj(data, config.collectorInfo.secretKey, config.collectorInfo.publicKey)

    const url = `${DISTRIBUTOR_URL}/receipt/cycle`

    // Retry with exponential backoff
    for (let attempt = 0; attempt <= this.syncConfig.retryAttempts; attempt++) {
      try {
        const startTime = Date.now()
        const response = await this.axiosInstance.post(url, data)
        const networkElapsed = Date.now() - startTime

        const receipts = response.data?.receipts || []

        // Get size metadata from transformResponse and interceptor
        const sizeMetadata = (response.data as ResponseDataWithMetadata)?.__responseSize
        const decompressedKB = sizeMetadata?.decompressedKB || '0.00'
        const compressedKB = sizeMetadata?.compressedKB
        const compressionRatio = sizeMetadata?.compressionRatio
        const compressionSavings = sizeMetadata?.compressionSavings

        if (config.verbose || networkElapsed > 1000 || receipts.length === 0) {
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

        if (response.data && response.data.receipts) {
          return response.data.receipts
        }

        return []
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
            `ECONNRESET on receipts fetch (cycles ${startCycle}-${endCycle}), ` +
              `attempt ${attempt + 1}/${this.syncConfig.retryAttempts + 1}, ` +
              `retrying in ${delay}ms...`
          )
          await this.sleep(delay)
          continue
        }

        // Non-retryable error or last attempt failed
        console.error(
          `Error fetching receipts multi-cycle (cycles ${startCycle}-${endCycle}):`,
          error.message
        )
        throw error
      }
    }

    return []
  }

  /**
   * Fetch originalTxs by multi-cycle range with retry logic
   */
  private async fetchOriginalTxsByCycleRange({
    startCycle,
    endCycle,
    afterTimestamp,
    afterTxId,
  }: SyncTxDataByCycleRange): Promise<any[]> {
    const data = {
      startCycle,
      endCycle,
      afterTimestamp,
      afterTxId,
      limit: config.requestLimits.MAX_ORIGINAL_TXS_PER_REQUEST,
      sender: config.collectorInfo.publicKey,
      sign: undefined,
    }

    crypto.signObj(data, config.collectorInfo.secretKey, config.collectorInfo.publicKey)

    const url = `${DISTRIBUTOR_URL}/originalTx/cycle`

    // Retry with exponential backoff
    for (let attempt = 0; attempt <= this.syncConfig.retryAttempts; attempt++) {
      try {
        const startTime = Date.now()
        const response = await this.axiosInstance.post(url, data)
        const networkElapsed = Date.now() - startTime

        const originalTxs = response.data?.originalTxs || []

        // Get size metadata from transformResponse and interceptor
        const sizeMetadata = (response.data as ResponseDataWithMetadata)?.__responseSize
        const decompressedKB = sizeMetadata?.decompressedKB || '0.00'
        const compressedKB = sizeMetadata?.compressedKB
        const compressionRatio = sizeMetadata?.compressionRatio
        const compressionSavings = sizeMetadata?.compressionSavings

        if (config.verbose || networkElapsed > 1000 || originalTxs.length === 0) {
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

        if (response.data && response.data.originalTxs) {
          return response.data.originalTxs
        }

        return []
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
            `ECONNRESET on originalTxs fetch (cycles ${startCycle}-${endCycle}), ` +
              `attempt ${attempt + 1}/${this.syncConfig.retryAttempts + 1}, ` +
              `retrying in ${delay}ms...`
          )
          await this.sleep(delay)
          continue
        }

        // Non-retryable error or last attempt failed
        console.error(
          `Error fetching originalTxs multi-cycle (cycles ${startCycle}-${endCycle}):`,
          error.message
        )
        throw error
      }
    }

    return []
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
  private async printSummary(): Promise<void> {
    const elapsedMs = (this.stats.endTime || Date.now()) - this.stats.startTime
    const elapsedSec = (elapsedMs / 1000).toFixed(2)
    const elapsedMin = (elapsedMs / 60000).toFixed(2)

    console.log(`\n${'='.repeat(60)}`)
    console.log('Parallel Sync Complete!')
    console.log(`${'='.repeat(60)}`)
    console.log(`  Cycles Synced:     ${this.stats.completedCycles}/${this.stats.totalCycles}`)
    console.log(`  Receipts Synced:   ${this.stats.totalReceipts}`)
    console.log(`  OriginalTxs Synced: ${this.stats.totalOriginalTxs}`)
    console.log(`  Errors:            ${this.stats.errors}`)
    console.log(`  Time Elapsed:      ${elapsedSec}s (${elapsedMin} min)`)
    console.log(
      `  Throughput:        ${(this.stats.totalReceipts / (elapsedMs / 1000)).toFixed(0)} receipts/sec`
    )
    console.log(`${'='.repeat(60)}\n`)

    // Print DB summary
    await this.checkpointManager.printSyncSummary()
  }

  /**
   * Get current statistics
   */
  getStats(): SyncStats {
    return { ...this.stats }
  }
}
