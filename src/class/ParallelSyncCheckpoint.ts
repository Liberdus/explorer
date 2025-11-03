import { CycleDB, ReceiptDB, OriginalTxDataDB } from '../storage'
import { config } from '../config'

/**
 * Composite cursor for tracking sync progress
 * Uses both timestamp and ID to handle timestamp collisions
 */
export interface CompositeCursor {
  timestamp: number
  id: string // receiptId or txId
}

/**
 * Cycle resume information from database
 */
export interface CycleResumeInfo {
  cycleNumber: number
  startTimestamp: number
  endTimestamp: number
  receipts: {
    lastTimestamp: number
    lastId: string
    count: number
  }
  originalTxs: {
    lastTimestamp: number
    lastId: string
    count: number
  }
}

/**
 * Manages sync state by querying the database
 * No separate checkpoint storage needed - DB is source of truth
 */
export class ParallelSyncCheckpointManager {
  /**
   * Get the last completed cycle from database
   */
  async getLastCompletedCycle(): Promise<number> {
    try {
      const cycles = await CycleDB.queryLatestCycleRecords(1)
      if (cycles && cycles.length > 0) {
        return cycles[0].counter
      }
      return 0
    } catch (error) {
      console.error('Error getting last completed cycle:', error)
      return 0
    }
  }

  /**
   * Get resume cursor for receipts in a specific cycle
   * Returns the last receipt's timestamp and ID, or cycle start if none exist
   */
  async getReceiptsCursor(cycleNumber: number, cycleStartTimestamp: number): Promise<CompositeCursor> {
    try {
      // Query last receipt for this cycle
      const receipts = await ReceiptDB.queryReceipts({
        limit: 1,
        startCycleNumber: cycleNumber,
      })

      if (receipts && receipts.length > 0) {
        const lastReceipt = receipts[0]
        return {
          timestamp: lastReceipt.timestamp,
          id: lastReceipt.receiptId,
        }
      }

      // No receipts found for this cycle, start from cycle beginning
      return {
        timestamp: cycleStartTimestamp,
        id: '',
      }
    } catch (error) {
      console.error(`Error getting receipts cursor for cycle ${cycleNumber}:`, error)
      return {
        timestamp: cycleStartTimestamp,
        id: '',
      }
    }
  }

  /**
   * Get resume cursor for originalTxs in a specific cycle
   */
  async getOriginalTxsCursor(cycleNumber: number, cycleStartTimestamp: number): Promise<CompositeCursor> {
    try {
      // Query last originalTx for this cycle
      const originalTxs = await OriginalTxDataDB.queryOriginalTxsData({
        limit: 1, // limit
        startCycle: cycleNumber, // startCycle
      })

      if (originalTxs && originalTxs.length > 0) {
        // Sort by timestamp DESC to get the last one
        originalTxs.sort((a, b) => b.timestamp - a.timestamp)
        const lastTx = originalTxs[0]
        return {
          timestamp: lastTx.timestamp,
          id: lastTx.txId,
        }
      }

      // No originalTxs found for this cycle, start from cycle beginning
      return {
        timestamp: cycleStartTimestamp,
        id: '',
      }
    } catch (error) {
      console.error(`Error getting originalTxs cursor for cycle ${cycleNumber}:`, error)
      return {
        timestamp: cycleStartTimestamp,
        id: '',
      }
    }
  }

  /**
   * Get counts of data already synced for a cycle
   */
  async getCycleSyncStatus(cycleNumber: number): Promise<{
    receiptsCount: number
    originalTxsCount: number
    isComplete: boolean
  }> {
    try {
      const [receiptsCountResult, originalTxsCountResult] = await Promise.all([
        ReceiptDB.queryReceiptCountByCycles(cycleNumber, cycleNumber),
        OriginalTxDataDB.queryOriginalTxDataCountByCycles(cycleNumber, cycleNumber),
      ])

      const receiptsCount =
        receiptsCountResult && receiptsCountResult.length > 0 ? receiptsCountResult[0].receipts : 0

      const originalTxsCount =
        originalTxsCountResult && originalTxsCountResult.length > 0
          ? originalTxsCountResult[0].originalTxsData
          : 0

      return {
        receiptsCount,
        originalTxsCount,
        isComplete: false, // Determined by sync logic
      }
    } catch (error) {
      console.error(`Error getting cycle sync status for cycle ${cycleNumber}:`, error)
      return {
        receiptsCount: 0,
        originalTxsCount: 0,
        isComplete: false,
      }
    }
  }

  /**
   * Determine which cycles need to be synced
   * Compares local DB with distributor totals
   */
  async getCyclesToSync(startCycle: number, endCycle: number): Promise<number[]> {
    try {
      const lastLocalCycle = await this.getLastCompletedCycle()

      // If we have no local data, sync all cycles
      if (lastLocalCycle === 0) {
        const cyclesToSync: number[] = []
        for (let i = startCycle; i <= endCycle; i++) {
          cyclesToSync.push(i)
        }
        return cyclesToSync
      }

      // If endCycle is beyond what we have, sync from last local + 1
      if (endCycle > lastLocalCycle) {
        const cyclesToSync: number[] = []
        for (let i = lastLocalCycle + 1; i <= endCycle; i++) {
          cyclesToSync.push(i)
        }
        return cyclesToSync
      }

      // All cycles already synced
      return []
    } catch (error) {
      console.error('Error determining cycles to sync:', error)
      return []
    }
  }

  /**
   * Check if a cycle is fully synced by comparing counts with distributor
   */
  async isCycleFullySynced(
    cycleNumber: number,
    expectedReceiptsCount: number,
    expectedOriginalTxsCount: number
  ): Promise<boolean> {
    try {
      const status = await this.getCycleSyncStatus(cycleNumber)

      const receiptsMatch = status.receiptsCount === expectedReceiptsCount
      const originalTxsMatch = status.originalTxsCount === expectedOriginalTxsCount

      if (config.verbose) {
        console.log(
          `Cycle ${cycleNumber} sync check: ` +
            `receipts ${status.receiptsCount}/${expectedReceiptsCount}, ` +
            `originalTxs ${status.originalTxsCount}/${expectedOriginalTxsCount}`
        )
      }

      return receiptsMatch && originalTxsMatch
    } catch (error) {
      console.error(`Error checking if cycle ${cycleNumber} is fully synced:`, error)
      return false
    }
  }

  /**
   * Get detailed resume information for a specific cycle
   */
  async getCycleResumeInfo(
    cycleNumber: number,
    cycleStartTimestamp: number,
    cycleEndTimestamp: number
  ): Promise<CycleResumeInfo> {
    const [receiptsCursor, originalTxsCursor, syncStatus] = await Promise.all([
      this.getReceiptsCursor(cycleNumber, cycleStartTimestamp),
      this.getOriginalTxsCursor(cycleNumber, cycleStartTimestamp),
      this.getCycleSyncStatus(cycleNumber),
    ])

    return {
      cycleNumber,
      startTimestamp: cycleStartTimestamp,
      endTimestamp: cycleEndTimestamp,
      receipts: {
        lastTimestamp: receiptsCursor.timestamp,
        lastId: receiptsCursor.id,
        count: syncStatus.receiptsCount,
      },
      originalTxs: {
        lastTimestamp: originalTxsCursor.timestamp,
        lastId: originalTxsCursor.id,
        count: syncStatus.originalTxsCount,
      },
    }
  }

  /**
   * Log sync progress
   */
  logProgress(
    cycleNumber: number,
    dataType: 'receipts' | 'originalTxs',
    itemsFetched: number,
    totalItems: number
  ): void {
    const percentage = totalItems > 0 ? ((totalItems / totalItems) * 100).toFixed(1) : '0.0'
    console.log(
      `[Cycle ${cycleNumber}] ${dataType}: +${itemsFetched} items (total: ${totalItems}, ${percentage}%)`
    )
  }

  /**
   * Get overall sync statistics from database
   */
  async getSyncStats(): Promise<{
    totalCycles: number
    totalReceipts: number
    totalOriginalTxs: number
    lastCycleNumber: number
  }> {
    try {
      const [cycleCount, receiptCount, originalTxCount, lastCycle] = await Promise.all([
        CycleDB.queryCycleCount(),
        ReceiptDB.queryReceiptCount(),
        OriginalTxDataDB.queryOriginalTxDataCount(),
        this.getLastCompletedCycle(),
      ])

      return {
        totalCycles: cycleCount || 0,
        totalReceipts: receiptCount || 0,
        totalOriginalTxs: originalTxCount || 0,
        lastCycleNumber: lastCycle,
      }
    } catch (error) {
      console.error('Error getting sync stats:', error)
      return {
        totalCycles: 0,
        totalReceipts: 0,
        totalOriginalTxs: 0,
        lastCycleNumber: 0,
      }
    }
  }

  /**
   * Print sync summary
   */
  async printSyncSummary(): Promise<void> {
    const stats = await this.getSyncStats()
    console.log('='.repeat(60))
    console.log('Sync Summary:')
    console.log(`  Total Cycles:      ${stats.totalCycles}`)
    console.log(`  Total Receipts:    ${stats.totalReceipts}`)
    console.log(`  Total OriginalTxs: ${stats.totalOriginalTxs}`)
    console.log(`  Last Cycle:        ${stats.lastCycleNumber}`)
    console.log('='.repeat(60))
  }
}
