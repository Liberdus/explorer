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

  return {
    newAccounts: accountStatsResponse.data?.newAccounts || 0,
    activeAccounts: accountStatsResponse.data?.activeAccounts || 0,
    newUserAccounts: accountStatsResponse.data?.newUserAccounts || 0,
    totalAccounts: accountStatsResponse.data?.totalAccounts || 0,
    totalUserAccounts: accountStatsResponse.data?.totalUserAccounts || 0,
    newAccountsChange: accountStatsResponse.data?.newAccountsChange || 0,
    newUserAccountsChange: accountStatsResponse.data?.newUserAccountsChange || 0,
    activeAccountsChange: accountStatsResponse.data?.activeAccountsChange || 0,
    totalAccountsChange: accountStatsResponse.data?.totalAccountsChange || 0,
    totalUserAccountsChange: accountStatsResponse.data?.totalUserAccountsChange || 0,
    totalUserTxs: transactionStatsResponse.data?.totalUserTxs || 0,
    newUserTxs: transactionStatsResponse.data?.newUserTxs || 0,
    totalUserTxsChange: transactionStatsResponse.data?.totalUserTxsChange || 0,
    newUserTxsChange: transactionStatsResponse.data?.newUserTxsChange || 0,
    transactionFee: coinStatsResponse.data?.transactionFee || 0,
    newBurntFee: coinStatsResponse.data?.newBurntFee || 0,
    newNetworkExpense: coinStatsResponse.data?.newNetworkExpense || 0,
    newSupply: coinStatsResponse.data?.newSupply || 0,
    totalSupply: coinStatsResponse.data?.totalSupply || 0,
    totalStake: coinStatsResponse.data?.totalStake || 0,
    totalSupplyChange: coinStatsResponse.data?.totalSupplyChange || 0,
    totalStakeChange: coinStatsResponse.data?.totalStakeChange || 0,
    transactionFeeChange: coinStatsResponse.data?.transactionFeeChange || 0,
    newBurntFeeChange: coinStatsResponse.data?.newBurntFeeChange || 0,
    newNetworkExpenseChange: coinStatsResponse.data?.newNetworkExpenseChange || 0,
    newSupplyChange: coinStatsResponse.data?.newSupplyChange || 0,
    stabilityFactorStr: networkStatsResponse.data?.stabilityFactorStr || '0',
    nodeRewardAmountUsdStr: networkStatsResponse.data?.nodeRewardAmountUsdStr || '0',
    stakeRequiredUsdStr: networkStatsResponse.data?.stakeRequiredUsdStr || '0',
    activeNodes: networkStatsResponse.data?.activeNodes || 0,
    transactionFeeUsdStr: networkStatsResponse.data?.transactionFeeUsdStr || '0',
    stabilityFactorStrChange: networkStatsResponse.data?.stabilityFactorStrChange || 0,
    transactionFeeUsdStrChange: networkStatsResponse.data?.transactionFeeUsdStrChange || 0,
    nodeRewardAmountUsdStrChange: networkStatsResponse.data?.nodeRewardAmountUsdStrChange || 0,
    stakeRequiredUsdStrChange: networkStatsResponse.data?.stakeRequiredUsdStrChange || 0,
    activeNodesChange: networkStatsResponse.data?.activeNodesChange || 0,
    standbyNodes: networkStatsResponse.data?.standbyNodes || 0,
  }
}
