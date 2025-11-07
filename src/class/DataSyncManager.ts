import { CycleDB, ReceiptDB, OriginalTxDataDB } from '../storage'
import { CycleGap } from '../storage/cycle'
import { config } from '../config'
import { queryFromDistributor, DataType, downloadAndSyncGenesisAccounts } from './DataSync'
import { ParallelDataSync } from './ParallelDataSync'

/**
 * Represents a cycle with mismatched transaction data
 */
export interface MismatchedCycle {
  cycle: number
  localReceipts: number
  distributorReceipts: number
  localOriginalTxs: number
  distributorOriginalTxs: number
  receiptsMismatch: boolean
  originalTxsMismatch: boolean
}

/**
 * Comprehensive recovery plan for data synchronization
 */
export interface DataSyncRecoveryPlan {
  currentDistributorCycle: number
  lastLocalCycle: number
  missingCycleRanges: CycleGap[]
  mismatchedCycles: MismatchedCycle[]
  lookbackVerificationRanges: CycleGap[]
  totalMissingCycles: number
  totalMismatchedCycles: number
  recoveryNeeded: boolean
}

/**
 * DataSyncManager
 *
 * Orchestrates intelligent data synchronization with automatic gap detection and recovery.
 *
 * Key Features:
 * - Anomaly detection: Validates data integrity before sync
 * - Gap identification: Detects missing cycle ranges in local database
 * - Data reconciliation: Compares local vs distributor data
 * - Recovery orchestration: Patches gaps and mismatched cycles
 * - Intelligent routing: Fresh start vs resume from interruption
 *
 * Example Scenario:
 * 1. Parallel sync stops at cycle 150000 (target was 300000)
 * 2. WebSocket saves incremental data from 300001 to 300100
 * 3. Process restarts at cycle 300105
 *
 * Manager identifies and recovers:
 * - Missing range: 150000 to 300001 (parallel sync interruption)
 * - Missing range: 300100 to 300105 (websocket gap during restart)
 * - Mismatched data in lookback window (e.g., 149900-150000)
 *
 * Handles multiple interruption points automatically.
 */
export class DataSyncManager {
  private lookbackCycles: number

  constructor() {
    // Calculate lookback window: cyclesPerBatch * parallelSyncConcurrency
    const cyclesPerBatch = config.cyclesPerBatch || 10
    const concurrency = config.parallelSyncConcurrency || 10
    this.lookbackCycles = cyclesPerBatch * concurrency

    console.log(`DataSyncManager initialized with lookback window: ${this.lookbackCycles} cycles`)
  }

  /**
   * Main entry point for intelligent data synchronization
   * Handles both fresh start and recovery from interruptions
   */
  async syncData(): Promise<void> {
    const response = await this.getTotalDataFromDistributor()
    if (!response) {
      throw new Error('Failed to fetch total data from distributor')
    }
    const { totalCycles } = response
    const lastLocalCycles = await CycleDB.queryLatestCycleRecords(1)
    const lastLocalCycle = lastLocalCycles.length > 0 ? lastLocalCycles[0].counter : -1

    // Always sync genesis accounts first
    if (lastLocalCycle === 0) {
      console.log('Syncing genesis accounts...')
      await downloadAndSyncGenesisAccounts()
    }

    // Check if this is a fresh start
    const isFreshStart = lastLocalCycle === -1 || lastLocalCycle === 0

    if (isFreshStart) {
      // Fresh start - no checkpoint needed, just sync from beginning
      console.log('🆕 Fresh start detected - syncing from cycle 0')
      const parallelDataSync = new ParallelDataSync({
        concurrency: config.parallelSyncConcurrency,
        retryAttempts: 3,
        retryDelayMs: 1000,
      })

      await parallelDataSync.startSyncing(0, totalCycles - 1)

      // Print final database summary
      await this.printSyncSummary()
    } else {
      // Existing data - use DataSyncManager to identify and patch gaps/mismatches
      console.log('📊 Existing data detected - running recovery analysis')
      const recoveryPlan = await this.generateRecoveryPlan(totalCycles)

      // Execute the complete sync (recovery + normal sync)
      await this.executeSyncWithRecovery(recoveryPlan)
    }
  }

  /**
   * Detect data anomalies by verifying last 10-15 cycles against distributor
   * Throws error if critical anomalies are found
   * Fetches local cycle data internally
   */
  async detectDataAnomalies(): Promise<void> {
    // Fetch local cycle data
    const lastLocalCycles = await CycleDB.queryLatestCycleRecords(1)
    const lastLocalCycle = lastLocalCycles.length > 0 ? lastLocalCycles[0].counter : -1
    if (lastLocalCycle === -1) {
      console.log('No local data found, skipping anomaly detection')
      return
    }

    console.log('\n📊 Running data anomaly detection...')

    const response = await this.getTotalDataFromDistributor()
    if (!response) {
      throw new Error('Failed to fetch distributor cycle info')
    }
    const currentDistributorCycle = response.totalCycles

    console.log(`Last local cycle: ${lastLocalCycle}`)
    console.log(`Current distributor cycle: ${currentDistributorCycle}`)

    // Anomaly 1: Local DB has more cycles than distributor
    if (lastLocalCycle > currentDistributorCycle) {
      throw new Error(
        `Local DB has newer cycle than distributor (Local: ${lastLocalCycle}, Distributor: ${currentDistributorCycle})`
      )
    }

    const verificationCycles = 15

    // Anomaly 2: Verify last 15 cycles match with distributor
    let startCycle = lastLocalCycle - verificationCycles + 1
    if (startCycle < 0) {
      startCycle = 0
    }
    const endCycle = lastLocalCycle

    console.log(
      `Verifying last ${verificationCycles} cycles (${startCycle} to ${endCycle}) against distributor...`
    )

    try {
      // Compare cycles data
      const localCycles = await CycleDB.queryCycleRecordsBetween(startCycle, endCycle)
      const distributorResponse = await queryFromDistributor(DataType.CYCLE, {
        start: startCycle,
        end: endCycle,
      })

      if (distributorResponse?.data?.cycleInfo) {
        const distributorCycles = distributorResponse.data.cycleInfo

        // Verify each cycle's marker matches
        for (let i = 0; i < localCycles.length; i++) {
          /* eslint-disable security/detect-object-injection */
          const localCycle = localCycles[i]
          /* eslint-enable security/detect-object-injection */
          const distributorCycle = distributorCycles.find(
            (c: { counter: number; marker: string }) => c.counter === localCycle.counter
          )

          if (!distributorCycle) {
            throw new Error(`Cycle ${localCycle.counter} exists locally but not in distributor`)
          } else if (localCycle.cycleMarker !== distributorCycle.marker) {
            throw new Error(
              `Cycle ${localCycle.counter} marker mismatch: ` +
                `Local ${localCycle.cycleMarker} vs Distributor ${distributorCycle.marker}`
            )
          }
        }
      }

      // Compare receipts count
      const receiptsResponse = await queryFromDistributor(DataType.RECEIPT, {
        startCycle,
        endCycle,
        type: 'tally',
      })

      if (receiptsResponse?.data?.receipts) {
        const distributorReceipts: { cycle: number; receipts: number }[] = receiptsResponse.data.receipts
        const localReceiptsCount = await ReceiptDB.queryReceiptCountByCycles(startCycle, endCycle)

        for (const distReceipt of distributorReceipts) {
          const localReceipt = localReceiptsCount.find((r) => r.cycle === distReceipt.cycle)
          if (localReceipt && localReceipt.receipts > distReceipt.receipts) {
            throw new Error(
              `Receipts count in local DB has more in cycle ${distReceipt.cycle}: ` +
                `Local has ${localReceipt.receipts}, Distributor has ${distReceipt.receipts}`
            )
          }
        }
      }

      // Compare originalTxs count
      const originalTxsResponse = await queryFromDistributor(DataType.ORIGINALTX, {
        startCycle,
        endCycle,
        type: 'tally',
      })

      if (originalTxsResponse?.data?.originalTxs) {
        const distributorOriginalTxs: { cycle: number; originalTxsData: number }[] =
          originalTxsResponse.data.originalTxs
        const localOriginalTxsCount = await OriginalTxDataDB.queryOriginalTxDataCountByCycles(
          startCycle,
          endCycle
        )

        for (const distTx of distributorOriginalTxs) {
          const localTx = localOriginalTxsCount.find((t) => t.cycle === distTx.cycle)
          if (localTx && localTx.originalTxsData > distTx.originalTxsData) {
            throw new Error(
              `OriginalTxs count mismatch in cycle ${distTx.cycle}: ` +
                `Local has ${localTx.originalTxsData}, Distributor has ${distTx.originalTxsData}`
            )
          }
        }
      }
    } catch (error) {
      throw Error(
        `Data anomalies detected! Local database may be corrupted or out of sync. ` +
          `Please patch the database or clear the database and restart the server. ` +
          `Error: ${error}`
      )
    }

    console.log('✅ No data anomalies detected')
  }

  /**
   * Fetch total data count from distributor
   */
  private async getTotalDataFromDistributor(): Promise<{
    totalCycles: number
    totalAccounts: number
    totalReceipts: number
    totalOriginalTxs: number
  } | null> {
    const response = await queryFromDistributor(DataType.TOTALDATA, {})
    if (!response?.data || response.data.totalCycles === undefined) {
      return null
    }
    return response.data
  }

  /**
   * Identify all missing cycle ranges by finding gaps in the cycles DB
   * Uses efficient LEFT JOIN-based SQL query to find ranges directly - O(N) complexity
   *
   * Example:
   * - DB has cycles: 0-149999, 300001-300099, 300106-300200
   * - Missing ranges: 150000-300000, 300100-300105
   * - Returns gaps: [{150000, 300000}, {300100, 300105}]
   */
  private async identifyMissingCycleRanges(targetCycle: number): Promise<CycleGap[]> {
    try {
      console.log(`\n${'='.repeat(60)}`)
      console.log(`Identifying missing cycle ranges up to cycle ${targetCycle}`)
      console.log(`${'='.repeat(60)}`)

      // Get missing cycle ranges directly from SQL using LEFT JOIN
      const gaps = await CycleDB.queryMissingCycleRanges(targetCycle)

      // Handle case where no cycles exist in DB
      if (gaps.length === 0) {
        const cycleCount = await CycleDB.queryCycleCount()
        if (cycleCount === 0) {
          // No cycles in DB, entire range is missing
          console.log('No cycles found in DB, entire range is missing')
          return [
            {
              startCycle: 0,
              endCycle: targetCycle,
              gapSize: targetCycle + 1,
            },
          ]
        } else {
          // All cycles present
          console.log('✅ No missing cycles - database is complete up to target cycle')
          return []
        }
      }

      // Log results
      console.log(`\nTotal gaps found: ${gaps.length}`)
      for (const gap of gaps) {
        console.log(`  Gap: ${gap.startCycle} to ${gap.endCycle} (${gap.gapSize} cycles)`)
      }
      const totalMissing = gaps.reduce((sum, gap) => sum + gap.gapSize, 0)
      console.log(`Total missing cycles: ${totalMissing}`)

      return gaps
    } catch (error) {
      console.error('Error identifying missing cycle ranges:', error)
      throw error
    }
  }

  /**
   * Verify data integrity with lookback window before each gap
   *
   * For each gap, check cyclesPerBatch * parallelSyncConcurrency cycles before the gap
   * to ensure transaction data matches the distributor.
   *
   * Example: Gap at 150000, lookback 100 cycles -> verify 149900-150000
   */
  private async verifyDataIntegrityWithLookback(gaps: CycleGap[]): Promise<MismatchedCycle[]> {
    try {
      console.log(`\n${'='.repeat(60)}`)
      console.log(`Verifying data integrity with ${this.lookbackCycles}-cycle lookback window`)
      console.log(`${'='.repeat(60)}`)

      const allMismatchedCycles: MismatchedCycle[] = []
      const verificationRanges: CycleGap[] = []

      // Build verification ranges for each gap
      for (const gap of gaps) {
        const lookbackStart = Math.max(0, gap.startCycle - this.lookbackCycles)
        const lookbackEnd = gap.startCycle - 1

        // Only verify if there's a valid lookback range
        if (lookbackEnd >= lookbackStart && lookbackEnd >= 0) {
          verificationRanges.push({
            startCycle: lookbackStart,
            endCycle: lookbackEnd,
            gapSize: lookbackEnd - lookbackStart + 1,
          })
          console.log(
            `Verification range for gap at ${gap.startCycle}: cycles ${lookbackStart}-${lookbackEnd}`
          )
        }
      }

      // Deduplicate overlapping verification ranges
      const mergedRanges = this.mergeOverlappingRanges(verificationRanges)
      console.log(`Merged into ${mergedRanges.length} verification ranges`)

      // Verify each range
      for (const range of mergedRanges) {
        console.log(`\nVerifying cycles ${range.startCycle} to ${range.endCycle}...`)

        const mismatched = await this.compareCycleDataWithDistributor(range.startCycle, range.endCycle)
        allMismatchedCycles.push(...mismatched)
      }

      if (allMismatchedCycles.length > 0) {
        console.log(`\n⚠️  Found ${allMismatchedCycles.length} cycles with mismatched data:`)
        for (const mismatch of allMismatchedCycles) {
          console.log(
            `  Cycle ${mismatch.cycle}: ` +
              `Receipts (local: ${mismatch.localReceipts}, distributor: ${mismatch.distributorReceipts}), ` +
              `OriginalTxs (local: ${mismatch.localOriginalTxs}, distributor: ${mismatch.distributorOriginalTxs})`
          )
        }
      } else {
        console.log(`\n✅ All verified cycles have matching data`)
      }

      return allMismatchedCycles
    } catch (error) {
      console.error('Error verifying data integrity:', error)
      throw error
    }
  }

  /**
   * Compare cycle data counts between local DB and distributor
   */
  private async compareCycleDataWithDistributor(
    startCycle: number,
    endCycle: number
  ): Promise<MismatchedCycle[]> {
    const mismatched: MismatchedCycle[] = []

    try {
      // Fetch counts from distributor
      const [receiptsResponse, originalTxsResponse] = await Promise.all([
        queryFromDistributor(DataType.RECEIPT, { startCycle, endCycle, type: 'tally' }),
        queryFromDistributor(DataType.ORIGINALTX, { startCycle, endCycle, type: 'tally' }),
      ])

      if (!receiptsResponse?.data?.receipts || !originalTxsResponse?.data?.originalTxs) {
        console.warn(`Failed to fetch distributor data for cycles ${startCycle}-${endCycle}`)
        return mismatched
      }

      const distributorReceipts: { cycle: number; receipts: number }[] = receiptsResponse.data.receipts
      const distributorOriginalTxs: { cycle: number; originalTxsData: number }[] =
        originalTxsResponse.data.originalTxs

      // Fetch counts from local DB
      const [localReceipts, localOriginalTxs] = await Promise.all([
        ReceiptDB.queryReceiptCountByCycles(startCycle, endCycle),
        OriginalTxDataDB.queryOriginalTxDataCountByCycles(startCycle, endCycle),
      ])

      // Create maps for easier lookup
      const localReceiptsMap = new Map(localReceipts.map((r) => [r.cycle, r.receipts]))
      const localOriginalTxsMap = new Map(localOriginalTxs.map((t) => [t.cycle, t.originalTxsData]))

      // Compare each cycle
      const allCycles = new Set([
        ...distributorReceipts.map((r) => r.cycle),
        ...distributorOriginalTxs.map((t) => t.cycle),
      ])

      for (const cycle of allCycles) {
        const distReceipts = distributorReceipts.find((r) => r.cycle === cycle)?.receipts || 0
        const distOriginalTxs = distributorOriginalTxs.find((t) => t.cycle === cycle)?.originalTxsData || 0

        const localReceiptsCount = localReceiptsMap.get(cycle) || 0
        const localOriginalTxsCount = localOriginalTxsMap.get(cycle) || 0

        const receiptsMismatch = localReceiptsCount !== distReceipts
        const originalTxsMismatch = localOriginalTxsCount !== distOriginalTxs

        if (receiptsMismatch || originalTxsMismatch) {
          mismatched.push({
            cycle,
            localReceipts: localReceiptsCount,
            distributorReceipts: distReceipts,
            localOriginalTxs: localOriginalTxsCount,
            distributorOriginalTxs: distOriginalTxs,
            receiptsMismatch,
            originalTxsMismatch,
          })
        }
      }

      return mismatched
    } catch (error) {
      console.error(`Error comparing data for cycles ${startCycle}-${endCycle}:`, error)
      return mismatched
    }
  }

  /**
   * Merge overlapping or adjacent ranges to minimize API calls
   */
  private mergeOverlappingRanges(ranges: CycleGap[]): CycleGap[] {
    if (ranges.length === 0) return []

    // Sort by start cycle
    const sorted = [...ranges].sort((a, b) => a.startCycle - b.startCycle)
    const merged: CycleGap[] = [sorted[0]]

    for (let i = 1; i < sorted.length; i++) {
      const current = sorted[i]
      const last = merged[merged.length - 1]

      // If current range overlaps or is adjacent to last range, merge them
      if (current.startCycle <= last.endCycle + 1) {
        last.endCycle = Math.max(last.endCycle, current.endCycle)
        last.gapSize = last.endCycle - last.startCycle + 1
      } else {
        merged.push(current)
      }
    }

    return merged
  }

  /**
   * Generate comprehensive recovery plan
   *
   * Orchestrates gap detection and data verification to create a complete recovery strategy.
   * NOTE: This should only be called when there's existing data in DB (not fresh start)
   */
  async generateRecoveryPlan(currentDistributorCycle: number): Promise<DataSyncRecoveryPlan> {
    try {
      const lastLocalCycles = await CycleDB.queryLatestCycleRecords(1)
      const lastLocalCycle = lastLocalCycles.length > 0 ? lastLocalCycles[0].counter : -1

      console.log(`\n${'='.repeat(70)}`)
      console.log(`GENERATING DATA SYNC RECOVERY PLAN`)
      console.log(`${'='.repeat(70)}`)
      console.log(`Current distributor cycle: ${currentDistributorCycle}`)
      console.log(`Last local cycle: ${lastLocalCycle}`)

      // Step 1: Identify missing cycle ranges
      const missingCycleRanges = await this.identifyMissingCycleRanges(currentDistributorCycle)

      // Step 2: Verify data integrity with lookback (only if there are gaps)
      const mismatchedCycles =
        missingCycleRanges.length > 0 ? await this.verifyDataIntegrityWithLookback(missingCycleRanges) : []

      // Calculate lookback ranges for reporting
      const lookbackVerificationRanges: CycleGap[] = []
      for (const gap of missingCycleRanges) {
        const lookbackStart = Math.max(0, gap.startCycle - this.lookbackCycles)
        const lookbackEnd = gap.startCycle - 1
        if (lookbackEnd >= lookbackStart && lookbackEnd >= 0) {
          lookbackVerificationRanges.push({
            startCycle: lookbackStart,
            endCycle: lookbackEnd,
            gapSize: lookbackEnd - lookbackStart + 1,
          })
        }
      }

      const totalMissingCycles = missingCycleRanges.reduce((sum, gap) => sum + gap.gapSize, 0)
      const recoveryNeeded = missingCycleRanges.length > 0 || mismatchedCycles.length > 0

      const plan: DataSyncRecoveryPlan = {
        currentDistributorCycle,
        lastLocalCycle,
        missingCycleRanges,
        mismatchedCycles,
        lookbackVerificationRanges,
        totalMissingCycles,
        totalMismatchedCycles: mismatchedCycles.length,
        recoveryNeeded,
      }

      this.printRecoveryPlan(plan)

      return plan
    } catch (error) {
      console.error('Error generating recovery plan:', error)
      throw error
    }
  }

  /**
   * Execute comprehensive sync with recovery
   *
   * Combines all sync needs (mismatched cycles + missing ranges) and uses ParallelDataSync
   * for everything. No distinction between "patching" and "syncing" - both use the same mechanism.
   */
  async executeSyncWithRecovery(recoveryPlan: DataSyncRecoveryPlan): Promise<void> {
    console.log(`\n${'='.repeat(70)}`)
    console.log(`EXECUTING DATA SYNC WITH RECOVERY`)
    console.log(`${'='.repeat(70)}`)

    try {
      // Combine mismatched cycles and missing ranges into unified sync plan
      const allRangesToSync: CycleGap[] = []

      // Step 1: Add mismatched cycles (convert to ranges)
      if (recoveryPlan.mismatchedCycles.length > 0) {
        console.log(`\n📝 Identified ${recoveryPlan.mismatchedCycles.length} mismatched cycles to patch`)
        const patchRanges = this.groupCyclesIntoRanges(recoveryPlan.mismatchedCycles.map((m) => m.cycle))
        allRangesToSync.push(...patchRanges)
      }

      // Step 2: Add missing cycle ranges
      if (recoveryPlan.missingCycleRanges.length > 0) {
        console.log(`\n📥 Identified ${recoveryPlan.missingCycleRanges.length} missing cycle ranges to sync`)
        allRangesToSync.push(...recoveryPlan.missingCycleRanges)
      }

      // Step 3: Merge and deduplicate ranges
      const mergedRanges = this.mergeOverlappingRanges(allRangesToSync)
      console.log(`\nMerged into ${mergedRanges.length} sync ranges`)

      // Step 4: Execute ParallelDataSync for all ranges
      if (mergedRanges.length > 0) {
        for (const range of mergedRanges) {
          console.log(`\nSyncing range: ${range.startCycle} to ${range.endCycle} (${range.gapSize} cycles)`)

          const parallelSync = new ParallelDataSync({
            concurrency: config.parallelSyncConcurrency || 10,
            retryAttempts: 3,
            retryDelayMs: 1000,
          })

          await parallelSync.startSyncing(range.startCycle, range.endCycle)
          console.log(`✅ Completed range ${range.startCycle} to ${range.endCycle}`)
        }
      } else {
        console.log('\n✅ No data to sync, database is up to date')
      }

      console.log(`\n${'='.repeat(70)}`)
      console.log(`✅ DATA SYNC COMPLETED SUCCESSFULLY`)
      console.log(`${'='.repeat(70)}\n`)

      // Print final database summary
      await this.printSyncSummary()
    } catch (error) {
      console.error('Error executing sync with recovery:', error)
      throw error
    }
  }

  /**
   * Group individual cycles into consecutive ranges
   */
  private groupCyclesIntoRanges(cycles: number[]): CycleGap[] {
    if (cycles.length === 0) return []

    const sorted = [...cycles].sort((a, b) => a - b)
    const ranges: CycleGap[] = []
    let rangeStart = sorted[0]
    let rangeEnd = sorted[0]

    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === rangeEnd + 1) {
        // Consecutive cycle, extend range
        rangeEnd = sorted[i]
      } else {
        // Gap found, save current range and start new one
        ranges.push({
          startCycle: rangeStart,
          endCycle: rangeEnd,
          gapSize: rangeEnd - rangeStart + 1,
        })
        rangeStart = sorted[i]
        rangeEnd = sorted[i]
      }
    }

    // Add last range
    ranges.push({
      startCycle: rangeStart,
      endCycle: rangeEnd,
      gapSize: rangeEnd - rangeStart + 1,
    })

    return ranges
  }

  /**
   * Print recovery plan summary
   */
  private printRecoveryPlan(plan: DataSyncRecoveryPlan): void {
    console.log(`\n${'='.repeat(70)}`)
    console.log(`RECOVERY PLAN SUMMARY`)
    console.log(`${'='.repeat(70)}`)
    console.log(`Current distributor cycle: ${plan.currentDistributorCycle}`)
    console.log(`Last local cycle:          ${plan.lastLocalCycle}`)
    console.log(`Recovery needed:           ${plan.recoveryNeeded ? '⚠️  YES' : '✅ NO'}`)
    console.log(``)
    console.log(`Missing Cycle Ranges:      ${plan.missingCycleRanges.length}`)
    console.log(`Total missing cycles:      ${plan.totalMissingCycles}`)
    if (plan.missingCycleRanges.length > 0) {
      for (const gap of plan.missingCycleRanges) {
        console.log(`  - Cycles ${gap.startCycle} to ${gap.endCycle} (${gap.gapSize} cycles)`)
      }
    }
    console.log(``)
    console.log(`Mismatched Cycles:         ${plan.totalMismatchedCycles}`)
    if (plan.mismatchedCycles.length > 0) {
      for (const mismatch of plan.mismatchedCycles.slice(0, 10)) {
        // Show first 10
        console.log(
          `  - Cycle ${mismatch.cycle}: ` +
            `Receipts ${mismatch.localReceipts}→${mismatch.distributorReceipts}, ` +
            `OriginalTxs ${mismatch.localOriginalTxs}→${mismatch.distributorOriginalTxs}`
        )
      }
      if (plan.mismatchedCycles.length > 10) {
        console.log(`  ... and ${plan.mismatchedCycles.length - 10} more`)
      }
    }
    console.log(``)
    console.log(`Lookback Verification:`)
    for (const range of plan.lookbackVerificationRanges) {
      console.log(`  - Verified cycles ${range.startCycle} to ${range.endCycle}`)
    }
    console.log(`${'='.repeat(70)}\n`)
  }

  /**
   * Get overall sync statistics from database
   */
  async getSyncStats(): Promise<{
    totalCycles: number
    totalReceipts: number
    totalOriginalTxs: number
  }> {
    try {
      const [cycleCount, receiptCount, originalTxCount] = await Promise.all([
        CycleDB.queryCycleCount(),
        ReceiptDB.queryReceiptCount(),
        OriginalTxDataDB.queryOriginalTxDataCount(),
      ])

      return {
        totalCycles: cycleCount || 0,
        totalReceipts: receiptCount || 0,
        totalOriginalTxs: originalTxCount || 0,
      }
    } catch (error) {
      console.error('Error getting sync stats:', error)
      return {
        totalCycles: 0,
        totalReceipts: 0,
        totalOriginalTxs: 0,
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
    console.log('='.repeat(60))
  }
}
