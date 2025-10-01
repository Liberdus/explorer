import useSWR from 'swr'

import { fetcher } from './fetcher'

import { PATHS } from './paths'
import { BaseDailyNetworkStats } from '../../stats/dailyNetworkStats'
import { BaseDailyCoinStats } from '../../stats/dailyCoinStats'

type StatsResult = {
  totalAccounts: number
  totalNewAccounts: number // accounts created in the last 24 hours
  totalUserTxs: number
  totalNewUserTxs: number // transactions created in the last 24 hours
  totalAccountsChange: number // percentage change: today's new addresses / yesterday's cumulative total * 100
  totalNewAccountsChange: number // percentage change in new accounts (day-to-day comparison)
  totalUserTxsChange: number // percentage change in total transactions (7-day comparison)
  totalNewUserTxsChange: number // percentage change in new transactions (day-to-day comparison)
  totalNewTransactionFee: number // total transaction fee in the last 24 hours
  totalNewBurntFee: number // total burnt fee in the last 24 hours
  totalNewMintedCoin: number // total minted coins in the last 24 hours + node rewards (24 hours)
  totalNewSupply: number // total LIB supply created in the last 24 hours
  totalSupply: number // total LIB supply
  totalStaked: number // total staked amount
  stabilityFactorStr: string // LIB Pric in USD
  transactionFeeUsdStr: string // transaction fee in USD
  nodeRewardAmountUsdStr: string // node reward amount in USD per hour
  stakeRequiredUsdStr: string // stake required amount in USD
  activeNodes: number // number of active nodes count in the last 24 hours
  standbyNodes: number // number of standby nodes count in the last 24 hours
  activeBalanceAccounts: number // accounts with balance > 0 (from latest daily stats)
  activeAccounts: number // accounts that made transactions in the last 24 hours
}

export const useNewStats = (query: {
  fetchAccountStats?: boolean
  fetchTransactionStats?: boolean
  fetchCoinStats?: boolean
  fetchNetworkStats?: boolean
  refreshEnabled?: boolean
}): StatsResult => {
  const { fetchAccountStats, fetchTransactionStats, fetchCoinStats, fetchNetworkStats, refreshEnabled } =
    query

  // set query paths to `null` if we shouldn't fetch them
  const accountStatsQuery = fetchAccountStats ? `${PATHS.STATS_ACCOUNT}?fetchAccountStats=true` : null
  const transactionStatsQuery = fetchTransactionStats
    ? `${PATHS.STATS_TRANSACTION}?fetchTransactionStats=true`
    : null
  const coinStatsQuery = fetchCoinStats ? `${PATHS.STATS_COIN}?count=1` : null
  const networkStatsQuery = fetchNetworkStats ? `${PATHS.STATS_NETWORK}` : null

  const swrOptions = {
    refreshInterval: !refreshEnabled ? 0 : undefined,
    revalidateOnFocus: refreshEnabled,
    revalidateOnReconnect: refreshEnabled,
  }

  // get responses
  const accountStatsResponse = useSWR<{
    totalAccounts: number
    totalNewAccounts: number
    totalAccountsChange: number
    totalNewAccountsChange: number
    activeBalanceAccounts: number
    activeAccounts: number
  }>(accountStatsQuery, fetcher, swrOptions)

  const transactionStatsResponse = useSWR<{
    totalUserTxs: number
    totalNewUserTxs: number
    totalUserTxsChange: number
    totalNewUserTxsChange: number
  }>(transactionStatsQuery, fetcher, swrOptions)
  const coinStatsResponse = useSWR<{
    success: boolean
    dailyCoinStats: BaseDailyCoinStats[]
    totalSupply: number
    totalStaked: number
  }>(coinStatsQuery, fetcher, swrOptions)

  const networkStatsResponse = useSWR<BaseDailyNetworkStats>(networkStatsQuery, fetcher, swrOptions)

  // get values
  const totalAccounts =
    typeof accountStatsResponse.data === 'object' &&
    accountStatsResponse.data != null &&
    'totalAccounts' in accountStatsResponse.data
      ? accountStatsResponse.data.totalAccounts
      : 0
  const totalNewAccounts =
    typeof accountStatsResponse.data === 'object' &&
    accountStatsResponse.data != null &&
    'totalNewAccounts' in accountStatsResponse.data
      ? accountStatsResponse.data.totalNewAccounts
      : 0

  const totalUserTxs =
    typeof transactionStatsResponse.data === 'object' &&
    transactionStatsResponse.data != null &&
    'totalUserTxs' in transactionStatsResponse.data
      ? transactionStatsResponse.data.totalUserTxs
      : 0
  const totalNewUserTxs =
    typeof transactionStatsResponse.data === 'object' &&
    transactionStatsResponse.data != null &&
    'totalNewUserTxs' in transactionStatsResponse.data
      ? transactionStatsResponse.data.totalNewUserTxs
      : 0
  const totalAccountsChange =
    typeof accountStatsResponse.data === 'object' &&
    accountStatsResponse.data != null &&
    'totalAccountsChange' in accountStatsResponse.data
      ? accountStatsResponse.data.totalAccountsChange
      : 0
  const totalNewAccountsChange =
    typeof accountStatsResponse.data === 'object' &&
    accountStatsResponse.data != null &&
    'totalNewAccountsChange' in accountStatsResponse.data
      ? accountStatsResponse.data.totalNewAccountsChange
      : 0
  const totalUserTxsChange =
    typeof transactionStatsResponse.data === 'object' &&
    transactionStatsResponse.data != null &&
    'totalUserTxsChange' in transactionStatsResponse.data
      ? transactionStatsResponse.data.totalUserTxsChange
      : 0
  const totalNewUserTxsChange =
    typeof transactionStatsResponse.data === 'object' &&
    transactionStatsResponse.data != null &&
    'totalNewUserTxsChange' in transactionStatsResponse.data
      ? transactionStatsResponse.data.totalNewUserTxsChange
      : 0
  const totalNewTransactionFee =
    typeof coinStatsResponse.data === 'object' &&
    coinStatsResponse.data != null &&
    'dailyCoinStats' in coinStatsResponse.data &&
    Array.isArray(coinStatsResponse.data.dailyCoinStats) &&
    coinStatsResponse.data.dailyCoinStats.length > 0
      ? coinStatsResponse.data.dailyCoinStats[0].transactionFee
      : 0
  const totalNewBurntFee =
    typeof coinStatsResponse.data === 'object' &&
    coinStatsResponse.data != null &&
    'dailyCoinStats' in coinStatsResponse.data &&
    Array.isArray(coinStatsResponse.data.dailyCoinStats) &&
    coinStatsResponse.data.dailyCoinStats.length > 0
      ? coinStatsResponse.data.dailyCoinStats[0].burntFee +
        coinStatsResponse.data.dailyCoinStats[0].penaltyAmount
      : 0

  const totalNewMintedCoin =
    typeof coinStatsResponse.data === 'object' &&
    coinStatsResponse.data != null &&
    'dailyCoinStats' in coinStatsResponse.data &&
    Array.isArray(coinStatsResponse.data.dailyCoinStats) &&
    coinStatsResponse.data.dailyCoinStats.length > 0
      ? coinStatsResponse.data.dailyCoinStats[0].mintedCoin +
        coinStatsResponse.data.dailyCoinStats[0].rewardAmountUnrealized
      : 0

  const totalNewSupply =
    typeof coinStatsResponse.data === 'object' &&
    coinStatsResponse.data != null &&
    'dailyCoinStats' in coinStatsResponse.data &&
    Array.isArray(coinStatsResponse.data.dailyCoinStats) &&
    coinStatsResponse.data.dailyCoinStats.length > 0
      ? coinStatsResponse.data.dailyCoinStats[0].mintedCoin +
        coinStatsResponse.data.dailyCoinStats[0].rewardAmountRealized -
        coinStatsResponse.data.dailyCoinStats[0].transactionFee -
        coinStatsResponse.data.dailyCoinStats[0].burntFee -
        coinStatsResponse.data.dailyCoinStats[0].penaltyAmount
      : 0

  const totalSupply =
    typeof coinStatsResponse.data === 'object' &&
    coinStatsResponse.data != null &&
    'totalSupply' in coinStatsResponse.data
      ? coinStatsResponse.data.totalSupply
      : 0

  const totalStaked =
    typeof coinStatsResponse.data === 'object' &&
    coinStatsResponse.data != null &&
    'totalStaked' in coinStatsResponse.data
      ? coinStatsResponse.data.totalStaked
      : 0

  const stabilityFactorStr =
    typeof networkStatsResponse.data === 'object' &&
    networkStatsResponse.data != null &&
    'stabilityFactorStr' in networkStatsResponse.data
      ? networkStatsResponse.data.stabilityFactorStr
      : '0'

  const transactionFeeUsdStr =
    typeof networkStatsResponse.data === 'object' &&
    networkStatsResponse.data != null &&
    'stabilityFactorStr' in networkStatsResponse.data
      ? networkStatsResponse.data.transactionFeeUsdStr
      : '0'

  const nodeRewardAmountUsdStr =
    typeof networkStatsResponse.data === 'object' &&
    networkStatsResponse.data != null &&
    'nodeRewardAmountUsdStr' in networkStatsResponse.data
      ? networkStatsResponse.data.nodeRewardAmountUsdStr
      : '0'

  const stakeRequiredUsdStr =
    typeof networkStatsResponse.data === 'object' &&
    networkStatsResponse.data != null &&
    'stakeRequiredUsdStr' in networkStatsResponse.data
      ? networkStatsResponse.data.stakeRequiredUsdStr
      : '0'

  const activeNodes =
    typeof networkStatsResponse.data === 'object' &&
    networkStatsResponse.data != null &&
    'activeNodes' in networkStatsResponse.data
      ? networkStatsResponse.data.activeNodes
      : 0

  const standbyNodes =
    typeof networkStatsResponse.data === 'object' &&
    networkStatsResponse.data != null &&
    'standbyNodes' in networkStatsResponse.data
      ? networkStatsResponse.data.standbyNodes
      : 0

  const activeBalanceAccounts =
    typeof accountStatsResponse.data === 'object' &&
    accountStatsResponse.data != null &&
    'activeBalanceAccounts' in accountStatsResponse.data
      ? accountStatsResponse.data.activeBalanceAccounts
      : 0

  const activeAccounts =
    typeof accountStatsResponse.data === 'object' &&
    accountStatsResponse.data != null &&
    'activeAccounts' in accountStatsResponse.data
      ? accountStatsResponse.data.activeAccounts
      : 0

  return {
    totalAccounts,
    totalNewAccounts,
    totalUserTxs,
    totalNewUserTxs,
    totalAccountsChange,
    totalNewAccountsChange,
    totalUserTxsChange,
    totalNewUserTxsChange,
    totalNewTransactionFee,
    totalNewBurntFee,
    totalNewMintedCoin,
    totalNewSupply,
    totalSupply,
    totalStaked,
    stabilityFactorStr,
    transactionFeeUsdStr,
    nodeRewardAmountUsdStr,
    stakeRequiredUsdStr,
    activeNodes,
    standbyNodes,
    activeBalanceAccounts,
    activeAccounts,
  }
}
