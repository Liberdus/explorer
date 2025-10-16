import useSWR from 'swr'

import { fetcher } from './fetcher'

import { PATHS } from './paths'
import { DailyNetworkStatsSummary } from '../../stats/dailyNetworkStats'
import { DailyCoinStatsSummary } from '../../stats/dailyCoinStats'
import { DailyAccountStatsSummary } from '../../stats/dailyAccountStats'

type StatsResult = Omit<DailyAccountStatsSummary, 'dateStartTime'> &
  Omit<DailyCoinStatsSummary, EXCLUDED_COIN_STATS_FIELDS> &
  Omit<DailyNetworkStatsSummary, EXCLUDED_NETWORK_STATS_FIELDS> & {
    totalUserTxs: number
    newUserTxs: number // transactions created in the last 24 hours
    totalUserTxsChange: number // percentage change in total transactions (7-day comparison)
    newUserTxsChange: number // percentage change in new transactions (day-to-day comparison)
  }

type EXCLUDED_COIN_STATS_FIELDS =
  | 'dateStartTime'
  | 'mintedCoin'
  | 'networkFee'
  | 'stakeAmount'
  | 'unStakeAmount'
  | 'rewardAmountRealized'
  | 'rewardAmountUnrealized'
  | 'penaltyAmount'

type EXCLUDED_NETWORK_STATS_FIELDS =
  | 'dateStartTime'
  | 'nodePenaltyUsdStr'
  | 'defaultTollUsdStr'
  | 'minTollUsdStr'
  | 'nodePenaltyUsdStrChange'
  | 'defaultTollUsdStrChange'
  | 'minTollUsdStrChange'
  | 'standbyNodesChange'

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
  const coinStatsQuery = fetchCoinStats ? `${PATHS.STATS_COIN}?fetchCoinStats=true` : null
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

  const coinStatsResponse = useSWR<DailyCoinStatsSummary>(coinStatsQuery, fetcher, swrOptions)

  const networkStatsResponse = useSWR<DailyNetworkStatsSummary>(networkStatsQuery, fetcher, swrOptions)

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

  const activeAccounts =
    typeof accountStatsResponse.data === 'object' &&
    accountStatsResponse.data != null &&
    'activeAccounts' in accountStatsResponse.data
      ? accountStatsResponse.data.activeAccounts
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
  const activeAccountsChange =
    typeof accountStatsResponse.data === 'object' &&
    accountStatsResponse.data != null &&
    'activeAccountsChange' in accountStatsResponse.data
      ? accountStatsResponse.data.activeAccountsChange
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
  const transactionFee =
    typeof coinStatsResponse.data === 'object' &&
    coinStatsResponse.data != null &&
    'transactionFee' in coinStatsResponse.data
      ? coinStatsResponse.data.transactionFee
      : 0
  const newBurntFee =
    typeof coinStatsResponse.data === 'object' &&
    coinStatsResponse.data != null &&
    'newBurntFee' in coinStatsResponse.data
      ? coinStatsResponse.data.newBurntFee
      : 0

  const newNetworkExpense =
    typeof coinStatsResponse.data === 'object' &&
    coinStatsResponse.data != null &&
    'newNetworkExpense' in coinStatsResponse.data
      ? coinStatsResponse.data.newNetworkExpense
      : 0

  const newSupply =
    typeof coinStatsResponse.data === 'object' &&
    coinStatsResponse.data != null &&
    'newSupply' in coinStatsResponse.data
      ? coinStatsResponse.data.newSupply
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

  const stabilityFactorStrChange =
    typeof networkStatsResponse.data === 'object' &&
    networkStatsResponse.data != null &&
    'stabilityFactorStrChange' in networkStatsResponse.data
      ? networkStatsResponse.data.stabilityFactorStrChange
      : 0

  const transactionFeeUsdStr =
    typeof networkStatsResponse.data === 'object' &&
    networkStatsResponse.data != null &&
    'transactionFeeUsdStr' in networkStatsResponse.data
      ? networkStatsResponse.data.transactionFeeUsdStr
      : '0'

  const transactionFeeUsdStrChange =
    typeof networkStatsResponse.data === 'object' &&
    networkStatsResponse.data != null &&
    'transactionFeeUsdStrChange' in networkStatsResponse.data
      ? networkStatsResponse.data.transactionFeeUsdStrChange
      : 0

  const nodeRewardAmountUsdStr =
    typeof networkStatsResponse.data === 'object' &&
    networkStatsResponse.data != null &&
    'nodeRewardAmountUsdStr' in networkStatsResponse.data
      ? networkStatsResponse.data.nodeRewardAmountUsdStr
      : '0'

  const nodeRewardAmountUsdStrChange =
    typeof networkStatsResponse.data === 'object' &&
    networkStatsResponse.data != null &&
    'nodeRewardAmountUsdStrChange' in networkStatsResponse.data
      ? networkStatsResponse.data.nodeRewardAmountUsdStrChange
      : 0

  const stakeRequiredUsdStr =
    typeof networkStatsResponse.data === 'object' &&
    networkStatsResponse.data != null &&
    'stakeRequiredUsdStr' in networkStatsResponse.data
      ? networkStatsResponse.data.stakeRequiredUsdStr
      : '0'
  const stakeRequiredUsdStrChange =
    typeof networkStatsResponse.data === 'object' &&
    networkStatsResponse.data != null &&
    'stakeRequiredUsdStrChange' in networkStatsResponse.data
      ? networkStatsResponse.data.stakeRequiredUsdStrChange
      : 0

  const activeNodes =
    typeof networkStatsResponse.data === 'object' &&
    networkStatsResponse.data != null &&
    'activeNodes' in networkStatsResponse.data
      ? networkStatsResponse.data.activeNodes
      : 0
  const activeNodesChange =
    typeof networkStatsResponse.data === 'object' &&
    networkStatsResponse.data != null &&
    'activeNodesChange' in networkStatsResponse.data
      ? networkStatsResponse.data.activeNodesChange
      : 0

  const standbyNodes =
    typeof networkStatsResponse.data === 'object' &&
    networkStatsResponse.data != null &&
    'standbyNodes' in networkStatsResponse.data
      ? networkStatsResponse.data.standbyNodes
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
    transactionFee,
    newBurntFee,
    newNetworkExpense,
    newSupply,
    totalSupply,
    totalStake,

    stabilityFactorStr,
    nodeRewardAmountUsdStr,
    stakeRequiredUsdStr,
    activeNodes,
    transactionFeeUsdStr,
    stabilityFactorStrChange,
    transactionFeeUsdStrChange,
    nodeRewardAmountUsdStrChange,
    stakeRequiredUsdStrChange,
    activeNodesChange,
    standbyNodes,
    activeAccounts,
    activeAccountsChange,
  }
}
