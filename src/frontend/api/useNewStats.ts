import useSWR from 'swr'

import { fetcher } from './fetcher'

import { PATHS } from './paths'

type StatsResult = {
  totalAccounts: number
  totalNewAccounts: number // accounts created in the last 24 hours
  totalTransactions: number
  totalNewTransactions: number // transactions created in the last 24 hours
  totalAccountsChange: number // percentage change in total accounts (7-day comparison)
  totalNewAccountsChange: number // percentage change in new accounts (day-to-day comparison)
  totalTransactionsChange: number // percentage change in total transactions (7-day comparison)
  totalNewTransactionsChange: number // percentage change in new transactions (day-to-day comparison)
  last24HrsSupplyChange: {
    totalTransactionFee: number
    totalBurntFees: number
  }
}

export const useNewStats = (query: {
  fetchAccountStats?: boolean
  fetchTransactionStats?: boolean
  last24hoursCoinReport?: boolean
  refreshEnabled?: boolean
}): StatsResult => {
  const { fetchAccountStats, fetchTransactionStats, last24hoursCoinReport, refreshEnabled } = query

  // set query paths to `null` if we shouldn't fetch them
  const accountStatsQuery = fetchAccountStats ? `${PATHS.STATS_ACCOUNT}?fetchAccountStats=true` : null
  const transactionStatsQuery = fetchTransactionStats
    ? `${PATHS.STATS_TRANSACTION}?fetchTransactionStats=true`
    : null
  const coinStatsQuery = last24hoursCoinReport ? `${PATHS.STATS_COIN}?last24hoursCoinReport=true` : null

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
    totalTransactions: number
    totalNewTransactions: number
    totalTransactionsChange: number
    totalNewTransactionsChange: number
  }>(transactionStatsQuery, fetcher, swrOptions)
  const coinStatsResponse = useSWR<{
    last24HrsSupplyChange: { totalTransactionFee: number; totalBurntFees: number }
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
  const totalTransactions =
    typeof transactionStatsResponse.data === 'object' &&
    transactionStatsResponse.data != null &&
    'totalTransactions' in transactionStatsResponse.data
      ? Number(transactionStatsResponse.data.totalTransactions)
      : 0
  const totalNewTransactions =
    typeof transactionStatsResponse.data === 'object' &&
    transactionStatsResponse.data != null &&
    'totalNewTransactions' in transactionStatsResponse.data
      ? Number(transactionStatsResponse.data.totalNewTransactions)
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
  const totalTransactionsChange =
    typeof transactionStatsResponse.data === 'object' &&
    transactionStatsResponse.data != null &&
    'totalTransactionsChange' in transactionStatsResponse.data
      ? Number(transactionStatsResponse.data.totalTransactionsChange)
      : 0
  const totalNewTransactionsChange =
    typeof transactionStatsResponse.data === 'object' &&
    transactionStatsResponse.data != null &&
    'totalNewTransactionsChange' in transactionStatsResponse.data
      ? Number(transactionStatsResponse.data.totalNewTransactionsChange)
      : 0
  const last24HrsSupplyChange =
    typeof coinStatsResponse.data === 'object' &&
    coinStatsResponse.data != null &&
    'last24HrsSupplyChange' in coinStatsResponse.data
      ? coinStatsResponse.data.last24HrsSupplyChange
      : { totalTransactionFee: 0, totalBurntFees: 0 }

  return {
    totalAccounts,
    totalNewAccounts,
    totalTransactions,
    totalNewTransactions,
    totalAccountsChange,
    totalNewAccountsChange,
    totalTransactionsChange,
    totalNewTransactionsChange,
    last24HrsSupplyChange,
  }
}
