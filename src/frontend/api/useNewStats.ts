import useSWR from 'swr'

import { fetcher } from './fetcher'

import { PATHS } from './paths'

type StatsResult = {
  totalAccounts: number
  totalNewAccounts: number // accounts created in the last 24 hours
  totalUserTxs: number
  totalNewUserTxs: number // transactions created in the last 24 hours
  totalAccountsChange: number // percentage change in total accounts (7-day comparison)
  totalNewAccountsChange: number // percentage change in new accounts (day-to-day comparison)
  totalUserTxsChange: number // percentage change in total transactions (7-day comparison)
  totalNewUserTxsChange: number // percentage change in new transactions (day-to-day comparison)
  totalNewTransactionFee: number // total transaction fee in the last 24 hours
  totalNewBurntFee: number // total burnt fee in the last 24 hours
  transactionFeeUsd: string // transaction fee in USD
  nodeRewardAmountUsd: string // node reward amount in USD per hour
  stakeRequiredUsd: string // stake required amount in USD
  activeNodes: number // number of active nodes count in the last 24 hours
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
  }>(accountStatsQuery, fetcher, swrOptions)

  const transactionStatsResponse = useSWR<{
    totalUserTxs: number
    totalNewUserTxs: number
    totalUserTxsChange: number
    totalNewUserTxsChange: number
  }>(transactionStatsQuery, fetcher, swrOptions)
  const coinStatsResponse = useSWR<{
    success: boolean
    dailyCoinStats: Array<{
      transactionFee: number
      burntFee: number
    }>
  }>(coinStatsQuery, fetcher, swrOptions)

  const networkStatsResponse = useSWR<{
    transactionFeeUsd: string
    nodeRewardAmountUsd: string
    stakeRequiredUsd: string
    activeNodes: number
  }>(networkStatsQuery, fetcher, swrOptions)

  // get values
  const totalAccounts =
    typeof accountStatsResponse.data === 'object' &&
    accountStatsResponse.data != null &&
    'totalAccounts' in accountStatsResponse.data
      ? Number(accountStatsResponse.data.totalAccounts)
      : 0
  const totalNewAccounts =
    typeof accountStatsResponse.data === 'object' &&
    accountStatsResponse.data != null &&
    'totalNewAccounts' in accountStatsResponse.data
      ? Number(accountStatsResponse.data.totalNewAccounts)
      : 0

  const totalUserTxs =
    typeof transactionStatsResponse.data === 'object' &&
    transactionStatsResponse.data != null &&
    'totalUserTxs' in transactionStatsResponse.data
      ? Number(transactionStatsResponse.data.totalUserTxs)
      : 0
  const totalNewUserTxs =
    typeof transactionStatsResponse.data === 'object' &&
    transactionStatsResponse.data != null &&
    'totalNewUserTxs' in transactionStatsResponse.data
      ? Number(transactionStatsResponse.data.totalNewUserTxs)
      : 0
  const totalAccountsChange =
    typeof accountStatsResponse.data === 'object' &&
    accountStatsResponse.data != null &&
    'totalAccountsChange' in accountStatsResponse.data
      ? Number(accountStatsResponse.data.totalAccountsChange)
      : 0
  const totalNewAccountsChange =
    typeof accountStatsResponse.data === 'object' &&
    accountStatsResponse.data != null &&
    'totalNewAccountsChange' in accountStatsResponse.data
      ? Number(accountStatsResponse.data.totalNewAccountsChange)
      : 0
  const totalUserTxsChange =
    typeof transactionStatsResponse.data === 'object' &&
    transactionStatsResponse.data != null &&
    'totalUserTxsChange' in transactionStatsResponse.data
      ? Number(transactionStatsResponse.data.totalUserTxsChange)
      : 0
  const totalNewUserTxsChange =
    typeof transactionStatsResponse.data === 'object' &&
    transactionStatsResponse.data != null &&
    'totalNewUserTxsChange' in transactionStatsResponse.data
      ? Number(transactionStatsResponse.data.totalNewUserTxsChange)
      : 0
  const totalNewTransactionFee =
    typeof coinStatsResponse.data === 'object' &&
    coinStatsResponse.data != null &&
    'dailyCoinStats' in coinStatsResponse.data &&
    Array.isArray(coinStatsResponse.data.dailyCoinStats) &&
    coinStatsResponse.data.dailyCoinStats.length > 0
      ? Number(coinStatsResponse.data.dailyCoinStats[0].transactionFee)
      : 0
  const totalNewBurntFee =
    typeof coinStatsResponse.data === 'object' &&
    coinStatsResponse.data != null &&
    'dailyCoinStats' in coinStatsResponse.data &&
    Array.isArray(coinStatsResponse.data.dailyCoinStats) &&
    coinStatsResponse.data.dailyCoinStats.length > 0
      ? Number(coinStatsResponse.data.dailyCoinStats[0].burntFee)
      : 0

  const transactionFeeUsd =
    typeof networkStatsResponse.data === 'object' &&
    networkStatsResponse.data != null &&
    'transactionFeeUsd' in networkStatsResponse.data
      ? networkStatsResponse.data.transactionFeeUsd
      : '0.01'

  const nodeRewardAmountUsd =
    typeof networkStatsResponse.data === 'object' &&
    networkStatsResponse.data != null &&
    'nodeRewardAmountUsd' in networkStatsResponse.data
      ? networkStatsResponse.data.nodeRewardAmountUsd
      : '1.0'

  const stakeRequiredUsd =
    typeof networkStatsResponse.data === 'object' &&
    networkStatsResponse.data != null &&
    'stakeRequiredUsd' in networkStatsResponse.data
      ? networkStatsResponse.data.stakeRequiredUsd
      : '10.0'

  const activeNodes =
    typeof networkStatsResponse.data === 'object' &&
    networkStatsResponse.data != null &&
    'activeNodes' in networkStatsResponse.data
      ? Number(networkStatsResponse.data.activeNodes)
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
    transactionFeeUsd,
    nodeRewardAmountUsd,
    stakeRequiredUsd,
    activeNodes,
  }
}
