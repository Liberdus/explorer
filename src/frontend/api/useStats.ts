import useSWR from 'swr'

import { fetcher } from './fetcher'

import { PATHS } from './paths'
import { ValidatorStats } from '../../stats/validatorStats'
import { TransactionStats } from '../../stats/transactionStats'
import { DailyAccountStats } from '../../stats/dailyAccountStats'
import { DailyCoinStats, DailyCoinStatsWithPrice } from '../../stats/dailyCoinStats'
import { DailyNetworkStats } from '../../stats/dailyNetworkStats'
import { DailyTransactionStats } from '../../stats/dailyTransactionStats'

type StatsResult = {
  validatorStats: ValidatorStats[] | number[][]
  transactionStats: TransactionStats[] | DailyTransactionStats[] | number[][]
  dailyAccountStats: DailyAccountStats[] | number[][]
  dailyCoinStats: DailyCoinStats[] | number[][]
  dailyNetworkStats: DailyNetworkStats[] | number[][]
  totalLIB: number
  totalStakedLIB: number
  loading: boolean
}

export const useStats = (query: {
  validatorStatsCount?: number
  transactionStatsCount?: number
  last14DaysTxsReport?: boolean
  allDailyTxsReport?: boolean
  allDailyAccountReport?: boolean
  allDailyCoinReport?: boolean
  allDailyNetworkReport?: boolean
  fetchCoinStats?: boolean
  transactionResponseType?: string | undefined
  validatorResponseType?: string | undefined
  accountResponseType?: string | undefined
  coinResponseType?: string | undefined
  networkResponseType?: string | undefined
  refreshEnabled?: boolean
}): StatsResult => {
  const {
    validatorStatsCount,
    transactionStatsCount,
    last14DaysTxsReport,
    allDailyTxsReport,
    allDailyAccountReport,
    allDailyCoinReport,
    allDailyNetworkReport,
    fetchCoinStats,
    transactionResponseType,
    validatorResponseType,
    accountResponseType,
    coinResponseType,
    networkResponseType,
    refreshEnabled,
  } = query

  // set query paths to `null` if we shouldn't fetch them
  const validatorStatsQuery = validatorStatsCount
    ? `${PATHS.STATS_VALIDATOR}?count=${validatorStatsCount}&responseType=${validatorResponseType}`
    : null
  const transactionStatsQuery = transactionStatsCount
    ? `${PATHS.STATS_TRANSACTION}?count=${transactionStatsCount}&responseType=${transactionResponseType}`
    : last14DaysTxsReport
    ? `${PATHS.STATS_TRANSACTION}?last14DaysTxsReport=true&responseType=${transactionResponseType}`
    : allDailyTxsReport
    ? `${PATHS.STATS_TRANSACTION}?allDailyTxsReport=true&responseType=${transactionResponseType}`
    : null
  const accountStatsQuery = allDailyAccountReport
    ? `${PATHS.STATS_ACCOUNT}?allDailyAccountReport=true&responseType=${accountResponseType}`
    : null
  const dailyCoinStatsQuery = allDailyCoinReport
    ? `${PATHS.STATS_COIN}?allDailyCoinReport=true&responseType=${coinResponseType}`
    : null
  const dailyNetworkStatsQuery = allDailyNetworkReport
    ? `${PATHS.STATS_NETWORK}?allDailyNetworkReport=true&responseType=${networkResponseType}`
    : null
  const coinStatsQuery = fetchCoinStats ? `${PATHS.STATS_COIN}` : null

  const swrOptions = {
    refreshInterval: !refreshEnabled ? 0 : undefined,
    revalidateOnFocus: refreshEnabled,
    revalidateOnReconnect: refreshEnabled,
  }

  // get responses
  const validatorStatsResponse = useSWR<{ validatorStats: ValidatorStats[] }>(
    validatorStatsQuery,
    fetcher,
    swrOptions
  )
  const transactionStatsResponse = useSWR<{ transactionStats: TransactionStats[] }>(
    transactionStatsQuery,
    fetcher,
    swrOptions
  )
  const accountStatsResponse = useSWR<{ dailyAccountStats: DailyAccountStats[] }>(
    accountStatsQuery,
    fetcher,
    swrOptions
  )
  const dailyCoinStatsResponse = useSWR<{ dailyCoinStats: DailyCoinStats[] }>(
    dailyCoinStatsQuery,
    fetcher,
    swrOptions
  )
  const dailyNetworkStatsResponse = useSWR<{ dailyNetworkStats: DailyNetworkStats[] }>(
    dailyNetworkStatsQuery,
    fetcher,
    swrOptions
  )
  const coinStatsResponse = useSWR<{ totalSupply: number; totalStaked: number }>(
    coinStatsQuery,
    fetcher,
    swrOptions
  )

  // get values
  const validatorStats =
    typeof validatorStatsResponse.data === 'object' &&
    validatorStatsResponse.data != null &&
    'validatorStats' in validatorStatsResponse.data
      ? validatorStatsResponse.data.validatorStats
      : []
  const transactionStats =
    typeof transactionStatsResponse.data === 'object' &&
    transactionStatsResponse.data != null &&
    'transactionStats' in transactionStatsResponse.data
      ? transactionStatsResponse.data.transactionStats
      : []
  const dailyAccountStats =
    typeof accountStatsResponse.data === 'object' &&
    accountStatsResponse.data != null &&
    'dailyAccountStats' in accountStatsResponse.data
      ? accountStatsResponse.data.dailyAccountStats
      : []
  const dailyCoinStats =
    typeof dailyCoinStatsResponse.data === 'object' &&
    dailyCoinStatsResponse.data != null &&
    'dailyCoinStats' in dailyCoinStatsResponse.data
      ? dailyCoinStatsResponse.data.dailyCoinStats
      : []
  const dailyNetworkStats =
    typeof dailyNetworkStatsResponse.data === 'object' &&
    dailyNetworkStatsResponse.data != null &&
    'dailyNetworkStats' in dailyNetworkStatsResponse.data
      ? dailyNetworkStatsResponse.data.dailyNetworkStats
      : []
  const totalLIB =
    typeof coinStatsResponse.data === 'object' &&
    coinStatsResponse.data != null &&
    'totalSupply' in coinStatsResponse.data
      ? Number(coinStatsResponse.data.totalSupply)
      : 0
  const totalStakedLIB =
    typeof coinStatsResponse.data === 'object' &&
    coinStatsResponse.data != null &&
    'totalStaked' in coinStatsResponse.data
      ? Number(coinStatsResponse.data.totalStaked)
      : 0

  return {
    validatorStats,
    transactionStats,
    dailyAccountStats,
    dailyCoinStats,
    dailyNetworkStats,
    totalLIB,
    totalStakedLIB,
    loading:
      validatorStatsResponse?.isValidating ||
      transactionStatsResponse?.isValidating ||
      accountStatsResponse?.isValidating ||
      dailyCoinStatsResponse?.isValidating ||
      dailyNetworkStatsResponse?.isValidating ||
      coinStatsResponse?.isValidating,
  }
}
