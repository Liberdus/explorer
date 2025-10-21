import {
  CoinStatsDB,
  TransactionStatsDB,
  ValidatorStatsDB,
  NodeStatsDB,
  MetadataDB,
  DailyTransactionStatsDB,
  DailyAccountStatsDB,
  DailyNetworkStatsDB,
  DailyCoinStatsDB,
  TotalAccountBalanceDB,
} from '../stats'
import { AccountDB, CycleDB, TransactionDB } from '../storage'
import { TransactionType, AccountType } from '../types'
import { P2P } from '@shardus/types'
import { config, NetworkAccountId } from '../config/index'
import {
  BaseTxStats,
  TransactionStats,
  createEmptyBaseTxStats,
  transactionTypeToPropertyName,
} from '../stats/transactionStats'
import { TotalAccountBalance } from '../stats/totalAccountBalance'

interface NodeState {
  state: string
  id?: string
  nominator?: string
}

const GENESIS_ACCOUNT_BALANCES = [
  '20000000000000000000000000',
  '7983891000000000000000000',
  '7983891000000000000000000',
  '7983891000000000000000000',
]

const GENESIS_SUPPLY = GENESIS_ACCOUNT_BALANCES.reduce((a, b) => a + BigInt(b), BigInt(0))

export const weiBNToEth = (bn: bigint): number => {
  return Number(bn) / 1e18
}

export const ethToWeiBN = (eth: number): bigint => {
  return BigInt(eth * 1e18)
}

const DEFAULT_ACCOUNT_BALANCE = ethToWeiBN(50)
const TOLERANCE_PERCENTAGE = 0.1 // 0.1% tolerance

// // ----- Safe bigint → ETH (string) -----
// const weiBNToEth = (bn: bigint): string => {
//   const ETH_DECIMALS = BigInt(18)
//   const divisor = BigInt(10) ** ETH_DECIMALS
//   const whole = bn / divisor
//   const fraction = bn % divisor
//   return `${whole}.${fraction.toString().padStart(18, '0')}`.replace(/\.?0+$/, '')
// }

// // ----- Safe ETH (string) → bigint -----
// const ethToWeiBN = (eth: string): bigint => {
//   const [whole, fraction = ''] = eth.split('.')
//   return BigInt(whole + fraction.padEnd(18, '0'))
// }

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
  const bucketSize = 1000
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
  const bucketSize = 200 // Setting 1000 gives error
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
          ...createEmptyBaseTxStats(),
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
  const bucketSize = 1000
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
          (a) => a.transactionType === TransactionType.deposit_stake && a.data.success === true
        )
        const withdrawStakeTransactions = transactions.filter(
          (a) => a.transactionType === TransactionType.withdraw_stake && a.data.success === true
        )

        const createTransactions = transactions.filter(
          (a) => a.transactionType === TransactionType.create && a.data.success === true
        )

        const registerTransactions = transactions.filter(
          (a) => a.transactionType === TransactionType.register && a.data.success === true
        )

        try {
          // Calculate total staked amount in cycle
          const stakeAmount: bigint = depositStakeTransactions.reduce((sum, current) => {
            const stakeAmount = (current.data as any)?.additionalInfo?.stake || BigInt(0)
            return sum + stakeAmount
          }, BigInt(0))
          // Calculate total unstaked amount in cycle
          const unStakeAmount: bigint = withdrawStakeTransactions.reduce((sum, current) => {
            const unStakeAmount = (current.data as any)?.additionalInfo?.stake || BigInt(0)
            return sum + unStakeAmount
          }, BigInt(0))
          // Calculate total node rewards in cycle
          const nodeRewardAmount: bigint = withdrawStakeTransactions.reduce((sum, current) => {
            const nodeRewardAmount = (current.data as any)?.additionalInfo?.reward || BigInt(0)
            return sum + nodeRewardAmount
          }, BigInt(0))
          // Calculate total node penalties in cycle
          const nodePenaltyAmount: bigint = withdrawStakeTransactions.reduce((sum, current) => {
            const nodePenaltyAmount = (current.data as any)?.additionalInfo?.penalty || BigInt(0)
            return sum + nodePenaltyAmount
          }, BigInt(0))
          // Calculate total gas burnt in cycle
          const transactionFee: bigint = transactions.reduce((sum, current) => {
            const transactionFee = (current.data as any).transactionFee || BigInt(0)
            return sum + transactionFee
          }, BigInt(0))

          // Calculate total network toll tax fee in cycle
          const networkTollTaxFee: bigint = transactions.reduce((sum, current) => {
            const networkTollTaxFee = (current.data as any)?.additionalInfo?.networkTollTaxFee || BigInt(0)
            return sum + networkTollTaxFee
          }, BigInt(0))

          // Calculate the total amount of tokens created in cycle
          const createAmount: bigint = createTransactions.reduce((sum, current) => {
            if (current.data?.additionalInfo?.amount !== undefined) {
              const newAccountBalance =
                current.data.additionalInfo.newAccount === true ? DEFAULT_ACCOUNT_BALANCE : BigInt(0)
              return sum + current.data.additionalInfo.amount + newAccountBalance
            }
            const createAmount = (current.originalTxData as any).tx.amount || BigInt(0)
            return sum + createAmount
          }, BigInt(0))

          const registerAmount = BigInt(registerTransactions.length) * DEFAULT_ACCOUNT_BALANCE

          const coinStatsForCycle = {
            cycle: cycle.counter,
            totalSupplyChange: weiBNToEth(
              registerAmount +
                createAmount +
                nodeRewardAmount -
                transactionFee -
                networkTollTaxFee -
                nodePenaltyAmount
            ),
            totalStakeChange: weiBNToEth(stakeAmount - unStakeAmount - nodePenaltyAmount),
            transactionFee: weiBNToEth(transactionFee),
            networkCommission: weiBNToEth(networkTollTaxFee + nodePenaltyAmount),
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

export const recordDailyTransactionStats = async (
  dateStartTime: number,
  dateEndTime: number
): Promise<void> => {
  const one_day_in_ms = 24 * 60 * 60 * 1000
  for (let startTimestamp = dateStartTime; startTimestamp < dateEndTime; startTimestamp += one_day_in_ms) {
    const beforeTimestamp = startTimestamp + one_day_in_ms // ( Before 00:00:00 )
    const afterTimestamp = startTimestamp - 1 // ( After 23:59:59 )
    // Get transaction counts by type in a single query
    const txCountsByType = await TransactionDB.queryTransactionCountsByType(beforeTimestamp, afterTimestamp)

    // Initialize transaction counts by type
    const txsCountByTypeObject: BaseTxStats = createEmptyBaseTxStats()
    const txsCountWithFeeByType: BaseTxStats = createEmptyBaseTxStats()

    // Update counts based on query results
    let calculatedTotalTxs = 0
    let calculatedUserTotalTxs = 0 // Transactions with txFee > 0
    txCountsByType.forEach((typeCount) => {
      calculatedTotalTxs += typeCount.total
      calculatedUserTotalTxs += typeCount.countWithFee
      const propertyName = transactionTypeToPropertyName(typeCount.transactionType as TransactionType)
      txsCountByTypeObject[propertyName] = typeCount.total
      txsCountWithFeeByType[propertyName] = typeCount.countWithFee
    })

    // Cast to string manually to preserve the key order of baseTxStats
    const txsByType = JSON.stringify(txsCountByTypeObject)
    const txsWithFeeByType = JSON.stringify(txsCountWithFeeByType)

    const dailyTransactionStats: DailyTransactionStatsDB.DbDailyTransactionStats = {
      dateStartTime: startTimestamp,
      totalTxs: calculatedTotalTxs,
      totalUserTxs: calculatedUserTotalTxs,
      txsByType,
      txsWithFeeByType,
    }

    await DailyTransactionStatsDB.insertDailyTransactionStats(dailyTransactionStats)
    console.log(
      `Stored daily transaction stats for ${new Date(startTimestamp).toUTCString()}`,
      dailyTransactionStats
    )
  }
}

export const recordDailyAccountStats = async (dateStartTime: number, dateEndTime: number): Promise<void> => {
  const one_day_in_ms = 24 * 60 * 60 * 1000
  for (let startTimestamp = dateStartTime; startTimestamp < dateEndTime; startTimestamp += one_day_in_ms) {
    const beforeTimestamp = startTimestamp + one_day_in_ms // ( Before 00:00:00 )
    const afterTimestamp = startTimestamp - 1 // ( After 23:59:59 )
    // Query accounts created directly from accounts database (all types)
    const newAccounts = await AccountDB.queryAccountCountByCreatedTimestamp(afterTimestamp, beforeTimestamp)

    // Query user accounts created directly from accounts database (UserAccount type only)
    const newUserAccounts = await AccountDB.queryAccountCountByCreatedTimestamp(
      afterTimestamp,
      beforeTimestamp,
      AccountType.UserAccount
    )

    // Query active accounts by transactions with txFee > 0
    const activeAccounts = await TransactionDB.queryActiveAccountsCountByTxFee(
      beforeTimestamp,
      afterTimestamp,
      true
    )

    const dailyAccountStats: DailyAccountStatsDB.DbDailyAccountStats = {
      dateStartTime: startTimestamp,
      newAccounts,
      newUserAccounts,
      activeAccounts,
    }

    await DailyAccountStatsDB.insertDailyAccountStats(dailyAccountStats)
    console.log(`Stored daily account stats for ${new Date(startTimestamp).toUTCString()}`, dailyAccountStats)
  }
}

export const recordDailyNetworkStats = async (dateStartTime: number, dateEndTime: number): Promise<void> => {
  const one_day_in_ms = 24 * 60 * 60 * 1000
  for (let startTimestamp = dateStartTime; startTimestamp < dateEndTime; startTimestamp += one_day_in_ms) {
    const beforeTimestamp = startTimestamp + one_day_in_ms // ( Before 00:00:00 )
    const afterTimestamp = startTimestamp - 1 // ( After 23:59:59 )
    // Get network account data for this time period - look for any network account snapshot
    const networkAccount = await AccountDB.queryAccountByAccountId(NetworkAccountId)

    // Convert milliseconds to seconds since cycle.start is stored in seconds
    const afterTimestampInSeconds = Math.floor(afterTimestamp / 1000)
    const beforeTimestampInSeconds = Math.floor(beforeTimestamp / 1000)

    // Calculate average active nodes from cycle records in the time period
    const cycleRecords = await CycleDB.queryCycleRecordsByTimestamp(
      afterTimestampInSeconds,
      beforeTimestampInSeconds
    )
    let lastCycleCounter = 0
    let totalActiveNodes = 0
    let totalStandbyNodes = 0
    for (const cycle of cycleRecords) {
      const {
        activated,
        active,
        removed,
        apoptosized,
        standbyAdd,
        standby,
        syncing,
        lostSyncing,
        appRemoved,
        standbyRemove,
        counter,
      } = cycle.cycleRecord
      lastCycleCounter = counter
      const totalActive = activated.length + active - removed.length - appRemoved.length - apoptosized.length
      const totalSyncing = syncing - lostSyncing.length
      const totalStandby = standbyAdd.length + standby - standbyRemove.length
      totalActiveNodes += totalActive
      totalStandbyNodes += totalSyncing + totalStandby
    }
    const avgActiveNodes = totalActiveNodes > 0 ? Math.round(totalActiveNodes / cycleRecords.length) : 0
    const avgStandbyNodes = totalStandbyNodes > 0 ? Math.ceil(totalStandbyNodes / cycleRecords.length) : 0
    console.log(
      `Total active nodes: ${totalActiveNodes}, total standby nodes: ${totalStandbyNodes} in ${cycleRecords.length} cycles`,
      `Average active nodes: ${avgActiveNodes}, average standby nodes: ${avgStandbyNodes}`
    )

    const current = networkAccount.data.current
    const transactionFeeUsdStr = current.transactionFeeUsdStr
    const stabilityFactorStr = current.stabilityFactorStr
    const minTollUsdStr = current.minTollUsdStr
    const defaultTollUsdStr = current.defaultTollUsdStr
    const nodePenaltyUsdStr = current.nodePenaltyUsdStr
    const nodeRewardAmountUsdStr = current.nodeRewardAmountUsdStr
    const stakeRequiredUsdStr = current.stakeRequiredUsdStr

    const dailyNetworkStats: DailyNetworkStatsDB.DbDailyNetworkStats = {
      dateStartTime: startTimestamp,
      stabilityFactorStr,
      transactionFeeUsdStr,
      stakeRequiredUsdStr,
      nodeRewardAmountUsdStr,
      nodePenaltyUsdStr,
      defaultTollUsdStr,
      minTollUsdStr,
      activeNodes: avgActiveNodes,
      standbyNodes: avgStandbyNodes,
    }

    // Go through all changes and stop after the last cycle of the time period, so that the relative values are correct for the time period
    const changes = networkAccount.data.listOfChanges
    for (const change of changes) {
      if (change.cycle > lastCycleCounter) break
      if (change.appData == null) continue
      for (const appDataKey of Object.keys(change.appData)) {
        dailyNetworkStats[appDataKey] = change.appData[appDataKey]
      }
    }

    await DailyNetworkStatsDB.insertDailyNetworkStats(dailyNetworkStats)
    console.log(`Stored daily network stats for ${new Date(startTimestamp).toUTCString()}`, dailyNetworkStats)
  }
}

export const recordDailyCoinStats = async (dateStartTime: number, dateEndTime: number): Promise<void> => {
  const one_day_in_ms = 24 * 60 * 60 * 1000
  for (let startTimestamp = dateStartTime; startTimestamp < dateEndTime; startTimestamp += one_day_in_ms) {
    const beforeTimestamp = startTimestamp + one_day_in_ms // ( Before 00:00:00 )
    const afterTimestamp = startTimestamp - 1 // ( After 23:59:59 )
    // Query transactions directly by timestamp
    const transactions = await TransactionDB.queryTransactions({
      limit: 0,
      beforeTimestamp,
      afterTimestamp,
    })

    // Filter transactions
    const depositStakeTransactions = transactions.filter(
      (a) => a.transactionType === TransactionType.deposit_stake && a.data.success === true
    )
    const withdrawStakeTransactions = transactions.filter(
      (a) => a.transactionType === TransactionType.withdraw_stake && a.data.success === true
    )
    const claimRewardTransactions = transactions.filter(
      (a) => a.transactionType === TransactionType.claim_reward && a.data.success === true
    )
    const createTransactions = transactions.filter(
      (a) => a.transactionType === TransactionType.create && a.data.success === true
    )
    const registerTransactions = transactions.filter(
      (a) => a.transactionType === TransactionType.register && a.data.success === true
    )

    // Calculate total staked amount
    const stakeAmount: bigint = depositStakeTransactions.reduce((sum, current) => {
      const stakeAmount = (current.data as any)?.additionalInfo?.stake || BigInt(0)
      return sum + stakeAmount
    }, BigInt(0))

    // Calculate total unstaked amount
    const unStakeAmount: bigint = withdrawStakeTransactions.reduce((sum, current) => {
      const unStakeAmount = (current.data as any)?.additionalInfo?.stake || BigInt(0)
      return sum + unStakeAmount
    }, BigInt(0))

    // Calculate total realized node rewards (withdraw stake)
    const rewardAmountRealized: bigint = withdrawStakeTransactions.reduce((sum, current) => {
      const reward = (current.data as any)?.additionalInfo?.reward || BigInt(0)
      return sum + reward
    }, BigInt(0))

    // Calculate total unrealized node rewards (claim reward)
    const rewardAmountUnrealized: bigint = claimRewardTransactions.reduce((sum, current) => {
      const reward = (current.data as any)?.additionalInfo?.rewardedAmount || BigInt(0)
      return sum + reward
    }, BigInt(0))

    // Calculate total node penalties
    const nodePenaltyAmount: bigint = withdrawStakeTransactions.reduce((sum, current) => {
      const nodePenaltyAmount = (current.data as any)?.additionalInfo?.penalty || BigInt(0)
      return sum + nodePenaltyAmount
    }, BigInt(0))

    // Calculate total gas burnt
    const transactionFeeAmount: bigint = transactions.reduce((sum, current) => {
      const transactionFee = (current.data as any).transactionFee || BigInt(0)
      return sum + transactionFee
    }, BigInt(0))

    // Calculate total network toll tax fee
    const networkTollTaxFee: bigint = transactions.reduce((sum, current) => {
      const networkTollTaxFee = (current.data as any)?.additionalInfo?.networkTollTaxFee || BigInt(0)
      return sum + networkTollTaxFee
    }, BigInt(0))

    // Calculate the total amount of tokens created
    const createAmount: bigint = createTransactions.reduce((sum, current) => {
      if (current.data?.additionalInfo?.amount !== undefined) {
        const newAccountBalance =
          current.data.additionalInfo.newAccount === true ? DEFAULT_ACCOUNT_BALANCE : BigInt(0)
        return sum + current.data.additionalInfo.amount + newAccountBalance
      }
      const createAmount = (current.originalTxData as any).tx.amount || BigInt(0)
      return sum + createAmount
    }, BigInt(0))

    const registerAmount = BigInt(registerTransactions.length) * DEFAULT_ACCOUNT_BALANCE

    const mintedCoin = weiBNToEth(registerAmount + createAmount)
    const transactionFee = weiBNToEth(transactionFeeAmount)
    const networkFee = weiBNToEth(networkTollTaxFee)

    const dailyCoinStats: DailyCoinStatsDB.DbDailyCoinStats = {
      dateStartTime: startTimestamp,
      transactionFee,
      networkFee,
      stakeAmount: weiBNToEth(stakeAmount),
      unStakeAmount: weiBNToEth(unStakeAmount),
      penaltyAmount: weiBNToEth(nodePenaltyAmount),
      rewardAmountRealized: weiBNToEth(rewardAmountRealized),
      rewardAmountUnrealized: weiBNToEth(rewardAmountUnrealized),
      mintedCoin,
    }

    await DailyCoinStatsDB.insertDailyCoinStats(dailyCoinStats)
    console.log(`Stored daily coin stats for ${new Date(startTimestamp).toUTCString()}`, dailyCoinStats)
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

    const userAccounts = await AccountDB.queryAccounts({
      limit: 0,
      type: AccountType.UserAccount,
    })

    for (const account of userAccounts) {
      totalBalance += account.data.data.balance
      if (account.data?.operatorAccountInfo?.stake) totalBalance += account.data?.operatorAccountInfo?.stake
    }

    // Calculate the sum of the toll amount of all chat accounts
    let totalToll = BigInt(0)

    const chatAccounts = await AccountDB.queryAccounts({
      limit: 0,
      type: AccountType.ChatAccount,
    })

    for (const account of chatAccounts) {
      totalToll +=
        account.data.toll.payOnRead[0] +
        account.data.toll.payOnRead[1] +
        account.data.toll.payOnReply[0] +
        account.data.toll.payOnReply[1]
    }

    // Add the total toll amount to the total balance
    totalBalance = totalBalance + totalToll

    // console.log('totalBalance', totalBalance, weiBNToEth(totalBalance))

    // Get the total supply calculated from transactions
    const coinStats = await CoinStatsDB.queryAggregatedCoinStats()
    // console.log('coinStats', coinStats)

    // const calculatedSupply = ethToWeiBN(coinStats.totalSupplyChange + config.genesisLIBSupply)
    let calculatedSupply = ethToWeiBN(coinStats.totalSupplyChange) + GENESIS_SUPPLY

    // console.log('calculatedSupply', calculatedSupply, totalBalance > calculatedSupply)

    const registerTxs = await TransactionDB.queryTransactions({
      limit: 0,
      txType: TransactionType.register,
    })

    const successRegisterTxs = registerTxs.filter(
      (a) => a.transactionType === TransactionType.register && a.data.success === true
    )

    calculatedSupply +=
      DEFAULT_ACCOUNT_BALANCE *
      BigInt(userAccounts.length - successRegisterTxs.length - GENESIS_ACCOUNT_BALANCES.length)
    // console.log('calculatedSupply', calculatedSupply, totalBalance > calculatedSupply)

    // Calculate difference and percentage
    const difference =
      totalBalance > calculatedSupply ? totalBalance - calculatedSupply : calculatedSupply - totalBalance

    const differencePercentage =
      calculatedSupply > 0 ? Number((difference * BigInt(10000)) / calculatedSupply) / 100 : 0

    const isWithinTolerance = differencePercentage <= TOLERANCE_PERCENTAGE

    // console.log('difference', difference, weiBNToEth(difference), differencePercentage, isWithinTolerance)

    const result: TotalAccountBalance = {
      cycleNumber,
      timestamp: cycleRecord.cycleRecord.start,
      totalBalance: weiBNToEth(totalBalance).toString(),
      calculatedSupply: weiBNToEth(calculatedSupply).toString(),
      difference: weiBNToEth(difference).toString(),
      differencePercentage,
      isWithinTolerance,
      accountsProcessed: userAccounts.length,
    }

    // if it's not within tolerance, log the result
    if (!result.isWithinTolerance) {
      console.error(
        'Total account balance verification failed:',
        `Cycle: ${result.cycleNumber}`,
        `Account Balances: ${result.totalBalance} LIB`,
        `Calculated Supply: ${result.calculatedSupply} LIB`,
        `Difference: ${result.difference} LIB (${result.differencePercentage.toFixed(4)}%)`,
        `Accounts Processed: ${result.accountsProcessed}`,
        `Tolerance: ${TOLERANCE_PERCENTAGE}%`
      )
    }

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
  // Disable it for now; Need to re-check if the logic is still valid
  const disable = true
  if (disable) return
  try {
    const statesToIgnore = ['activatedPublicKeys', 'standbyRefresh', 'lost', 'refuted']
    const bucketSize = 1000
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
