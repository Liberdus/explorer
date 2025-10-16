import useSWR from 'swr'

import { fetcher } from './fetcher'

import { PATHS } from './paths'
import { BaseDailyNetworkStats } from '../../stats/dailyNetworkStats'
import { DailyCoinStatsWithSummary } from '../../stats/dailyCoinStats'
import { DailyAccountStatsSummary } from '../../stats/dailyAccountStats'

type StatsResult = DailyAccountStatsSummary &
  DailyCoinStatsWithSummary &
  BaseDailyNetworkStats & {
    totalUserTxs: number
    newUserTxs: number // transactions created in the last 24 hours
    totalUserTxsChange: number // percentage change in total transactions (7-day comparison)
    newUserTxsChange: number // percentage change in new transactions (day-to-day comparison)
    newTransactionFee: number // total transaction fee in the last 24 hours
    newBurntFee: number // total burnt fee in the last 24 hours
    newNetworkExpense: number // total network expense ( minted coin + realized node rewards )  in the last 24 hours
    newSupply: number // total LIB supply created in the last 24 hours
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
  const accountStatsResponse = useSWR<DailyAccountStatsSummary>(accountStatsQuery, fetcher, swrOptions)

  const transactionStatsResponse = useSWR<{
    totalUserTxs: number
    newUserTxs: number
    totalUserTxsChange: number
    newUserTxsChange: number
  }>(transactionStatsQuery, fetcher, swrOptions)

  const coinStatsResponse = useSWR<DailyCoinStatsWithSummary>(coinStatsQuery, fetcher, swrOptions)

  const networkStatsResponse = useSWR<BaseDailyNetworkStats>(networkStatsQuery, fetcher, swrOptions)

  // get values
  const totalAccounts =
    typeof accountStatsResponse.data === 'object' &&
    accountStatsResponse.data != null &&
    'totalAccounts' in accountStatsResponse.data
      ? accountStatsResponse.data.totalAccounts
      : 0
  const newAccounts =
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
    'newUserTxs' in transactionStatsResponse.data
      ? transactionStatsResponse.data.newUserTxs
      : 0
  const totalAccountsChange =
    typeof accountStatsResponse.data === 'object' &&
    accountStatsResponse.data != null &&
    'totalAccountsChange' in accountStatsResponse.data
      ? accountStatsResponse.data.totalAccountsChange
      : 0
  const newAccountsChange =
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
    'newUserTxsChange' in transactionStatsResponse.data
      ? transactionStatsResponse.data.newUserTxsChange
      : 0
  const newTransactionFee =
    typeof coinStatsResponse.data === 'object' &&
    coinStatsResponse.data != null &&
    'transactionFee' in coinStatsResponse.data
      ? coinStatsResponse.data.transactionFee
      : 0
  const newBurntFee =
    typeof coinStatsResponse.data === 'object' &&
    coinStatsResponse.data != null &&
    'transactionFee' in coinStatsResponse.data
      ? coinStatsResponse.data.transactionFee +
        coinStatsResponse.data.networkFee +
        coinStatsResponse.data.penaltyAmount
      : 0

  const newNetworkExpense =
    typeof coinStatsResponse.data === 'object' &&
    coinStatsResponse.data != null &&
    'mintedCoin' in coinStatsResponse.data
      ? coinStatsResponse.data.mintedCoin + coinStatsResponse.data.rewardAmountRealized
      : 0

  const newSupply =
    typeof coinStatsResponse.data === 'object' &&
    coinStatsResponse.data != null &&
    'mintedCoin' in coinStatsResponse.data
      ? coinStatsResponse.data.mintedCoin +
        coinStatsResponse.data.rewardAmountRealized -
        coinStatsResponse.data.transactionFee -
        coinStatsResponse.data.networkFee -
        coinStatsResponse.data.penaltyAmount
      : 0

  const totalSupply =
    typeof coinStatsResponse.data === 'object' &&
    coinStatsResponse.data != null &&
    'totalSupply' in coinStatsResponse.data
      ? coinStatsResponse.data.totalSupply
      : 0

  const totalStake =
    typeof coinStatsResponse.data === 'object' &&
    coinStatsResponse.data != null &&
    'totalStaked' in coinStatsResponse.data
      ? coinStatsResponse.data.totalStake
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
    totalAccounts,
    newAccounts,
    totalUserAccounts,
    newUserAccounts,
    totalUserTxs,
    newUserTxs,
    totalAccountsChange,
    newAccountsChange,
    totalUserAccountsChange,
    newUserAccountsChange,
    totalUserTxsChange,
    newUserTxsChange,
    newTransactionFee,
    newBurntFee,
    newNetworkExpense,
    newSupply,
    totalSupply,
    totalStake,
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
