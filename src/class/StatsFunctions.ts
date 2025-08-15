import {
  CoinStatsDB,
  TransactionStatsDB,
  ValidatorStatsDB,
  NodeStatsDB,
  MetadataDB,
  DailyTransactionStatsDB,
  TotalAccountBalanceDB,
} from '../stats'
import { AccountDB, CycleDB, TransactionDB } from '../storage'
import { TransactionType, AccountType } from '../types'
import { P2P } from '@shardus/types'
import { config } from '../config/index'
import { TransactionStats } from '../stats/transactionStats'
import { TotalAccountBalance } from '../stats/totalAccountBalance'

interface NodeState {
  state: string
  id?: string
  nominator?: string
}

const TOLERANCE_PERCENTAGE = 0.1 // 0.1% tolerance
const GENESIS_SUPPLY = BigInt(config.genesisLIBSupply) * BigInt(10 ** 18) // Convert to wei

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
      for (const cycle of cycles) {
        // Fetch transactions
        const transactions = await TransactionDB.queryTransactionsForCycle(cycle.counter)
        const transactionStats: TransactionStats = {
          timestamp: cycle.cycleRecord.start,
          cycle: cycle.counter,
          totalTxs: transactions.length,
          totalInitNetworkTxs: 0,
          totalNetworkWindowsTxs: 0,
          totalSnapshotTxs: 0,
          totalEmailTxs: 0,
          totalGossipEmailHashTxs: 0,
          totalVerifyTxs: 0,
          totalRegisterTxs: 0,
          totalCreateTxs: 0,
          totalTransferTxs: 0,
          totalDistributeTxs: 0,
          totalMessageTxs: 0,
          totalTollTxs: 0,
          totalFriendTxs: 0,
          totalRemoveFriendTxs: 0,
          totalStakeTxs: 0,
          totalRemoveStakeTxs: 0,
          totalRemoveStakeRequestTxs: 0,
          totalNodeRewardTxs: 0,
          totalSnapshotClaimTxs: 0,
          totalIssueTxs: 0,
          totalProposalTxs: 0,
          totalVoteTxs: 0,
          totalTallyTxs: 0,
          totalApplyTallyTxs: 0,
          totalParametersTxs: 0,
          totalApplyParametersTxs: 0,
          totalDevIssueTxs: 0,
          totalDevProposalTxs: 0,
          totalDevVoteTxs: 0,
          totalDevTallyTxs: 0,
          totalApplyDevTallyTxs: 0,
          totalDevParametersTxs: 0,
          totalApplyDevParametersTxs: 0,
          totalDeveloperPaymentTxs: 0,
          totalApplyDeveloperPaymentTxs: 0,
          totalChangeConfigTxs: 0,
          totalApplyChangeConfigTxs: 0,
          totalChangeNetworkParamTxs: 0,
          totalApplyChangeNetworkParamTxs: 0,
          totalDepositStakeTxs: 0,
          totalWithdrawStakeTxs: 0,
          totalSetCertTimeTxs: 0,
          totalInitRewardTxs: 0,
          totalClaimRewardTxs: 0,
          totalApplyPenaltyTxs: 0,
        }

        transactions.forEach(({ transactionType }) => {
          switch (transactionType) {
            case TransactionType.init_network:
              transactionStats.totalInitNetworkTxs++
              break
            case TransactionType.network_windows:
              transactionStats.totalNetworkWindowsTxs++
              break
            case TransactionType.snapshot:
              transactionStats.totalSnapshotTxs++
              break
            case TransactionType.email:
              transactionStats.totalEmailTxs++
              break
            case TransactionType.gossip_email_hash:
              transactionStats.totalGossipEmailHashTxs++
              break
            case TransactionType.verify:
              transactionStats.totalVerifyTxs++
              break
            case TransactionType.register:
              transactionStats.totalRegisterTxs++
              break
            case TransactionType.create:
              transactionStats.totalCreateTxs++
              break
            case TransactionType.transfer:
              transactionStats.totalTransferTxs++
              break
            case TransactionType.distribute:
              transactionStats.totalDistributeTxs++
              break
            case TransactionType.message:
              transactionStats.totalMessageTxs++
              break
            case TransactionType.toll:
              transactionStats.totalTollTxs++
              break
            case TransactionType.friend:
              transactionStats.totalFriendTxs++
              break
            case TransactionType.remove_friend:
              transactionStats.totalRemoveFriendTxs++
              break
            case TransactionType.stake:
              transactionStats.totalStakeTxs++
              break
            case TransactionType.remove_stake:
              transactionStats.totalRemoveStakeTxs++
              break
            case TransactionType.remove_stake_request:
              transactionStats.totalRemoveStakeRequestTxs++
              break
            case TransactionType.node_reward:
              transactionStats.totalNodeRewardTxs++
              break
            case TransactionType.snapshot_claim:
              transactionStats.totalSnapshotClaimTxs++
              break
            case TransactionType.issue:
              transactionStats.totalIssueTxs++
              break
            case TransactionType.proposal:
              transactionStats.totalProposalTxs++
              break
            case TransactionType.vote:
              transactionStats.totalVoteTxs++
              break
            case TransactionType.tally:
              transactionStats.totalTallyTxs++
              break
            case TransactionType.apply_tally:
              transactionStats.totalApplyTallyTxs++
              break
            case TransactionType.parameters:
              transactionStats.totalParametersTxs++
              break
            case TransactionType.apply_parameters:
              transactionStats.totalApplyParametersTxs++
              break
            case TransactionType.dev_issue:
              transactionStats.totalDevIssueTxs++
              break
            case TransactionType.dev_proposal:
              transactionStats.totalDevProposalTxs++
              break
            case TransactionType.dev_vote:
              transactionStats.totalDevVoteTxs++
              break
            case TransactionType.dev_tally:
              transactionStats.totalDevTallyTxs++
              break
            case TransactionType.apply_dev_tally:
              transactionStats.totalApplyDevTallyTxs++
              break
            case TransactionType.dev_parameters:
              transactionStats.totalDevParametersTxs++
              break
            case TransactionType.apply_dev_parameters:
              transactionStats.totalApplyDevParametersTxs++
              break
            case TransactionType.developer_payment:
              transactionStats.totalDeveloperPaymentTxs++
              break
            case TransactionType.apply_developer_payment:
              transactionStats.totalApplyDeveloperPaymentTxs++
              break
            case TransactionType.change_config:
              transactionStats.totalChangeConfigTxs++
              break
            case TransactionType.apply_change_config:
              transactionStats.totalApplyChangeConfigTxs++
              break
            case TransactionType.change_network_param:
              transactionStats.totalChangeNetworkParamTxs++
              break
            case TransactionType.apply_change_network_param:
              transactionStats.totalApplyChangeNetworkParamTxs++
              break
            case TransactionType.deposit_stake:
              transactionStats.totalDepositStakeTxs++
              break
            case TransactionType.withdraw_stake:
              transactionStats.totalWithdrawStakeTxs++
              break
            case TransactionType.set_cert_time:
              transactionStats.totalSetCertTimeTxs++
              break
            case TransactionType.init_reward:
              transactionStats.totalInitRewardTxs++
              break
            case TransactionType.claim_reward:
              transactionStats.totalClaimRewardTxs++
              break
            case TransactionType.apply_penalty:
              transactionStats.totalApplyPenaltyTxs++
              break
          }
        })
        combineTransactionStats.push(transactionStats)
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

export const recordCoinStats = async (
  latestCycle: number,
  lastStoredCycle: number,
  recordAccountBalance = false
): Promise<void> => {
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
        const depositStakeTransactions = transactions.filter(
          (a) => a.transactionType === TransactionType.deposit_stake
        )
        const withdrawStakeTransactions = transactions.filter(
          (a) => a.transactionType === TransactionType.withdraw_stake
        )

        try {
          // Calculate total staked amount in cycle
          const stakeAmount: bigint = depositStakeTransactions.reduce((sum, current) => {
            const stakeAmount = (current.originalTxData as any).tx.stake || BigInt(0)
            return sum + stakeAmount
          }, BigInt(0))
          // Calculate total unstaked amount in cycle
          const unStakeAmount: bigint = withdrawStakeTransactions.reduce((sum, current) => {
            const unStakeAmount = (current.originalTxData as any).tx.unstake || BigInt(0)
            return sum + unStakeAmount
          }, BigInt(0))
          // Calculate total node rewards in cycle
          const nodeRewardAmount: bigint = withdrawStakeTransactions.reduce((sum, current) => {
            const nodeRewardAmount = (current.originalTxData as any).tx.nodeReward || BigInt(0)
            return sum + nodeRewardAmount
          }, BigInt(0))
          // Calculate total reward penalties in cycle
          const nodePenaltyAmount: bigint = withdrawStakeTransactions.reduce((sum, current) => {
            const nodePenaltyAmount = (current.originalTxData as any).tx.penalty || BigInt(0)
            return sum + nodePenaltyAmount
          }, BigInt(0))
          // Calculate total gas burnt in cycle
          const transactionFee: bigint = transactions.reduce((sum, current) => {
            const transactionFee = (current.originalTxData as any).transactionFee || BigInt(0)
            return sum + transactionFee
          }, BigInt(0))

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
  if (recordAccountBalance) await recordTotalAccountBalances(latestCycle)
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

export const recordTotalAccountBalances = async (cycleNumber: number): Promise<TotalAccountBalance> => {
  try {
    console.log('Record total account balances', cycleNumber)

    // Fetch cycle record of the last cycle
    const cycleRecord = await CycleDB.queryCycleByCounter(cycleNumber)
    if (!cycleRecord) {
      throw new Error(`No cycle record found for cycle ${cycleNumber}`)
    }

    // Calculate the sum of all user account balances
    let totalBalance = BigInt(0)
    const totalUserAccounts = await AccountDB.queryAccountCount(undefined, undefined, AccountType.UserAccount)

    const accounts = await AccountDB.queryAccounts(
      0,
      totalUserAccounts,
      undefined,
      undefined,
      AccountType.UserAccount
    )

    for (const account of accounts) {
      totalBalance += BigInt(account.data.balance) * BigInt(10 ** 18)
    }

    // Get the total supply calculated from transactions
    const coinStats = await CoinStatsDB.queryAggregatedCoinStats()
    const calculatedSupply = BigInt(coinStats.totalSupplyChange + config.genesisLIBSupply) * BigInt(10 ** 18)

    // Calculate difference and percentage
    const difference =
      totalBalance > calculatedSupply ? totalBalance - calculatedSupply : calculatedSupply - totalBalance

    const differencePercentage =
      calculatedSupply > 0 ? Number((difference * BigInt(10000)) / calculatedSupply) / 100 : 0

    const isWithinTolerance = differencePercentage <= TOLERANCE_PERCENTAGE

    const result: TotalAccountBalance = {
      cycleNumber,
      timestamp: cycleRecord.cycleRecord.start,
      totalBalance: totalBalance.toString(),
      calculatedSupply: calculatedSupply.toString(),
      difference: difference.toString(),
      differencePercentage,
      isWithinTolerance,
      accountsProcessed: accounts.length,
    }

    // /**
    //  * Format balance from wei to LIB for display
    //  */
    // const formatBalance = (balance: bigint): string => {
    //   const lib = balance / BigInt(10 ** 18)
    //   const wei = balance % BigInt(10 ** 18)
    //   return wei > 0 ? `${lib}.${wei.toString().padStart(18, '0').replace(/0+$/, '')}` : lib.toString()
    // }

    // /**
    //  * Log verification results with appropriate level based on tolerance
    //  */
    // const logVerificationResult = (result: TotalAccountBalance): void => {
    //   const logLevel = result.isWithinTolerance ? 'info' : 'warn'
    //   const status = result.isWithinTolerance ? 'PASS' : 'FAIL'

    //   const logMessage = [
    //     `Total Account Balance Check [${status}] - Cycle: ${result.cycleNumber}`,
    //     `Account Balances: ${formatBalance(result.totalBalance)} LIB`,
    //     `Calculated Supply: ${formatBalance(result.calculatedSupply)} LIB`,
    //     `Difference: ${formatBalance(result.difference)} LIB (${result.differencePercentage.toFixed(4)}%)`,
    //     `Accounts Processed: ${result.accountsProcessed}`,
    //     `Tolerance: ${TOLERANCE_PERCENTAGE}%`,
    //   ].join(' | ')

    //   if (logLevel === 'warn') {
    //     console.warn('⚠️ ', logMessage)
    //   } else {
    //     console.log('✅', logMessage)
    //   }
    // }

    // // // Log the results
    // logVerificationResult(result)

    // Store the verification result in the database
    await TotalAccountBalanceDB.insertTotalAccountBalance(result)

    return result
  } catch (error) {
    console.error('Total account balance verification failed:', error)
    throw error
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
