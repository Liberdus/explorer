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
}

export const useNewStats = (query: {
  fetchAccountStats?: boolean
  fetchTransactionStats?: boolean
  last24HrsCoinReport?: boolean
  refreshEnabled?: boolean
}): StatsResult => {
  const { fetchAccountStats, fetchTransactionStats, last24HrsCoinReport, refreshEnabled } = query

  // set query paths to `null` if we shouldn't fetch them
  const accountStatsQuery = fetchAccountStats ? `${PATHS.STATS_ACCOUNT}?fetchAccountStats=true` : null
  const transactionStatsQuery = fetchTransactionStats
    ? `${PATHS.STATS_TRANSACTION}?fetchTransactionStats=true`
    : null
  const coinStatsQuery = last24HrsCoinReport ? `${PATHS.STATS_COIN}?last24HrsCoinReport=true` : null

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
    totalNewTransactionFee: number
    totalNewBurntFees: number
  }>(coinStatsQuery, fetcher, swrOptions)

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
    'totalNewTransactionFee' in coinStatsResponse.data
      ? Number(coinStatsResponse.data.totalNewTransactionFee)
      : 0
  const totalNewBurntFee =
    typeof coinStatsResponse.data === 'object' &&
    coinStatsResponse.data != null &&
    'totalNewBurntFee' in coinStatsResponse.data
      ? Number(coinStatsResponse.data.totalNewBurntFee)
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
  }
}
