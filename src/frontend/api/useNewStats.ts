import useSWR from 'swr'

import { fetcher } from './fetcher'

import { PATHS } from './paths'
import { BaseDailyNetworkStats } from '../../stats/dailyNetworkStats'
import { DailyCoinStats } from '../../stats/dailyCoinStats'
import { AccountStatsSummary } from '../../stats/dailyAccountStats'

type StatsResult = {
  totalAddresses: number
  newAddresses: number // addresses created in the last 24 hours
  totalUserAccounts: number // cumulative user accounts created
  newUserAccounts: number // user accounts created in the last 24 hours
  totalUserTxs: number
  newUserTxs: number // transactions created in the last 24 hours
  totalAccountsChange: number // percentage change: today's new addresses / yesterday's cumulative total * 100
  newAddressesChange: number // percentage change in new addresses (day-to-day comparison)
  totalUserAccountsChange: number // percentage change: today's new user accounts / yesterday's cumulative total * 100
  newUserAccountsChange: number
  totalUserTxsChange: number // percentage change in total transactions (7-day comparison)
  newUserTxsChange: number // percentage change in new transactions (day-to-day comparison)
  newTransactionFee: number // total transaction fee in the last 24 hours
  newBurntFee: number // total burnt fee in the last 24 hours
  newNetworkExpense: number // total network expense ( minted coin + realized node rewards )  in the last 24 hours
  newSupply: number // total LIB supply created in the last 24 hours
  totalSupply: number // total LIB supply
  totalStaked: number // total staked amount
  stabilityFactorStr: string // LIB Pric in USD
  transactionFeeUsdStr: string // transaction fee in USD
  nodeRewardAmountUsdStr: string // node reward amount in USD per hour
  stakeRequiredUsdStr: string // stake required amount in USD
  activeNodes: number // number of active nodes count in the last 24 hours
  standbyNodes: number // number of standby nodes count in the last 24 hours
  activeAccounts: number // user accounts that made fee paying transactions in the last 24 hours
  activeAccountsChange: number // percentage change in active accounts (day-to-day comparison)
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
  const accountStatsResponse = useSWR<AccountStatsSummary>(accountStatsQuery, fetcher, swrOptions)

  const transactionStatsResponse = useSWR<{
    totalUserTxs: number
    totalNewUserTxs: number
    totalUserTxsChange: number
    totalNewUserTxsChange: number
  }>(transactionStatsQuery, fetcher, swrOptions)
  const coinStatsResponse = useSWR<{
    success: boolean
    dailyCoinStats: DailyCoinStats[]
    totalSupply: number
    totalStaked: number
  }>(coinStatsQuery, fetcher, swrOptions)

  const networkStatsResponse = useSWR<BaseDailyNetworkStats>(networkStatsQuery, fetcher, swrOptions)

  // get values
  const totalAddresses =
    typeof accountStatsResponse.data === 'object' &&
    accountStatsResponse.data != null &&
    'totalAccounts' in accountStatsResponse.data
      ? accountStatsResponse.data.totalAccounts
      : 0
  const newAddresses =
    typeof accountStatsResponse.data === 'object' &&
    accountStatsResponse.data != null &&
    'newAccounts' in accountStatsResponse.data
      ? accountStatsResponse.data.newAccounts
      : 0
  const totalUserAccounts =
    typeof accountStatsResponse.data === 'object' &&
    accountStatsResponse.data != null &&
    'totalUserAccounts' in accountStatsResponse.data
      ? accountStatsResponse.data.totalUserAccounts
      : 0
  const newUserAccounts =
    typeof accountStatsResponse.data === 'object' &&
    accountStatsResponse.data != null &&
    'newUserAccounts' in accountStatsResponse.data
      ? accountStatsResponse.data.newUserAccounts
      : 0

  const totalUserTxs =
    typeof transactionStatsResponse.data === 'object' &&
    transactionStatsResponse.data != null &&
    'totalUserTxs' in transactionStatsResponse.data
      ? transactionStatsResponse.data.totalUserTxs
      : 0
  const newUserTxs =
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
  const newAddressesChange =
    typeof accountStatsResponse.data === 'object' &&
    accountStatsResponse.data != null &&
    'newAccountsChange' in accountStatsResponse.data
      ? accountStatsResponse.data.newAccountsChange
      : 0
  const totalUserAccountsChange =
    typeof accountStatsResponse.data === 'object' &&
    accountStatsResponse.data != null &&
    'totalUserAccountsChange' in accountStatsResponse.data
      ? accountStatsResponse.data.totalUserAccountsChange
      : 0
  const newUserAccountsChange =
    typeof accountStatsResponse.data === 'object' &&
    accountStatsResponse.data != null &&
    'newUserAccountsChange' in accountStatsResponse.data
      ? accountStatsResponse.data.newUserAccountsChange
      : 0
  const totalUserTxsChange =
    typeof transactionStatsResponse.data === 'object' &&
    transactionStatsResponse.data != null &&
    'totalUserTxsChange' in transactionStatsResponse.data
      ? transactionStatsResponse.data.totalUserTxsChange
      : 0
  const newUserTxsChange =
    typeof transactionStatsResponse.data === 'object' &&
    transactionStatsResponse.data != null &&
    'totalNewUserTxsChange' in transactionStatsResponse.data
      ? transactionStatsResponse.data.totalNewUserTxsChange
      : 0
  const newTransactionFee =
    typeof coinStatsResponse.data === 'object' &&
    coinStatsResponse.data != null &&
    'dailyCoinStats' in coinStatsResponse.data &&
    Array.isArray(coinStatsResponse.data.dailyCoinStats) &&
    coinStatsResponse.data.dailyCoinStats.length > 0
      ? coinStatsResponse.data.dailyCoinStats[0].transactionFee
      : 0
  const newBurntFee =
    typeof coinStatsResponse.data === 'object' &&
    coinStatsResponse.data != null &&
    'dailyCoinStats' in coinStatsResponse.data &&
    Array.isArray(coinStatsResponse.data.dailyCoinStats) &&
    coinStatsResponse.data.dailyCoinStats.length > 0
      ? coinStatsResponse.data.dailyCoinStats[0].transactionFee +
        coinStatsResponse.data.dailyCoinStats[0].networkFee +
        coinStatsResponse.data.dailyCoinStats[0].penaltyAmount
      : 0

  const newNetworkExpense =
    typeof coinStatsResponse.data === 'object' &&
    coinStatsResponse.data != null &&
    'dailyCoinStats' in coinStatsResponse.data &&
    Array.isArray(coinStatsResponse.data.dailyCoinStats) &&
    coinStatsResponse.data.dailyCoinStats.length > 0
      ? coinStatsResponse.data.dailyCoinStats[0].mintedCoin +
        coinStatsResponse.data.dailyCoinStats[0].rewardAmountRealized
      : 0

  const newSupply =
    typeof coinStatsResponse.data === 'object' &&
    coinStatsResponse.data != null &&
    'dailyCoinStats' in coinStatsResponse.data &&
    Array.isArray(coinStatsResponse.data.dailyCoinStats) &&
    coinStatsResponse.data.dailyCoinStats.length > 0
      ? coinStatsResponse.data.dailyCoinStats[0].mintedCoin +
        coinStatsResponse.data.dailyCoinStats[0].rewardAmountRealized -
        coinStatsResponse.data.dailyCoinStats[0].transactionFee -
        coinStatsResponse.data.dailyCoinStats[0].networkFee -
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

  const activeAccounts =
    typeof accountStatsResponse.data === 'object' &&
    accountStatsResponse.data != null &&
    'activeAccounts' in accountStatsResponse.data
      ? accountStatsResponse.data.activeAccounts
      : 0

  const activeAccountsChange =
    typeof accountStatsResponse.data === 'object' &&
    accountStatsResponse.data != null &&
    'activeAccountsChange' in accountStatsResponse.data
      ? accountStatsResponse.data.activeAccountsChange
      : 0

  return {
    totalAddresses,
    newAddresses,
    totalUserAccounts,
    newUserAccounts,
    totalUserTxs,
    newUserTxs,
    totalAccountsChange,
    newAddressesChange,
    totalUserAccountsChange,
    newUserAccountsChange,
    totalUserTxsChange,
    newUserTxsChange,
    newTransactionFee,
    newBurntFee,
    newNetworkExpense,
    newSupply,
    totalSupply,
    totalStaked,
    stabilityFactorStr,
    transactionFeeUsdStr,
    nodeRewardAmountUsdStr,
    stakeRequiredUsdStr,
    activeNodes,
    standbyNodes,
    activeAccounts,
    activeAccountsChange,
  }
}
