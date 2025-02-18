import {
  CoinStatsDB,
  TransactionStatsDB,
  ValidatorStatsDB,
  NodeStatsDB,
  MetadataDB,
  DailyTransactionStatsDB,
} from '../stats'
import { CycleDB, TransactionDB } from '../storage'
import { TransactionType } from '../types'
import { P2P } from '@shardus/types'
import { config } from '../config/index'

interface NodeState {
  state: string
  id?: string
  nominator?: string
}

export const insertValidatorStats = async (cycleRecord: P2P.CycleCreatorTypes.CycleRecord): Promise<void> => {
  const validatorsInfo: ValidatorStatsDB.ValidatorStats = {
    cycle: cycleRecord.counter,
    active: cycleRecord.active,
    activated: cycleRecord.activated.length,
    syncing: cycleRecord.syncing,
    joined: cycleRecord.joinedConsensors.length,
    removed: cycleRecord.removed.length,
    apoped: cycleRecord.apoptosized.length,
    timestamp: cycleRecord.start,
  }
  await ValidatorStatsDB.insertValidatorStats(validatorsInfo)
}

export const recordOldValidatorsStats = async (
  latestCycle: number,
  lastStoredCycle: number
): Promise<void> => {
  let combineValidatorsStats: ValidatorStatsDB.ValidatorStats[] = []
  const bucketSize = 100
  let startCycle = lastStoredCycle + 1
  let endCycle = startCycle + bucketSize
  while (startCycle <= latestCycle) {
    if (endCycle > latestCycle) endCycle = latestCycle
    const cycles = await CycleDB.queryCycleRecordsBetween(startCycle, endCycle)
    if (cycles.length > 0) {
      for (const cycle of cycles) {
        combineValidatorsStats.push({
          cycle: cycle.counter,
          active: cycle.cycleRecord.active,
          activated: cycle.cycleRecord.activated.length,
          syncing: cycle.cycleRecord.syncing,
          joined: cycle.cycleRecord.joinedConsensors.length,
          removed: cycle.cycleRecord.removed.length,
          apoped: cycle.cycleRecord.apoptosized.length,
          timestamp: cycle.cycleRecord.start,
        })
      }
      await ValidatorStatsDB.bulkInsertValidatorsStats(combineValidatorsStats)
      combineValidatorsStats = []
    } else {
      console.log(`Fail to fetch cycleRecords between ${startCycle} and ${endCycle}`)
    }
    startCycle = endCycle + 1
    endCycle = endCycle + bucketSize
  }
}

export const recordTransactionsStats = async (
  latestCycle: number,
  lastStoredCycle: number
): Promise<void> => {
  let combineTransactionStats: TransactionStatsDB.TransactionStats[] = []
  const bucketSize = 50
  let startCycle = lastStoredCycle + 1
  let endCycle = startCycle + bucketSize
  while (startCycle <= latestCycle) {
    if (endCycle > latestCycle) endCycle = latestCycle
    const cycles = await CycleDB.queryCycleRecordsBetween(startCycle, endCycle)
    if (cycles.length > 0) {
      const transactions = await TransactionDB.queryTransactionCountByCycles(startCycle, endCycle)
      const stakeTransactions = await TransactionDB.queryTransactionCountByCycles(
        startCycle,
        endCycle,
        TransactionType.deposit_stake
      )
      const unstakeTransactions = await TransactionDB.queryTransactionCountByCycles(
        startCycle,
        endCycle,
        TransactionType.withdraw_stake
      )

      // const internalTransactions = await TransactionDB.queryTransactionCountByCycles(
      //   startCycle,
      //   endCycle,
      //   TransactionSearchType.InternalTxReceipt
      // )
      // const granularInternalTransactions = await TransactionDB.queryInternalTransactionCountByCycles(
      //   startCycle,
      //   endCycle
      // )
      for (const cycle of cycles) {
        const txsCycle = transactions.filter((a: { cycle: number }) => a.cycle === cycle.counter)
        // const internalTxsCycle = internalTransactions.filter(
        //   (a: { cycle: number }) => a.cycle === cycle.counter
        // )
        const stakeTxsCycle = stakeTransactions.filter((a: { cycle: number }) => a.cycle === cycle.counter)
        const unstakeTxsCycle = unstakeTransactions.filter(
          (a: { cycle: number }) => a.cycle === cycle.counter
        )

        const granularInternalTxCounts = {
          totalSetGlobalCodeBytesTxs: 0,
          totalInitNetworkTxs: 0,
          totalNodeRewardTxs: 0,
          totalChangeConfigTxs: 0,
          totalApplyChangeConfigTxs: 0,
          totalSetCertTimeTxs: 0,
          totalStakeTxs: 0,
          totalUnstakeTxs: 0,
          totalInitRewardTimesTxs: 0,
          totalClaimRewardTxs: 0,
          totalChangeNetworkParamTxs: 0,
          totalApplyNetworkParamTxs: 0,
          totalPenaltyTxs: 0,
        }

        // granularInternalTransactions
        //   .filter(({ cycle: c }) => c === cycle.counter)
        //   .forEach(({ internalTXType, count }) => {
        //     switch (internalTXType) {
        //       case InternalTXType.SetGlobalCodeBytes:
        //         granularInternalTxCounts.totalSetGlobalCodeBytesTxs += count
        //         break
        //       case InternalTXType.InitNetwork:
        //         granularInternalTxCounts.totalInitNetworkTxs += count
        //         break
        //       case InternalTXType.NodeReward:
        //         granularInternalTxCounts.totalNodeRewardTxs += count
        //         break
        //       case InternalTXType.ChangeConfig:
        //         granularInternalTxCounts.totalChangeConfigTxs += count
        //         break
        //       case InternalTXType.ApplyChangeConfig:
        //         granularInternalTxCounts.totalApplyChangeConfigTxs += count
        //         break
        //       case InternalTXType.SetCertTime:
        //         granularInternalTxCounts.totalSetCertTimeTxs += count
        //         break
        //       case InternalTXType.Stake:
        //         granularInternalTxCounts.totalStakeTxs += count
        //         break
        //       case InternalTXType.Unstake:
        //         granularInternalTxCounts.totalUnstakeTxs += count
        //         break
        //       case InternalTXType.InitRewardTimes:
        //         granularInternalTxCounts.totalInitRewardTimesTxs += count
        //         break
        //       case InternalTXType.ClaimReward:
        //         granularInternalTxCounts.totalClaimRewardTxs += count
        //         break
        //       case InternalTXType.ChangeNetworkParam:
        //         granularInternalTxCounts.totalChangeNetworkParamTxs += count
        //         break
        //       case InternalTXType.ApplyNetworkParam:
        //         granularInternalTxCounts.totalApplyNetworkParamTxs += count
        //         break
        //       case InternalTXType.Penalty:
        //         granularInternalTxCounts.totalPenaltyTxs += count
        //         break
        //     }
        //   })

        combineTransactionStats.push({
          cycle: cycle.counter,
          totalTxs: txsCycle.length > 0 ? txsCycle[0].transactions : 0,
          // totalInternalTxs: internalTxsCycle.length > 0 ? internalTxsCycle[0].transactions : 0,
          totalInternalTxs: 0,
          totalStakeTxs: stakeTxsCycle.length > 0 ? stakeTxsCycle[0].transactions : 0,
          totalUnstakeTxs: unstakeTxsCycle.length > 0 ? unstakeTxsCycle[0].transactions : 0,
          ...granularInternalTxCounts,
          timestamp: cycle.cycleRecord.start,
        })
      }
      /* prettier-ignore */ if (config.verbose)  console.log('combineTransactionStats', combineTransactionStats)
      await TransactionStatsDB.bulkInsertTransactionsStats(combineTransactionStats)
      combineTransactionStats = []
    } else {
      console.log(`Fail to fetch cycleRecords between ${startCycle} and ${endCycle}`)
    }
    startCycle = endCycle + 1
    endCycle = endCycle + bucketSize
  }
}

export const recordCoinStats = async (latestCycle: number, lastStoredCycle: number): Promise<void> => {
  const bucketSize = 50
  let startCycle = lastStoredCycle + 1
  let endCycle = startCycle + bucketSize
  while (startCycle <= latestCycle) {
    if (endCycle > latestCycle) endCycle = latestCycle
    const cycles = await CycleDB.queryCycleRecordsBetween(startCycle, endCycle)
    if (cycles.length > 0) {
      let combineCoinStats: CoinStatsDB.CoinStats[] = []
      for (const cycle of cycles) {
        // Fetch transactions
        const transactions = await TransactionDB.queryTransactionsForCycle(cycle.counter)

        // Filter transactions
        const stakeTransactions = transactions.filter(
          (a) => a.transactionType === TransactionType.deposit_stake
        )
        const unstakeTransactions = transactions.filter(
          (a) => a.transactionType === TransactionType.withdraw_stake
        )

        try {
          // Calculate total staked amount in cycle
          const stakeAmount: bigint = stakeTransactions.reduce((sum, current) => {
            const stakeAmount = (current.originalTxData as any).tx.stake || BigInt(0)
            return sum + stakeAmount
          }, BigInt(0))
          // Calculate total unstaked amount in cycle
          const unStakeAmount: bigint = unstakeTransactions.reduce((sum, current) => {
            const unStakeAmount = (current.originalTxData as any).tx.unstake || BigInt(0)
            return sum + unStakeAmount
          }, BigInt(0))
          // Calculate total node rewards in cycle
          const nodeRewardAmount: bigint = unstakeTransactions.reduce((sum, current) => {
            const nodeRewardAmount = (current.originalTxData as any).tx.nodeReward || BigInt(0)
            return sum + nodeRewardAmount
          }, BigInt(0))
          // Calculate total reward penalties in cycle
          const nodePenaltyAmount: bigint = unstakeTransactions.reduce((sum, current) => {
            const nodePenaltyAmount = (current.originalTxData as any).tx.penalty || BigInt(0)
            return sum + nodePenaltyAmount
          }, BigInt(0))
          // Calculate total gas burnt in cycle
          const transactionFee: bigint = transactions.reduce((sum, current) => {
            const transactionFee = (current.originalTxData as any).transactionFee || BigInt(0)
            return sum + transactionFee
          }, BigInt(0))

          console.log

          const weiBNToEth = (bn: bigint): number => {
            const result = Number(bn) / 1e18
            return result
          }

          const coinStatsForCycle = {
            cycle: cycle.counter,
            totalSupplyChange: weiBNToEth(nodeRewardAmount - nodePenaltyAmount - transactionFee),
            totalStakeChange: weiBNToEth(stakeAmount - unStakeAmount),
            timestamp: cycle.cycleRecord.start,
          }
          // await CoinStats.insertCoinStats(coinStatsForCycle)
          combineCoinStats.push(coinStatsForCycle)
        } catch (e) {
          console.log(`Failed to record coin stats for cycle ${cycle.counter}`, e)
        }
      }
      await CoinStatsDB.bulkInsertCoinsStats(combineCoinStats)
      combineCoinStats = []
    } else {
      console.log(`Fail to fetch cycleRecords between ${startCycle} and ${endCycle}`)
    }
    startCycle = endCycle + 1
    endCycle = endCycle + bucketSize
  }
}

export const recordDailyTransactionsStats = async (
  dateStartTime: number,
  dateEndTime: number
): Promise<void> => {
  const one_day_in_ms = 24 * 60 * 60 * 1000
  for (let startTimestamp = dateStartTime; startTimestamp <= dateEndTime; startTimestamp += one_day_in_ms) {
    const endTimestamp = startTimestamp + one_day_in_ms - 1
    const totalTxs = await TransactionDB.queryTransactionCount(
      undefined,
      undefined,
      0,
      0,
      startTimestamp,
      endTimestamp
    )
    const totalTransferTxs = await TransactionDB.queryTransactionCount(
      TransactionType.transfer,
      undefined,
      0,
      0,
      startTimestamp,
      endTimestamp
    )
    const totalMessageTxs = await TransactionDB.queryTransactionCount(
      TransactionType.message,
      undefined,
      0,
      0,
      startTimestamp,
      endTimestamp
    )
    const totalDepositStakeTxs = await TransactionDB.queryTransactionCount(
      TransactionType.deposit_stake,
      undefined,
      0,
      0,
      startTimestamp,
      endTimestamp
    )
    const totalWithdrawStakeTxs = await TransactionDB.queryTransactionCount(
      TransactionType.withdraw_stake,
      undefined,
      0,
      0,
      startTimestamp,
      endTimestamp
    )
    const dailyTransactionStats = {
      dateStartTime: startTimestamp,
      totalTxs,
      totalTransferTxs,
      totalMessageTxs,
      totalDepositStakeTxs,
      totalWithdrawStakeTxs,
    }
    await DailyTransactionStatsDB.insertDailyTransactionStats(dailyTransactionStats)
    console.log(
      `Stored daily transaction stats for ${new Date(
        startTimestamp
      )}, startTimestamp ${startTimestamp} endTimestamp ${endTimestamp}`,
      dailyTransactionStats
    )
  }
}

// Update NodeStats record based on new status
export function updateNodeStats(
  nodeStats: NodeStatsDB.NodeStats,
  newState: NodeState,
  currentTimestamp: number
): NodeStatsDB.NodeStats {
  const timeStampDiff = currentTimestamp - nodeStats.timestamp
  switch (nodeStats.currentState) {
    case 'standbyAdd':
      if (newState.state == 'standbyRefresh' || newState.state == 'joinedConsensors') {
        nodeStats.totalStandbyTime += timeStampDiff
      } else {
        /* prettier-ignore */ if (config.verbose) console.log(`Unknown state transition from standbyAdd to ${newState.state}`)
      }
      break

    case 'standbyRefresh':
      if (newState.state == 'joinedConsensors') {
        nodeStats.totalStandbyTime += timeStampDiff
      } else {
        /* prettier-ignore */ if (config.verbose) console.log(`Unknown state transition from standbyRefresh to ${newState.state}`)
      }
      break

    case 'activated':
      if (newState.state == 'removed' || newState.state == 'apoptosized') {
        nodeStats.totalActiveTime += timeStampDiff
      } else {
        /* prettier-ignore */ if (config.verbose) console.log(`Unknown state transition from activated to ${newState.state}`)
      }
      break

    case 'joinedConsensors':
    case 'startedSyncing':
    case 'finishedSyncing':
      // eslint-disable-next-line no-case-declarations
      const validStates: string[] = ['startedSyncing', 'finishedSyncing', 'activated']
      if (validStates.includes(newState.state)) {
        nodeStats.totalSyncTime += timeStampDiff
      } else {
        /* prettier-ignore */ if (config.verbose) console.log(`Unknown state transition from ${nodeStats.currentState} to ${newState.state}`)
      }
      break
    default:
      break
  }

  // Update current state and add nodedId if it exists
  nodeStats.currentState = newState.state
  nodeStats.timestamp = currentTimestamp
  if (newState.nominator) {
    nodeStats.nominator = newState.nominator
  }
  if (newState.id) {
    nodeStats.nodeId = newState.id
  }
  return nodeStats
}

export const recordNodeStats = async (latestCycle: number, lastStoredCycle: number): Promise<void> => {
  try {
    const statesToIgnore = ['activatedPublicKeys', 'standbyRefresh', 'lost', 'refuted']
    const bucketSize = 100
    let startCycle = lastStoredCycle + 1
    let endCycle = startCycle + bucketSize
    while (startCycle <= latestCycle) {
      if (endCycle > latestCycle) endCycle = latestCycle
      /* prettier-ignore */ if (config.verbose) console.log(`recordNodeStats: processing nodeStats for cycles from ${startCycle} to ${endCycle}`)

      const cycles = await CycleDB.queryCycleRecordsBetween(startCycle, endCycle)
      /* prettier-ignore */ if (config.verbose) console.log('recordNodeStats: fetched cycle records', cycles)

      if (cycles.length > 0) {
        for (const cycle of cycles) {
          const pubKeyToStateMap = new Map<string, NodeState>()
          const IdToStateMap = new Map<string, string>()

          Object.keys(cycle.cycleRecord).forEach((key) => {
            // eslint-disable-next-line security/detect-object-injection
            const value = cycle.cycleRecord[key]
            if (
              Array.isArray(value) &&
              !key.toLowerCase().includes('archivers') &&
              !statesToIgnore.includes(key)
            ) {
              // pre-Id states containing complex object list
              if (key == 'joinedConsensors') {
                value.forEach((item: P2P.JoinTypes.JoinedConsensor) => {
                  pubKeyToStateMap.set(item['address'], { state: 'joinedConsensors', id: item['id'] })
                })
              } else if (key == 'standbyAdd') {
                value.forEach((item: P2P.JoinTypes.JoinRequest) => {
                  pubKeyToStateMap.set(item['nodeInfo']['address'], {
                    state: 'standbyAdd',
                    nominator: item?.appJoinData?.stakeCert?.nominator,
                  })
                })

                // post-Id states
              } else if (key == 'startedSyncing') {
                value.forEach((item: string) => {
                  IdToStateMap.set(item, 'startedSyncing')
                })
              } else if (key == 'finishedSyncing') {
                value.forEach((item: string) => {
                  IdToStateMap.set(item, 'finishedSyncing')
                })
              } else if (key == 'removed') {
                value.forEach((item: string) => {
                  if (item != 'all') IdToStateMap.set(item, 'removed')
                })
              } else if (key == 'activated') {
                value.forEach((item: string) => {
                  IdToStateMap.set(item, 'activated')
                })

                // pre-Id states containing simple string list
              } else {
                /* prettier-ignore */ if (config.verbose) console.log(`Unknown state type detected: ${key}`)
                value.forEach((item: string) => {
                  pubKeyToStateMap.set(item, { state: key })
                })
              }
            }
          })

          /* prettier-ignore */ if (config.verbose) console.log(`pubKeyToStateMap for cycle ${cycle.counter}:`, pubKeyToStateMap)
          /* prettier-ignore */ if (config.verbose) console.log(`IdToStateMap for cycle ${cycle.counter}:`, IdToStateMap)
          const updatedNodeStatsCombined: NodeStatsDB.NodeStats[] = []
          // Iterate over pubKeyToStateMap
          for (const [nodeKey, nodeState] of pubKeyToStateMap) {
            const existingNodeStats: NodeStatsDB.NodeStats = await NodeStatsDB.getNodeStatsByAddress(nodeKey)
            if (existingNodeStats) {
              /* prettier-ignore */ if (config.verbose) console.log(`existingNodeStats: `, existingNodeStats)
              // node statistics exists, update node statistics record
              const updatedNodeStats = updateNodeStats(existingNodeStats, nodeState, cycle.cycleRecord.start)
              /* prettier-ignore */ if (config.verbose) console.log(`updatedNodeStats: `, updatedNodeStats)
              updatedNodeStatsCombined.push(updatedNodeStats)
              await NodeStatsDB.insertOrUpdateNodeStats(updatedNodeStats)
            } else {
              const nodeStats: NodeStatsDB.NodeStats = {
                nodeAddress: nodeKey,
                nominator: nodeState.nominator ?? null,
                nodeId: nodeState.id,
                currentState: nodeState.state,
                totalStandbyTime: 0,
                totalActiveTime: 0,
                totalSyncTime: 0,
                timestamp: cycle.cycleRecord.start,
              }
              /* prettier-ignore */ if (config.verbose) console.log('Adding new node stats:', nodeStats)
              updatedNodeStatsCombined.push(nodeStats)
              await NodeStatsDB.insertOrUpdateNodeStats(nodeStats)
            }
          }

          // Iterate over nodeStatus Map
          for (const [nodeId, nodeState] of IdToStateMap) {
            const existingNodeStats: NodeStatsDB.NodeStats = await NodeStatsDB.getNodeStatsById(nodeId)
            if (existingNodeStats) {
              /* prettier-ignore */ if (config.verbose) console.log(`existingNodeStats: `, existingNodeStats)
              // node statistics exists, update node statistics record
              const updatedNodeStats = updateNodeStats(
                existingNodeStats,
                { state: nodeState },
                cycle.cycleRecord.start
              )
              /* prettier-ignore */ if (config.verbose) console.log(`updatedNodeStats: `, updatedNodeStats)
              await NodeStatsDB.insertOrUpdateNodeStats(updatedNodeStats)
              updatedNodeStatsCombined.push(updatedNodeStats)
            } else {
              console.warn(
                `Node statistics record not found for node with Id: ${nodeId} and state ${nodeState}`
              )
            }
          }
          pubKeyToStateMap.clear()
          IdToStateMap.clear()

          // Update node stats for shutdown mode
          if (cycle.cycleRecord.mode == 'shutdown') {
            NodeStatsDB.updateAllNodeStates(cycle.cycleRecord.start)
          }
        }
      } else {
        console.error(`Failed to fetch cycleRecords between ${startCycle} and ${endCycle}`)
      }
      await insertOrUpdateMetadata(MetadataDB.MetadataType.NodeStats, endCycle)
      startCycle = endCycle + 1
      endCycle = endCycle + bucketSize
    }
  } catch (error) {
    console.error(`Error in recordNodeStats: ${error}`)
  }
}

export const patchStatsBetweenCycles = async (startCycle: number, endCycle: number): Promise<void> => {
  await recordOldValidatorsStats(endCycle, startCycle - 1)
  await recordTransactionsStats(endCycle, startCycle - 1)
  await recordCoinStats(endCycle, startCycle - 1)
  await recordNodeStats(endCycle, startCycle - 1)
}

export async function insertOrUpdateMetadata(
  type: MetadataDB.MetadataType,
  latestCycleNumber: number
): Promise<void> {
  await MetadataDB.insertOrUpdateMetadata({ type, cycleNumber: latestCycleNumber })
}
