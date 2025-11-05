import PQueue from 'p-queue'
import * as crypto from '@shardus/crypto-utils'
import { Utils as StringUtils } from '@shardus/types'
import { config, DISTRIBUTOR_URL } from '../config'
import { queryFromDistributor, DataType } from './DataSync'
import { CycleDB, ReceiptDB, OriginalTxDataDB } from '../storage'
import { ParallelSyncCheckpointManager, CompositeCursor } from './ParallelSyncCheckpoint'
import { Cycle } from '../types'
import axios, { AxiosInstance } from 'axios'
import http from 'http'
import https from 'https'

/**
 * Configuration for parallel sync
 */
export interface ParallelSyncConfig {
  concurrency: number // Number of parallel workers
  batchSize: number // Items per request
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
 * Parallel sync orchestrator using cycle-based partitioning with composite cursors
 * Implements the optimal sync strategy with:
 * - Cycle-level parallelization
 * - Composite cursor (timestamp + ID) to prevent data loss
 * - Automatic resume from database
 * - Work queue for load balancing
 */
export class ParallelCycleSync {
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
      batchSize: syncConfig?.batchSize || 500,
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
  async syncCycleRange(startCycle: number, endCycle: number): Promise<void> {
    console.log(`\n${'='.repeat(60)}`)
    console.log(`Starting Parallel Cycle Sync: ${startCycle} → ${endCycle}`)
    console.log(`Concurrency: ${this.syncConfig.concurrency} workers`)
    console.log(`${'='.repeat(60)}\n`)

    this.stats.startTime = Date.now()
    this.stats.totalCycles = endCycle - startCycle

    try {
      // Step 1: Fetch all cycle metadata (lightweight)
      console.log('Step 1: Fetching cycle metadata...')
      const cycles = await this.fetchCyclesMetadata(startCycle, endCycle)
      console.log(`✓ Retrieved ${cycles.length} cycles\n`)

      // Step 2: Sync cycles themselves in parallel
      console.log('Step 2: Syncing cycle records...')
      await this.syncCyclesData(cycles)
      console.log(`✓ Synced ${cycles.length} cycle records\n`)

      // Step 3: Sync receipts and originalTxs for all cycles in parallel with multi-cycle batching
      console.log('Step 3: Syncing receipts and originalTxs with multi-cycle batching...')
      await this.syncAllCyclesDataMultiBatch(cycles)

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
   * Fetch cycle metadata from distributor
   */
  private async fetchCyclesMetadata(startCycle: number, endCycle: number): Promise<Cycle[]> {
    const cycles: Cycle[] = []

    // Fetch in chunks
    const CHUNK_SIZE = 100
    for (let i = startCycle; i <= endCycle; i += CHUNK_SIZE) {
      const chunkEnd = Math.min(i + CHUNK_SIZE - 1, endCycle)

      const response = await queryFromDistributor(DataType.CYCLE, {
        start: i,
        end: chunkEnd,
      })

      if (response && response.data && response.data.cycleInfo) {
        cycles.push(
          ...response.data.cycleInfo.map((cycleRecord: any) => ({
            counter: cycleRecord.counter,
            cycleRecord,
            start: cycleRecord.start,
            cycleMarker: cycleRecord.marker,
          }))
        )
      }
    }

    return cycles
  }

  /**
   * Sync cycle records to database
   */
  private async syncCyclesData(cycles: Cycle[]): Promise<void> {
    // Insert cycles in batches
    const BATCH_SIZE = 100
    for (let i = 0; i < cycles.length; i += BATCH_SIZE) {
      const batch = cycles.slice(i, i + BATCH_SIZE)
      await CycleDB.bulkInsertCycles(batch)
    }
  }

  /**
   * Sync receipts and originalTxs for all cycles in parallel (LEGACY - single cycle per request)
   */
  private async syncAllCyclesData(cycles: Cycle[]): Promise<void> {
    // Add all cycle sync tasks to the queue
    const tasks = cycles.map((cycle) => this.queue.add(() => this.syncSingleCycle(cycle)))

    // Wait for all tasks to complete
    await Promise.all(tasks)
  }

  /**
   * Sync receipts and originalTxs using multi-cycle batching with prefetching
   * This dramatically reduces HTTP overhead for cycles with small data
   */
  private async syncAllCyclesDataMultiBatch(cycles: Cycle[]): Promise<void> {
    // Group cycles into batches
    const cycleBatches: Cycle[][] = []
    for (let i = 0; i < cycles.length; i += this.syncConfig.cyclesPerBatch) {
      cycleBatches.push(cycles.slice(i, i + this.syncConfig.cyclesPerBatch))
    }

    console.log(
      `Created ${cycleBatches.length} cycle batches (${this.syncConfig.cyclesPerBatch} cycles per batch)`
    )

    // Add all batch sync tasks to the queue
    const tasks = cycleBatches.map((batch) => this.queue.add(() => this.syncCycleBatch(batch)))

    // Wait for all tasks to complete
    await Promise.all(tasks)
  }

  /**
   * Sync receipts and originalTxs for a single cycle
   */
  private async syncSingleCycle(cycle: Cycle): Promise<void> {
    try {
      // Get cycle time boundaries
      const cycleStart = cycle.start
      const cycleEnd = cycle.cycleRecord.duration
        ? cycle.start + cycle.cycleRecord.duration
        : cycle.start + 60 * 1000 // Default 1 minute

      // Sync both data types in parallel for this cycle
      await Promise.all([
        this.syncCycleReceipts(cycle.counter, cycleStart, cycleEnd),
        this.syncCycleOriginalTxs(cycle.counter, cycleStart, cycleEnd),
      ])

      this.stats.completedCycles++

      if (config.verbose || this.stats.completedCycles % 10 === 0) {
        const progress = ((this.stats.completedCycles / this.stats.totalCycles) * 100).toFixed(1)
        console.log(`Progress: ${this.stats.completedCycles}/${this.stats.totalCycles} cycles (${progress}%)`)
      }
    } catch (error) {
      console.error(`Error syncing cycle ${cycle.counter}:`, error)
      this.stats.errors++
      throw error
    }
  }

  /**
   * Sync receipts and originalTxs for a batch of cycles using multi-cycle endpoints
   * Adaptively handles partial cycle completion (e.g., if requesting cycles 1-10 but only get data from 1-5)
   */
  private async syncCycleBatch(cycleBatch: Cycle[]): Promise<void> {
    if (cycleBatch.length === 0) return

    try {
      const startCycle = cycleBatch[0].counter
      const endCycle = cycleBatch[cycleBatch.length - 1].counter

      // Sync both data types in parallel
      await Promise.all([this.syncCycleBatchReceipts(cycleBatch), this.syncCycleBatchOriginalTxs(cycleBatch)])

      this.stats.completedCycles += cycleBatch.length

      if (config.verbose || this.stats.completedCycles % 10 === 0) {
        const progress = ((this.stats.completedCycles / this.stats.totalCycles) * 100).toFixed(1)
        console.log(
          `Progress: ${this.stats.completedCycles}/${this.stats.totalCycles} cycles (${progress}%) [batch: ${startCycle}-${endCycle}]`
        )
      }
    } catch (error) {
      console.error(
        `Error syncing cycle batch ${cycleBatch[0].counter}-${cycleBatch[cycleBatch.length - 1].counter}:`,
        error
      )
      this.stats.errors++
      throw error
    }
  }

  /**
   * Sync receipts across a batch of cycles using adaptive multi-cycle fetching with prefetching
   */
  private async syncCycleBatchReceipts(cycleBatch: Cycle[]): Promise<void> {
    const startCycle = cycleBatch[0].counter
    const endCycle = cycleBatch[cycleBatch.length - 1].counter

    // Get resume cursor from database for the start cycle
    const initialCursor = await this.checkpointManager.getReceiptsCursor(startCycle, cycleBatch[0].start)

    let currentCycle = startCycle
    let currentCursor: CompositeCursor = initialCursor
    let totalFetched = 0

    // Prefetch: Start fetching first batch immediately
    let nextFetchPromise: Promise<any[]> | null = this.syncConfig.enablePrefetch
      ? this.fetchReceiptsMultiCycle(currentCycle, endCycle, currentCursor)
      : null

    while (currentCycle <= endCycle) {
      try {
        // Get the data (either from prefetch or fetch now)
        const response = nextFetchPromise
          ? await nextFetchPromise
          : await this.fetchReceiptsMultiCycle(currentCycle, endCycle, currentCursor)

        if (!response || response.length === 0) {
          break // No more receipts in this cycle range
        }

        // Update cursor based on last receipt BEFORE starting next fetch
        const lastReceipt = response[response.length - 1]
        currentCycle = lastReceipt.cycle
        const nextCursor: CompositeCursor = {
          timestamp: lastReceipt.timestamp,
          id: lastReceipt.receiptId,
        }

        // Prefetch next batch while processing current batch
        if (this.syncConfig.enablePrefetch && response.length >= this.syncConfig.batchSize) {
          nextFetchPromise = this.fetchReceiptsMultiCycle(currentCycle, endCycle, nextCursor)
        } else {
          nextFetchPromise = null
        }

        // Process receipts (overlaps with next fetch if prefetch enabled)
        await ReceiptDB.processReceiptData(response)

        totalFetched += response.length
        this.stats.totalReceipts += response.length
        currentCursor = nextCursor

        if (config.verbose) {
          console.log(
            `[Cycles ${startCycle}-${endCycle}] Receipts: +${response.length} (total: ${totalFetched}), ` +
              `last in cycle ${currentCycle}` +
              (this.syncConfig.enablePrefetch ? ' [prefetch]' : '')
          )
        }

        // If we got less than batch size, we've exhausted this cycle range
        if (response.length < this.syncConfig.batchSize) {
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
  private async syncCycleBatchOriginalTxs(cycleBatch: Cycle[]): Promise<void> {
    const startCycle = cycleBatch[0].counter
    const endCycle = cycleBatch[cycleBatch.length - 1].counter

    // Get resume cursor from database for the start cycle
    const initialCursor = await this.checkpointManager.getOriginalTxsCursor(startCycle, cycleBatch[0].start)

    let currentCycle = startCycle
    let currentCursor: CompositeCursor = initialCursor
    let totalFetched = 0

    // Prefetch: Start fetching first batch immediately
    let nextFetchPromise: Promise<any[]> | null = this.syncConfig.enablePrefetch
      ? this.fetchOriginalTxsMultiCycle(currentCycle, endCycle, currentCursor)
      : null

    while (currentCycle <= endCycle) {
      try {
        // Get the data (either from prefetch or fetch now)
        const response = nextFetchPromise
          ? await nextFetchPromise
          : await this.fetchOriginalTxsMultiCycle(currentCycle, endCycle, currentCursor)

        if (!response || response.length === 0) {
          break // No more originalTxs in this cycle range
        }

        // Update cursor based on last tx BEFORE starting next fetch
        const lastTx = response[response.length - 1]
        currentCycle = lastTx.cycle
        const nextCursor: CompositeCursor = {
          timestamp: lastTx.timestamp,
          id: lastTx.txId,
        }

        // Prefetch next batch while processing current batch
        if (this.syncConfig.enablePrefetch && response.length >= this.syncConfig.batchSize) {
          nextFetchPromise = this.fetchOriginalTxsMultiCycle(currentCycle, endCycle, nextCursor)
        } else {
          nextFetchPromise = null
        }

        // Process originalTxs (overlaps with next fetch if prefetch enabled)
        await OriginalTxDataDB.processOriginalTxData(response)

        totalFetched += response.length
        this.stats.totalOriginalTxs += response.length
        currentCursor = nextCursor

        if (config.verbose) {
          console.log(
            `[Cycles ${startCycle}-${endCycle}] OriginalTxs: +${response.length} (total: ${totalFetched}), ` +
              `last in cycle ${currentCycle}` +
              (this.syncConfig.enablePrefetch ? ' [prefetch]' : '')
          )
        }

        // If we got less than batch size, we've exhausted this cycle range
        if (response.length < this.syncConfig.batchSize) {
          break
        }
      } catch (error) {
        console.error(`Error fetching originalTxs for cycle batch ${startCycle}-${endCycle}:`, error)
        throw error
      }
    }
  }

  /**
   * Sync receipts for a specific cycle using composite cursor
   */
  private async syncCycleReceipts(cycleNumber: number, cycleStart: number, cycleEnd: number): Promise<void> {
    // Get resume cursor from database
    const cursor = await this.checkpointManager.getReceiptsCursor(cycleNumber, cycleStart)

    let currentCursor: CompositeCursor = cursor
    let totalFetched = 0

    while (true) {
      try {
        const response = await this.fetchReceiptsWithCursor(cycleNumber, currentCursor, cycleEnd)

        if (!response || response.length === 0) {
          break // No more receipts for this cycle
        }

        // Process receipts
        await ReceiptDB.processReceiptData(response)

        totalFetched += response.length
        this.stats.totalReceipts += response.length

        // Update cursor to last item
        const lastReceipt = response[response.length - 1]
        currentCursor = {
          timestamp: lastReceipt.timestamp,
          id: lastReceipt.receiptId,
        }

        if (config.verbose) {
          console.log(`[Cycle ${cycleNumber}] Receipts: +${response.length} (total: ${totalFetched})`)
        }

        // If we got less than batch size, we're done
        if (response.length < this.syncConfig.batchSize) {
          break
        }
      } catch (error) {
        console.error(`Error fetching receipts for cycle ${cycleNumber}:`, error)
        throw error
      }
    }
  }

  /**
   * Sync originalTxs for a specific cycle using composite cursor
   */
  private async syncCycleOriginalTxs(
    cycleNumber: number,
    cycleStart: number,
    cycleEnd: number
  ): Promise<void> {
    // Get resume cursor from database
    const cursor = await this.checkpointManager.getOriginalTxsCursor(cycleNumber, cycleStart)

    let currentCursor: CompositeCursor = cursor
    let totalFetched = 0

    while (true) {
      try {
        const response = await this.fetchOriginalTxsWithCursor(cycleNumber, currentCursor, cycleEnd)

        if (!response || response.length === 0) {
          break // No more originalTxs for this cycle
        }

        // Process originalTxs
        await OriginalTxDataDB.processOriginalTxData(response)

        totalFetched += response.length
        this.stats.totalOriginalTxs += response.length

        // Update cursor to last item
        const lastTx = response[response.length - 1]
        currentCursor = {
          timestamp: lastTx.timestamp,
          id: lastTx.txId,
        }

        if (config.verbose) {
          console.log(`[Cycle ${cycleNumber}] OriginalTxs: +${response.length} (total: ${totalFetched})`)
        }

        // If we got less than batch size, we're done
        if (response.length < this.syncConfig.batchSize) {
          break
        }
      } catch (error) {
        console.error(`Error fetching originalTxs for cycle ${cycleNumber}:`, error)
        throw error
      }
    }
  }

  /**
   * Fetch receipts using composite cursor (prevents data loss on timestamp collisions)
   */
  private async fetchReceiptsWithCursor(
    cycle: number,
    cursor: CompositeCursor,
    beforeTimestamp?: number
  ): Promise<any[]> {
    const data = {
      cycle,
      afterTimestamp: cursor.timestamp,
      afterReceiptId: cursor.id,
      beforeTimestamp,
      limit: this.syncConfig.batchSize,
      sender: config.collectorInfo.publicKey,
      sign: undefined,
    }

    crypto.signObj(data, config.collectorInfo.secretKey, config.collectorInfo.publicKey)

    const url = `${DISTRIBUTOR_URL}/receipt/cycle-cursor`

    try {
      const response = await this.axiosInstance.post(url, data)

      if (response.data && response.data.receipts) {
        return response.data.receipts
      }

      return []
    } catch (error) {
      console.error(`Error fetching receipts with cursor:`, error.message)
      throw error
    }
  }

  /**
   * Fetch originalTxs using composite cursor
   */
  private async fetchOriginalTxsWithCursor(
    cycle: number,
    cursor: CompositeCursor,
    beforeTimestamp?: number
  ): Promise<any[]> {
    const data = {
      cycle,
      afterTimestamp: cursor.timestamp,
      afterTxId: cursor.id,
      beforeTimestamp,
      limit: this.syncConfig.batchSize,
      sender: config.collectorInfo.publicKey,
      sign: undefined,
    }

    crypto.signObj(data, config.collectorInfo.secretKey, config.collectorInfo.publicKey)

    const url = `${DISTRIBUTOR_URL}/originalTx/cycle-cursor`

    try {
      const response = await this.axiosInstance.post(url, data)

      if (response.data && response.data.originalTxs) {
        return response.data.originalTxs
      }

      return []
    } catch (error) {
      console.error(`Error fetching originalTxs with cursor:`, error.message)
      throw error
    }
  }

  /**
   * Fetch receipts across multiple cycles using composite cursor with retry logic
   * Automatically adapts to cycle sizes - if cycles 1-10 only have data in 1-5, returns that subset
   */
  private async fetchReceiptsMultiCycle(
    startCycle: number,
    endCycle: number,
    cursor: CompositeCursor
  ): Promise<any[]> {
    const data = {
      startCycle,
      endCycle,
      afterCycle: startCycle,
      afterTimestamp: cursor.timestamp,
      afterReceiptId: cursor.id,
      limit: this.syncConfig.batchSize,
      sender: config.collectorInfo.publicKey,
      sign: undefined,
    }

    crypto.signObj(data, config.collectorInfo.secretKey, config.collectorInfo.publicKey)

    const url = `${DISTRIBUTOR_URL}/receipt/multi-cycle-cursor`

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
   * Fetch originalTxs across multiple cycles using composite cursor with retry logic
   */
  private async fetchOriginalTxsMultiCycle(
    startCycle: number,
    endCycle: number,
    cursor: CompositeCursor
  ): Promise<any[]> {
    const data = {
      startCycle,
      endCycle,
      afterCycle: startCycle,
      afterTimestamp: cursor.timestamp,
      afterTxId: cursor.id,
      limit: this.syncConfig.batchSize,
      sender: config.collectorInfo.publicKey,
      sign: undefined,
    }

    crypto.signObj(data, config.collectorInfo.secretKey, config.collectorInfo.publicKey)

    const url = `${DISTRIBUTOR_URL}/originalTx/multi-cycle-cursor`

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
