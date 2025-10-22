import { config } from '../../config'
import { DailyAccountStats } from '../../stats/dailyAccountStats'
import { DailyCoinStats, DailyCoinStatsWithPrice } from '../../stats/dailyCoinStats'
import { DailyNetworkStats } from '../../stats/dailyNetworkStats'
import { DailyTransactionStats } from '../../stats/dailyTransactionStats'
import { TransactionStats } from '../../stats/transactionStats'
import { ValidatorStats } from '../../stats/validatorStats'

export interface DataPoint {
  x: number
  y: number
  cycle?: number
  // Additional properties for tooltip data
  newAddressChartData?: NewAddressChartData
  marketCapChartData?: MarketCapChartData
  supplyGrowthChartData?: SupplyGrowthChartData
  dailyTxsChartData?: DailyTxsChartData
  avgTxFeeChartData?: AvgTxFeeChartData
  burntSupplyChartData?: BurntSupplyChartData
  accountChartData?: AccountChartData
  distributedSupplyChartData?: DistributedSupplyChartData
  networkStakeChartData?: NetworkStakeChartData
  activeNodesChartData?: ActiveNodesChartData
}

export interface NewAddressChartData {
  dailyIncrease: number
}

export interface AccountChartData {
  newUsers: number
}

export interface MarketCapChartData {
  priceUSD: number
}

export interface SupplyGrowthChartData {
  mintedCoin: number
  rewardAmountRealized: number
  transactionFee: number
  networkFee: number
  penaltyAmount: number
  totalSupplyChange: number
}

export interface DailyTxsChartData {
  transferTxs: number
  messageTxs: number
  stakingTxs: number
  otherTxs: number
}

export interface AvgTxFeeChartData {
  priceUSD: number
  totalTxFee?: number
  totalUserTxs?: number
}

export interface BurntSupplyChartData {
  transactionFee: number
  networkFee: number
  penaltyAmount: number
}

export interface DistributedSupplyChartData {
  mintedCoin: number
  rewardAmountRealized: number
}

export interface NetworkStakeChartData {
  stakeAmount: number
  unstakeAmount: number
  penaltyAmount: number
}

export interface ActiveNodesChartData {
  standbyNodes: number
}

export interface HighLightPoint {
  timestamp: number
  value: number
}

export interface HighLight {
  highest: HighLightPoint | null
  lowest: HighLightPoint | null
  current?: number | null
}

export interface SeriesData {
  name: string
  data: DataPoint[]
  zIndex: number
  tooltip?: string
  visible?: boolean
}

export function convertTransactionStatsToSeriesData(
  transactionStats: TransactionStats[] | number[][],
  isDeveloperMode: boolean,
  transactionResponseType?: string
): SeriesData[] {
  let seriesData: SeriesData[] = [
    { name: 'Total Txs', data: [], zIndex: 10, tooltip: 'Count of all transactions', visible: true },
    {
      name: 'Init Network',
      data: [],
      zIndex: 9,
      tooltip: 'Count of all init network transactions',
      visible: false,
    },
    {
      name: 'Network Windows',
      data: [],
      zIndex: 8,
      tooltip: 'Count of all network windows transactions',
      visible: false,
    },
    { name: 'Snapshot', data: [], zIndex: 7, tooltip: 'Count of all snapshot transactions', visible: false },
    { name: 'Email', data: [], zIndex: 6, visible: false },
    { name: 'Gossip Email Hash', data: [], zIndex: 5, visible: false },
    { name: 'Verify', data: [], zIndex: 4, visible: false },
    { name: 'Register', data: [], zIndex: 3, visible: true },
    { name: 'Create', data: [], zIndex: 2, visible: false },
    { name: 'Transfer', data: [], zIndex: 1, visible: true },
    { name: 'Distribute', data: [], zIndex: 0, visible: false },
    { name: 'Message', data: [], zIndex: -1, visible: true },
    { name: 'Toll', data: [], zIndex: -2, visible: false },
    { name: 'Friend', data: [], zIndex: -3, visible: false },
    { name: 'Remove Friend', data: [], zIndex: -4, visible: false },
    { name: 'Stake', data: [], zIndex: -5, visible: false },
    { name: 'Unstake', data: [], zIndex: -6, visible: false },
    { name: 'Unstake Request', data: [], zIndex: -7, visible: false },
    { name: 'Node Reward', data: [], zIndex: -8, visible: false },
    { name: 'Snapshot Claim', data: [], zIndex: -9, visible: false },
    { name: 'Issue', data: [], zIndex: -10, visible: false },
    { name: 'Proposal', data: [], zIndex: -11, visible: false },
    { name: 'Vote', data: [], zIndex: -12, visible: false },
    { name: 'Tally', data: [], zIndex: -13, visible: false },
    { name: 'Apply Tally', data: [], zIndex: -14, visible: false },
    { name: 'Parameters', data: [], zIndex: -15, visible: false },
    { name: 'Apply Parameters', data: [], zIndex: -16, visible: false },
    { name: 'Dev Issue', data: [], zIndex: -17, visible: false },
    { name: 'Dev Proposal', data: [], zIndex: -18, visible: false },
    { name: 'Dev Vote', data: [], zIndex: -19, visible: false },
    { name: 'Dev Tally', data: [], zIndex: -20, visible: false },
    { name: 'Apply Dev Tally', data: [], zIndex: -21, visible: false },
    { name: 'Dev Parameters', data: [], zIndex: -22, visible: false },
    { name: 'Apply Dev Parameters', data: [], zIndex: -23, visible: false },
    { name: 'Developer Payment', data: [], zIndex: -24, visible: false },
    { name: 'Apply Developer Payment', data: [], zIndex: -25, visible: false },
    { name: 'Change Config', data: [], zIndex: -26, visible: false },
    { name: 'Apply Change Config', data: [], zIndex: -27, visible: false },
    { name: 'Change Network Param', data: [], zIndex: -28, visible: false },
    { name: 'Apply Change Network Param', data: [], zIndex: -29, visible: false },
    { name: 'Deposit Stake', data: [], zIndex: -30, visible: true },
    { name: 'Withdraw Stake', data: [], zIndex: -31, visible: true },
    { name: 'Set Cert Time', data: [], zIndex: -32, visible: false },
    { name: 'Init Reward', data: [], zIndex: -34, visible: false },
    { name: 'Claim Reward', data: [], zIndex: -35, visible: false },
    { name: 'Apply Penalty', data: [], zIndex: -36, visible: false },
  ]

  transactionStats
    .sort((a, b) => {
      if (transactionResponseType === 'array') {
        return (a as number[])[0] - (b as number[])[0]
      }
      return (a as TransactionStats).timestamp - (b as TransactionStats).timestamp
    })
    .forEach((transactionStat) => {
      if (transactionResponseType === 'array') {
        const stat = transactionStat as number[]
        const cycle = stat[0]
        const timestampMillis = stat[1] * 1000
        for (let i = 2; i < stat.length; i++) {
          seriesData[i - 2].data.push({ x: timestampMillis, y: stat[i], cycle: cycle })
        }
        return
      }
      const stat = transactionStat as TransactionStats
      const timestampMillis = stat.timestamp * 1000
      seriesData[0].data.push({ x: timestampMillis, y: stat.totalTxs, cycle: stat.cycle })
      seriesData[1].data.push({ x: timestampMillis, y: stat.totalInitNetworkTxs, cycle: stat.cycle })
      seriesData[2].data.push({ x: timestampMillis, y: stat.totalNetworkWindowsTxs, cycle: stat.cycle })
      seriesData[3].data.push({ x: timestampMillis, y: stat.totalSnapshotTxs, cycle: stat.cycle })
      seriesData[4].data.push({ x: timestampMillis, y: stat.totalEmailTxs, cycle: stat.cycle })
      seriesData[5].data.push({ x: timestampMillis, y: stat.totalGossipEmailHashTxs, cycle: stat.cycle })
      seriesData[6].data.push({ x: timestampMillis, y: stat.totalVerifyTxs, cycle: stat.cycle })
      seriesData[7].data.push({ x: timestampMillis, y: stat.totalRegisterTxs, cycle: stat.cycle })
      seriesData[8].data.push({ x: timestampMillis, y: stat.totalCreateTxs, cycle: stat.cycle })
      seriesData[9].data.push({ x: timestampMillis, y: stat.totalTransferTxs, cycle: stat.cycle })
      seriesData[10].data.push({ x: timestampMillis, y: stat.totalDistributeTxs, cycle: stat.cycle })
      seriesData[11].data.push({ x: timestampMillis, y: stat.totalMessageTxs, cycle: stat.cycle })
      seriesData[12].data.push({ x: timestampMillis, y: stat.totalTollTxs, cycle: stat.cycle })
      seriesData[13].data.push({ x: timestampMillis, y: stat.totalFriendTxs, cycle: stat.cycle })
      seriesData[14].data.push({ x: timestampMillis, y: stat.totalRemoveFriendTxs, cycle: stat.cycle })
      seriesData[15].data.push({ x: timestampMillis, y: stat.totalStakeTxs, cycle: stat.cycle })
      seriesData[16].data.push({ x: timestampMillis, y: stat.totalRemoveStakeTxs, cycle: stat.cycle })
      seriesData[17].data.push({ x: timestampMillis, y: stat.totalRemoveStakeRequestTxs, cycle: stat.cycle })
      seriesData[18].data.push({ x: timestampMillis, y: stat.totalNodeRewardTxs, cycle: stat.cycle })
      seriesData[19].data.push({ x: timestampMillis, y: stat.totalSnapshotClaimTxs, cycle: stat.cycle })
      seriesData[20].data.push({ x: timestampMillis, y: stat.totalIssueTxs, cycle: stat.cycle })
      seriesData[21].data.push({ x: timestampMillis, y: stat.totalProposalTxs, cycle: stat.cycle })
      seriesData[22].data.push({ x: timestampMillis, y: stat.totalVoteTxs, cycle: stat.cycle })
      seriesData[23].data.push({ x: timestampMillis, y: stat.totalTallyTxs, cycle: stat.cycle })
      seriesData[24].data.push({ x: timestampMillis, y: stat.totalApplyTallyTxs, cycle: stat.cycle })
      seriesData[25].data.push({ x: timestampMillis, y: stat.totalParametersTxs, cycle: stat.cycle })
      seriesData[26].data.push({ x: timestampMillis, y: stat.totalApplyParametersTxs, cycle: stat.cycle })
      seriesData[27].data.push({ x: timestampMillis, y: stat.totalDevIssueTxs, cycle: stat.cycle })
      seriesData[28].data.push({ x: timestampMillis, y: stat.totalDevProposalTxs, cycle: stat.cycle })
      seriesData[29].data.push({ x: timestampMillis, y: stat.totalDevVoteTxs, cycle: stat.cycle })
      seriesData[30].data.push({ x: timestampMillis, y: stat.totalDevTallyTxs, cycle: stat.cycle })
      seriesData[31].data.push({ x: timestampMillis, y: stat.totalApplyDevTallyTxs, cycle: stat.cycle })
      seriesData[32].data.push({ x: timestampMillis, y: stat.totalDevParametersTxs, cycle: stat.cycle })
      seriesData[33].data.push({ x: timestampMillis, y: stat.totalApplyDevParametersTxs, cycle: stat.cycle })
      seriesData[34].data.push({ x: timestampMillis, y: stat.totalDeveloperPaymentTxs, cycle: stat.cycle })
      seriesData[35].data.push({
        x: timestampMillis,
        y: stat.totalApplyDeveloperPaymentTxs,
        cycle: stat.cycle,
      })
      seriesData[36].data.push({ x: timestampMillis, y: stat.totalChangeConfigTxs, cycle: stat.cycle })
      seriesData[37].data.push({ x: timestampMillis, y: stat.totalApplyChangeConfigTxs, cycle: stat.cycle })
      seriesData[38].data.push({ x: timestampMillis, y: stat.totalChangeNetworkParamTxs, cycle: stat.cycle })
      seriesData[39].data.push({
        x: timestampMillis,
        y: stat.totalApplyChangeNetworkParamTxs,
        cycle: stat.cycle,
      })
      seriesData[40].data.push({ x: timestampMillis, y: stat.totalDepositStakeTxs, cycle: stat.cycle })
      seriesData[41].data.push({ x: timestampMillis, y: stat.totalWithdrawStakeTxs, cycle: stat.cycle })
      seriesData[42].data.push({ x: timestampMillis, y: stat.totalSetCertTimeTxs, cycle: stat.cycle })
      seriesData[43].data.push({ x: timestampMillis, y: stat.totalInitRewardTxs, cycle: stat.cycle })
      seriesData[44].data.push({ x: timestampMillis, y: stat.totalClaimRewardTxs, cycle: stat.cycle })
      seriesData[45].data.push({ x: timestampMillis, y: stat.totalApplyPenaltyTxs, cycle: stat.cycle })
    })

  if (!isDeveloperMode) {
    seriesData = seriesData.filter((series) =>
      ['Total Txs', 'Transfer', 'Message', 'Deposit Stake', 'Withdraw Stake'].includes(series.name)
    )
  }

  return seriesData
}

export function convertValidatorStatsToSeriesData(
  validatorStats: ValidatorStats[] | number[][],
  validatorResponseType = 'array'
): SeriesData[] {
  const seriesData: SeriesData[] = [
    { name: 'Active', data: [], zIndex: 5, tooltip: 'Count of all currently active validators' },
    {
      name: 'Activated',
      data: [],
      zIndex: 4,
      tooltip: 'Count of all validators that have been activated in a cycle',
    },
    { name: 'Syncing', data: [], zIndex: 3, tooltip: 'Count of all validators that are currently syncing' },
    {
      name: 'Joined',
      data: [],
      zIndex: 2,
      tooltip: 'Count of all validators that have joined in a cycle',
    },
    {
      name: 'Removed',
      data: [],
      zIndex: 1,
      tooltip: 'Count of all validators that have been removed in a cycle',
    },
    {
      name: 'Apoped',
      data: [],
      zIndex: 0,
      tooltip: 'Count of all validators that have been apoped in a cycle',
    },
  ]

  validatorStats.forEach((validatorStat) => {
    if (validatorResponseType === 'array') {
      const stat = validatorStat as number[]
      const cycle = stat[0]
      const timestampMillis = stat[1] * 1000
      for (let i = 2; i < stat.length; i++) {
        seriesData[i - 2].data.push({ x: timestampMillis, y: stat[i], cycle: cycle })
      }
      return
    }
    const stat = validatorStat as ValidatorStats
    const timestampMillis = stat.timestamp * 1000

    seriesData[0].data.push({ x: timestampMillis, y: stat.active, cycle: stat.cycle })
    seriesData[1].data.push({ x: timestampMillis, y: stat.activated, cycle: stat.cycle })
    seriesData[2].data.push({ x: timestampMillis, y: stat.syncing, cycle: stat.cycle })
    seriesData[3].data.push({ x: timestampMillis, y: stat.removed, cycle: stat.cycle })
    seriesData[4].data.push({ x: timestampMillis, y: stat.apoped, cycle: stat.cycle })
  })

  return seriesData
}

export function convertDailyTransactionStatsToSeriesData(
  transactionStats: DailyTransactionStats[] | number[][],
  transactionResponseType = 'array'
): {
  seriesData: SeriesData[]
  highLight: HighLight
} {
  const seriesData: SeriesData[] = [
    { name: 'Total Txs', data: [], zIndex: 1, tooltip: 'Total transactions per day', visible: true },
  ]
  if (!transactionStats || transactionStats.length === 0) {
    return { seriesData, highLight: { highest: null, lowest: null } }
  }
  let highest: HighLightPoint = { timestamp: 0, value: 0 }
  let lowest: HighLightPoint = { timestamp: 0, value: Infinity }
  transactionStats.forEach((stat) => {
    let timestamp: number
    let totalTxs: number
    // Extract transaction type data for tooltip
    let transferTxs = 0
    let messageTxs = 0
    let stakingTxs = 0
    let otherTxs = 0

    if (transactionResponseType === 'array') {
      // Array format for daily stats: [dateStartTime, totalTxs,  ...]
      const transactionStat = stat as number[]
      timestamp = transactionStat[0] // dateStartTime is already in milliseconds
      totalTxs = transactionStat[2] || 0 // total User Txs index in daily stats
      transferTxs = transactionStat[11] || 0 // Transfer index in daily stats
      messageTxs = transactionStat[13] || 0 // Message index in daily stats
      stakingTxs = transactionStat[46] + transactionStat[47] // Deposit Stake + Withdraw Stake txs
      otherTxs = totalTxs - transferTxs - messageTxs - stakingTxs
    } else {
      const transactionStat = stat as DailyTransactionStats
      timestamp = transactionStat.dateStartTime * 1000
      totalTxs = transactionStat.totalUserTxs || 0
      transferTxs = transactionStat.totalTransferTxs || 0
      messageTxs = transactionStat.totalMessageTxs || 0
      stakingTxs = transactionStat.totalDepositStakeTxs + transactionStat.totalWithdrawStakeTxs
      otherTxs = totalTxs - transferTxs - messageTxs - stakingTxs
    }

    if (totalTxs > highest.value) {
      highest = { timestamp, value: totalTxs }
    }
    if (totalTxs < lowest.value && totalTxs > 0) {
      lowest = { timestamp, value: totalTxs }
    }

    // Add data point for Total Txs with transaction type breakdown for tooltip
    seriesData[0].data.push({
      x: timestamp,
      y: totalTxs,
      dailyTxsChartData: {
        transferTxs,
        messageTxs,
        stakingTxs,
        otherTxs,
      },
    })
  })

  return { seriesData, highLight: { highest, lowest } }
}

export function convertDailyAccountStatsToSeriesData(
  dailyAccountStats: DailyAccountStats[] | number[][],
  accountResponseType = 'array',
  queryType: {
    newAddress?: boolean
    activeAccount?: boolean
    newAccount?: boolean
  }
): {
  seriesData: SeriesData[]
  highLight: HighLight
} {
  if (!queryType.newAddress && !queryType.activeAccount && !queryType.newAccount) {
    throw new Error('No query type selected for daily account stats')
  }
  const seriesData: SeriesData[] = [{ name: '', data: [], zIndex: 1, tooltip: '', visible: true }]
  if (queryType.newAddress) {
    seriesData[0].name = 'New Addresses'
  } else if (queryType.activeAccount) {
    seriesData[0].name = 'Active Accounts'
  } else if (queryType.newAccount) {
    seriesData[0].name = 'New Accounts'
  }

  if (!dailyAccountStats || dailyAccountStats.length === 0) {
    return { seriesData, highLight: { highest: null, lowest: null } }
  }
  let highest: HighLightPoint = { timestamp: 0, value: 0 }
  let lowest: HighLightPoint = { timestamp: 0, value: Infinity }

  let cumulativeTotal = 0
  dailyAccountStats.forEach((stat) => {
    let timestamp: number
    if (queryType.newAddress) {
      let newAccounts: number
      if (accountResponseType === 'array') {
        // Array format for daily stats: [dateStartTime, newAccounts, newUserAccounts, ...]
        const accountStat = stat as number[]
        timestamp = accountStat[0] // dateStartTime is already in milliseconds
        newAccounts = accountStat[1] || 0
      } else {
        const accountStat = stat as DailyAccountStats
        timestamp = accountStat.dateStartTime
        newAccounts = accountStat.newAccounts || 0
      }

      // Calculate cumulative total
      cumulativeTotal += newAccounts

      if (newAccounts > highest.value) {
        highest = { timestamp, value: newAccounts }
      }
      if (newAccounts < lowest.value && newAccounts > 0) {
        lowest = { timestamp, value: newAccounts }
      }

      // Add data point for New Addresses with cumulative total
      seriesData[0].data.push({
        x: timestamp,
        y: cumulativeTotal,
        newAddressChartData: {
          dailyIncrease: newAccounts,
        },
      })
    } else if (queryType.activeAccount) {
      let activeAccounts: number
      if (accountResponseType === 'array') {
        // Array format for daily stats: [dateStartTime, newAccounts, newUserAccounts, ...]
        const accountStat = stat as number[]
        timestamp = accountStat[0] // dateStartTime is already in milliseconds
        activeAccounts = accountStat[3] || 0
      } else {
        const accountStat = stat as DailyAccountStats
        timestamp = accountStat.dateStartTime
        activeAccounts = accountStat.activeAccounts || 0
      }

      if (activeAccounts > highest.value) {
        highest = { timestamp, value: activeAccounts }
      }
      if (activeAccounts < lowest.value) {
        lowest = { timestamp, value: activeAccounts }
      }
      // Add data point for Active Addresses
      seriesData[0].data.push({
        x: timestamp,
        y: activeAccounts,
      })
    } else if (queryType.newAccount) {
      let newUserAccounts: number
      if (accountResponseType === 'array') {
        // Array format for daily stats: [dateStartTime, newAccounts, newUserAccounts, activeAccounts, activeBalanceAccounts]
        const accountStat = stat as number[]
        timestamp = accountStat[0] // dateStartTime is already in milliseconds
        newUserAccounts = accountStat[2] || 0
      } else {
        const accountStat = stat as DailyAccountStats
        timestamp = accountStat.dateStartTime
        newUserAccounts = accountStat.newUserAccounts || 0
      }

      cumulativeTotal += newUserAccounts

      if (newUserAccounts > highest.value) {
        highest = { timestamp, value: newUserAccounts }
      }

      if (newUserAccounts < lowest.value && newUserAccounts > 0) {
        lowest = { timestamp, value: newUserAccounts }
      }

      // Add data point for New Accounts with cumulative total
      seriesData[0].data.push({
        x: timestamp,
        y: cumulativeTotal,
        accountChartData: {
          newUsers: newUserAccounts,
        },
      })
    }
  })

  return { seriesData, highLight: { highest, lowest } }
}

export function convertDailyCoinStatsToSeriesData(
  dailyCoinStats: DailyCoinStats[] | number[][],
  coinResponseType = 'array',
  queryType: {
    dailyMarketCap?: boolean
    dailySupplyGrowth?: boolean
    dailyBurntSupply?: boolean
    dailyTransactionFee?: boolean
    dailyAvgTransactionFee?: boolean
    dailyDistributedSupply?: boolean
    dailyNetworkStake?: boolean
  }
): {
  seriesData: SeriesData[]
  highLight: HighLight
} {
  if (
    !queryType.dailyMarketCap &&
    !queryType.dailySupplyGrowth &&
    !queryType.dailyBurntSupply &&
    !queryType.dailyTransactionFee &&
    !queryType.dailyAvgTransactionFee &&
    !queryType.dailyDistributedSupply &&
    !queryType.dailyNetworkStake
  ) {
    throw new Error('No query type selected for daily coin stats')
  }
  const seriesData: SeriesData[] = [{ name: '', data: [], zIndex: 1, tooltip: '', visible: true }]
  if (queryType.dailyMarketCap) {
    seriesData[0].name = 'Market Cap (USD)'
  } else if (queryType.dailySupplyGrowth) {
    seriesData[0].name = 'LIB Supply'
  } else if (queryType.dailyBurntSupply) {
    seriesData[0].name = 'Daily LIB Burnt'
  } else if (queryType.dailyTransactionFee) {
    seriesData[0].name = 'Txn Fee (LIB)'
  } else if (queryType.dailyAvgTransactionFee) {
    seriesData[0].name = 'Avg Tx Fee (USD)'
    seriesData[0].tooltip = 'Average Transaction Fee in USD'
  } else if (queryType.dailyDistributedSupply) {
    seriesData[0].name = 'Daily LIB Distributed'
  } else if (queryType.dailyNetworkStake) {
    seriesData[0].name = 'Network Stake'
  }
  if (!dailyCoinStats || dailyCoinStats.length === 0) {
    return { seriesData, highLight: { highest: null, lowest: null } }
  }
  let highest: HighLightPoint = { timestamp: 0, value: 0 }
  let lowest: HighLightPoint = { timestamp: 0, value: Infinity }

  let cumulativeTotal = config.genesisLIBSupply
  let cumulativeTotalStake = 0

  // Convert coin stats data for chart
  dailyCoinStats.forEach((stat) => {
    if (queryType.dailyMarketCap) {
      // Convert market cap data for chart

      let timestamp: number
      let priceUSD = 0
      if (coinResponseType === 'array') {
        const dailyCoinStat = stat as number[]
        timestamp = dailyCoinStat[0]
        priceUSD = dailyCoinStat[9]
        const mintedCoin = dailyCoinStat[1]
        const transactionFee = dailyCoinStat[2]
        const networkFee = dailyCoinStat[3]
        const rewardAmountRealized = dailyCoinStat[6]
        const penaltyAmount = dailyCoinStat[8]

        const totalSupplyChange = calculateTotalSupplyChange(
          mintedCoin,
          rewardAmountRealized,
          transactionFee,
          networkFee,
          penaltyAmount
        )

        cumulativeTotal = cumulativeTotal + totalSupplyChange
      } else {
        const dailyCoinStat = stat as DailyCoinStatsWithPrice
        timestamp = dailyCoinStat.dateStartTime
        priceUSD = parseFloat(dailyCoinStat.stabilityFactorStr) || 0
        const totalSupplyChange = calculateTotalSupplyChange(
          dailyCoinStat.mintedCoin,
          dailyCoinStat.rewardAmountRealized,
          dailyCoinStat.transactionFee,
          dailyCoinStat.networkFee,
          dailyCoinStat.penaltyAmount
        )

        cumulativeTotal = cumulativeTotal + totalSupplyChange
      }

      const marketCap = priceUSD * cumulativeTotal
      if (marketCap > highest.value) {
        highest = { timestamp, value: marketCap }
      }
      if (marketCap < lowest.value && marketCap > 0) {
        lowest = { timestamp, value: marketCap }
      }

      seriesData[0].data.push({
        x: timestamp,
        y: marketCap,
        marketCapChartData: {
          priceUSD,
        },
      })
    } else if (queryType.dailySupplyGrowth) {
      // Convert supply growth data for chart
      let timestamp: number
      let mintedCoin = 0
      let rewardAmountRealized = 0
      let transactionFee = 0
      let networkFee = 0
      let penaltyAmount = 0
      let totalSupplyChange = 0
      if (coinResponseType === 'array') {
        const dailyCoinStat = stat as number[]
        timestamp = dailyCoinStat[0]
        mintedCoin = dailyCoinStat[1]
        rewardAmountRealized = dailyCoinStat[6]
        transactionFee = dailyCoinStat[2]
        networkFee = dailyCoinStat[3]
        penaltyAmount = dailyCoinStat[8]

        totalSupplyChange = calculateTotalSupplyChange(
          mintedCoin,
          rewardAmountRealized,
          transactionFee,
          networkFee,
          penaltyAmount
        )

        cumulativeTotal = cumulativeTotal + totalSupplyChange
      } else {
        const dailyCoinStat = stat as DailyCoinStatsWithPrice
        timestamp = dailyCoinStat.dateStartTime
        mintedCoin = dailyCoinStat.mintedCoin
        rewardAmountRealized = dailyCoinStat.rewardAmountRealized
        transactionFee = dailyCoinStat.transactionFee
        networkFee = dailyCoinStat.networkFee
        penaltyAmount = dailyCoinStat.penaltyAmount
        totalSupplyChange = calculateTotalSupplyChange(
          mintedCoin,
          rewardAmountRealized,
          transactionFee,
          networkFee,
          penaltyAmount
        )

        cumulativeTotal = cumulativeTotal + totalSupplyChange
      }

      seriesData[0].data.push({
        x: timestamp,
        y: cumulativeTotal,
        supplyGrowthChartData: {
          mintedCoin,
          rewardAmountRealized,
          transactionFee,
          networkFee,
          penaltyAmount,
          totalSupplyChange,
        },
      })
    } else if (queryType.dailyBurntSupply) {
      // Convert burnt supply data for chart
      let timestamp: number
      let transactionFee = 0
      let networkFee = 0
      let penaltyAmount = 0
      if (coinResponseType === 'array') {
        const dailyCoinStat = stat as number[]
        timestamp = dailyCoinStat[0]
        transactionFee = dailyCoinStat[2] || 0
        networkFee = dailyCoinStat[3] || 0
        penaltyAmount = dailyCoinStat[8] || 0
      } else {
        const dailyCoinStat = stat as DailyCoinStats
        timestamp = dailyCoinStat.dateStartTime
        transactionFee = dailyCoinStat.transactionFee || 0
        networkFee = dailyCoinStat.networkFee || 0
        penaltyAmount = dailyCoinStat.penaltyAmount || 0
      }

      // Calculate total burnt supply (transaction fees + toll tax fees + penalty amount)
      const totalBurnt = transactionFee + networkFee + penaltyAmount

      if (totalBurnt > highest.value) {
        highest = { timestamp, value: totalBurnt }
      }
      if (totalBurnt < lowest.value && totalBurnt > 0) {
        lowest = { timestamp, value: totalBurnt }
      }

      seriesData[0].data.push({
        x: timestamp,
        y: totalBurnt,
        burntSupplyChartData: {
          transactionFee,
          networkFee,
          penaltyAmount,
        },
      })
    } else if (queryType.dailyTransactionFee) {
      // Convert transaction fee data for chart
      let timestamp: number
      let transactionFee = 0
      if (coinResponseType === 'array') {
        const dailyCoinStat = stat as number[]
        timestamp = dailyCoinStat[0]
        transactionFee = dailyCoinStat[2] || 0
      } else {
        const dailyCoinStat = stat as DailyCoinStats
        timestamp = dailyCoinStat.dateStartTime
        transactionFee = dailyCoinStat.transactionFee || 0
      }

      if (transactionFee > highest.value) {
        highest = { timestamp, value: transactionFee }
      }
      if (transactionFee < lowest.value && transactionFee > 0) {
        lowest = { timestamp, value: transactionFee }
      }

      seriesData[0].data.push({
        x: timestamp,
        y: transactionFee,
      })
    } else if (queryType.dailyAvgTransactionFee) {
      // Convert average transaction fee data for chart
      let timestamp: number
      let transactionFee: number
      let priceUSD: number
      let totalUserTxs: number
      if (coinResponseType === 'array') {
        const dailyCoinStat = stat as number[]
        timestamp = dailyCoinStat[0]
        transactionFee = dailyCoinStat[2] || 0
        priceUSD = parseFloat(dailyCoinStat[9] as unknown as string) || 0
        totalUserTxs = dailyCoinStat[10] || 0
      } else {
        const dailyCoinStat = stat as DailyCoinStatsWithPrice & { totalUserTxs?: number }
        timestamp = dailyCoinStat.dateStartTime
        transactionFee = dailyCoinStat.transactionFee || 0
        priceUSD = parseFloat(dailyCoinStat.stabilityFactorStr) || 0
        totalUserTxs = dailyCoinStat.totalUserTxs || 0
      }

      // Convert transaction fee
      const avgTransactionFee = totalUserTxs > 0 ? transactionFee / totalUserTxs : 0

      // Calculate average transaction fee in USD
      const avgTransactionFeeUsd = avgTransactionFee * priceUSD || 0

      if (avgTransactionFeeUsd > highest.value) {
        highest = { timestamp, value: avgTransactionFeeUsd }
      }
      if (avgTransactionFeeUsd < lowest.value && avgTransactionFeeUsd > 0) {
        lowest = { timestamp, value: avgTransactionFeeUsd }
      }

      seriesData[0].data.push({
        x: timestamp,
        y: avgTransactionFee,
        avgTxFeeChartData: {
          priceUSD,
          totalTxFee: transactionFee,
          totalUserTxs,
        },
      })
    } else if (queryType.dailyDistributedSupply) {
      // Convert distributed supply data for chart
      let timestamp: number
      let mintedCoin = 0
      let rewardAmountRealized = 0
      if (coinResponseType === 'array') {
        const dailyCoinStat = stat as number[]
        timestamp = dailyCoinStat[0]
        mintedCoin = dailyCoinStat[1] || 0
        rewardAmountRealized = dailyCoinStat[6] || 0
      } else {
        const dailyCoinStat = stat as DailyCoinStats
        timestamp = dailyCoinStat.dateStartTime
        mintedCoin = dailyCoinStat.mintedCoin || 0
        rewardAmountRealized = dailyCoinStat.rewardAmountRealized || 0
      }

      // Calculate total distributed (minted + rewards - penalties)
      const totalDistributed = mintedCoin + rewardAmountRealized

      if (totalDistributed > highest.value) {
        highest = { timestamp, value: totalDistributed }
      }
      if (totalDistributed < lowest.value && totalDistributed > 0) {
        lowest = { timestamp, value: totalDistributed }
      }

      seriesData[0].data.push({
        x: timestamp,
        y: totalDistributed,
        distributedSupplyChartData: {
          mintedCoin,
          rewardAmountRealized,
        },
      })
    } else if (queryType.dailyNetworkStake) {
      // Convert network stake data for chart
      let timestamp: number
      let stakeAmount = 0
      let unstakeAmount = 0
      let penaltyAmount = 0
      if (coinResponseType === 'array') {
        const dailyCoinStat = stat as number[]
        timestamp = dailyCoinStat[0]
        stakeAmount = dailyCoinStat[4] || 0
        unstakeAmount = dailyCoinStat[5] || 0
        penaltyAmount = dailyCoinStat[8] || 0
      } else {
        const dailyCoinStat = stat as DailyCoinStats
        timestamp = dailyCoinStat.dateStartTime
        stakeAmount = dailyCoinStat.stakeAmount || 0
        unstakeAmount = dailyCoinStat.unStakeAmount || 0
        penaltyAmount = dailyCoinStat.penaltyAmount || 0
      }

      // Calculate total stake change for the day
      const totalStakeChange = calculateTotalStakeChange(stakeAmount, unstakeAmount, penaltyAmount)

      // Calculate cumulative total stake
      cumulativeTotalStake = cumulativeTotalStake + totalStakeChange

      if (cumulativeTotalStake > highest.value) {
        highest = { timestamp, value: cumulativeTotalStake }
      }
      if (cumulativeTotalStake < lowest.value && cumulativeTotalStake > 0) {
        lowest = { timestamp, value: cumulativeTotalStake }
      }

      seriesData[0].data.push({
        x: timestamp,
        y: cumulativeTotalStake,
        networkStakeChartData: {
          stakeAmount,
          unstakeAmount,
          penaltyAmount,
        },
      })
    }
  })

  return { seriesData, highLight: { highest, lowest } }
}

export function calculateTotalSupplyChange(
  mintedCoin: number,
  rewardAmountRealized: number,
  transactionFee: number,
  networkFee: number,
  penaltyAmount: number
): number {
  return mintedCoin + rewardAmountRealized - transactionFee - networkFee - penaltyAmount
}

export function calculateTotalStakeChange(
  stakeAmount: number,
  unStakeAmount: number,
  penaltyAmount: number
): number {
  return stakeAmount - unStakeAmount - penaltyAmount
}

export function convertDailyNetworkStatsToSeriesData(
  dailyNetworkStats: DailyNetworkStats[] | number[][],
  networkResponseType = 'array',
  queryType: {
    dailyPrice?: boolean
    dailyTransactionFee?: boolean
    dailyTxFeeSet?: boolean
    dailyNodeRewardRate?: boolean
    dailyRequiredStake?: boolean
    dailyActiveNodes?: boolean
  }
): {
  seriesData: SeriesData[]
  highLight: HighLight
} {
  if (
    !queryType.dailyPrice &&
    !queryType.dailyTransactionFee &&
    !queryType.dailyTxFeeSet &&
    !queryType.dailyNodeRewardRate &&
    !queryType.dailyRequiredStake &&
    !queryType.dailyActiveNodes
  ) {
    throw new Error('No query type selected for daily network stats')
  }
  const seriesData: SeriesData[] = [{ name: '', data: [], zIndex: 1, tooltip: '', visible: true }]

  if (queryType.dailyPrice) {
    seriesData[0].name = 'LIB Price (USD)'
  } else if (queryType.dailyTransactionFee) {
    seriesData[0].name = 'Avg Tx Fee (USD)'
    seriesData[0].tooltip = 'Average Transaction Fee in USD'
  } else if (queryType.dailyTxFeeSet) {
    seriesData[0].name = 'Transaction Fee Set (USD)'
  } else if (queryType.dailyNodeRewardRate) {
    seriesData[0].name = 'Node Reward Rate (USD)'
  } else if (queryType.dailyRequiredStake) {
    seriesData[0].name = 'Required Stake (USD)'
  } else if (queryType.dailyActiveNodes) {
    seriesData[0].name = 'Active Nodes'
  }

  if (!dailyNetworkStats || dailyNetworkStats.length === 0) {
    return { seriesData, highLight: { highest: null, lowest: null, current: null } }
  }
  let highest: HighLightPoint = { timestamp: 0, value: 0 }
  let lowest: HighLightPoint = { timestamp: 0, value: Infinity }
  let current = 0

  dailyNetworkStats.forEach((stat) => {
    if (queryType.dailyPrice) {
      let timestamp: number
      let priceUSD: number

      if (networkResponseType === 'array') {
        // Array format for daily network stats: [dateStartTime, stabilityFactorStr, transactionFeeUsdStr, ...]
        const networkStat = stat as number[]
        timestamp = networkStat[0] // dateStartTime is already in milliseconds
        priceUSD = parseFloat(networkStat[1] as any) || 0
      } else {
        const networkStat = stat as DailyNetworkStats
        timestamp = networkStat.dateStartTime
        priceUSD = parseFloat(networkStat.stabilityFactorStr) || 0
      }

      if (priceUSD > highest.value) {
        highest = { timestamp, value: priceUSD }
      }
      if (priceUSD < lowest.value && priceUSD > 0) {
        lowest = { timestamp, value: priceUSD }
      }

      current = priceUSD

      seriesData[0].data.push({
        x: timestamp,
        y: priceUSD,
      })
    } else if (queryType.dailyTransactionFee) {
      let timestamp: number
      let transactionFeeUsd: number
      let priceUSD: number

      if (networkResponseType === 'array') {
        // Array format for daily network stats: [dateStartTime, stabilityFactorStr, transactionFeeUsdStr, ...]
        const networkStat = stat as number[]
        timestamp = networkStat[0] // dateStartTime is already in milliseconds
        priceUSD = parseFloat(networkStat[1] as unknown as string) || 0
        transactionFeeUsd = parseFloat(networkStat[2] as unknown as string) || 0
      } else {
        const networkStat = stat as DailyNetworkStats
        timestamp = networkStat.dateStartTime
        priceUSD = parseFloat(networkStat.stabilityFactorStr) || 0
        transactionFeeUsd = parseFloat(networkStat.transactionFeeUsdStr) || 0
      }

      if (transactionFeeUsd > highest.value) {
        highest = { timestamp, value: transactionFeeUsd }
      }
      if (transactionFeeUsd < lowest.value && transactionFeeUsd > 0) {
        lowest = { timestamp, value: transactionFeeUsd }
      }

      // Add data point for Average Transaction Fee with stability factor for tooltip
      seriesData[0].data.push({
        x: timestamp,
        y: transactionFeeUsd,
        avgTxFeeChartData: {
          priceUSD,
        },
      })
    } else if (queryType.dailyTxFeeSet) {
      let timestamp: number
      let txFeeSetUsd: number

      if (networkResponseType === 'array') {
        // Array format: [dateStartTime, stabilityFactorStr, transactionFeeUsdStr, stakeRequiredUsdStr, ...]
        const networkStat = stat as number[]
        timestamp = networkStat[0]
        txFeeSetUsd = parseFloat(networkStat[2] as any) || 0
      } else {
        const networkStat = stat as DailyNetworkStats
        timestamp = networkStat.dateStartTime
        txFeeSetUsd = parseFloat(networkStat.transactionFeeUsdStr) || 0
      }

      if (txFeeSetUsd > highest.value) {
        highest = { timestamp, value: txFeeSetUsd }
      }
      if (txFeeSetUsd < lowest.value && txFeeSetUsd > 0) {
        lowest = { timestamp, value: txFeeSetUsd }
      }

      current = txFeeSetUsd

      seriesData[0].data.push({
        x: timestamp,
        y: txFeeSetUsd,
      })
    } else if (queryType.dailyNodeRewardRate) {
      let timestamp: number
      let nodeRewardRateUsd: number

      if (networkResponseType === 'array') {
        // Array format: [dateStartTime, stabilityFactorStr, transactionFeeUsdStr, stakeRequiredUsdStr, nodeRewardAmountUsdStr, ...]
        const networkStat = stat as number[]
        timestamp = networkStat[0]
        nodeRewardRateUsd = parseFloat(networkStat[4] as any) || 0
      } else {
        const networkStat = stat as DailyNetworkStats
        timestamp = networkStat.dateStartTime
        nodeRewardRateUsd = parseFloat(networkStat.nodeRewardAmountUsdStr) || 0
      }

      if (nodeRewardRateUsd > highest.value) {
        highest = { timestamp, value: nodeRewardRateUsd }
      }
      if (nodeRewardRateUsd < lowest.value && nodeRewardRateUsd > 0) {
        lowest = { timestamp, value: nodeRewardRateUsd }
      }

      current = nodeRewardRateUsd

      seriesData[0].data.push({
        x: timestamp,
        y: nodeRewardRateUsd,
      })
    } else if (queryType.dailyRequiredStake) {
      let timestamp: number
      let requiredStakeUsd: number

      if (networkResponseType === 'array') {
        // Array format: [dateStartTime, stabilityFactorStr, transactionFeeUsdStr, stakeRequiredUsdStr, ...]
        const networkStat = stat as number[]
        timestamp = networkStat[0]
        requiredStakeUsd = parseFloat(networkStat[3] as any) || 0
      } else {
        const networkStat = stat as DailyNetworkStats
        timestamp = networkStat.dateStartTime
        requiredStakeUsd = parseFloat(networkStat.stakeRequiredUsdStr) || 0
      }

      if (requiredStakeUsd > highest.value) {
        highest = { timestamp, value: requiredStakeUsd }
      }
      if (requiredStakeUsd < lowest.value && requiredStakeUsd > 0) {
        lowest = { timestamp, value: requiredStakeUsd }
      }

      current = requiredStakeUsd

      seriesData[0].data.push({
        x: timestamp,
        y: requiredStakeUsd,
      })
    } else if (queryType.dailyActiveNodes) {
      let timestamp: number
      let activeNodes: number
      let standbyNodes: number

      if (networkResponseType === 'array') {
        // Array format: [dateStartTime, stabilityFactorStr, transactionFeeUsdStr, stakeRequiredUsdStr, nodeRewardAmountUsdStr, nodePenaltyUsdStr, defaultTollUsdStr, minTollUsdStr, activeNodes, standbyNodes]
        const networkStat = stat as number[]
        timestamp = networkStat[0]
        activeNodes = networkStat[8] || 0
        standbyNodes = networkStat[9] || 0
      } else {
        const networkStat = stat as DailyNetworkStats
        timestamp = networkStat.dateStartTime
        activeNodes = networkStat.activeNodes || 0
        standbyNodes = networkStat.standbyNodes || 0
      }

      if (activeNodes > highest.value) {
        highest = { timestamp, value: activeNodes }
      }
      if (activeNodes < lowest.value && activeNodes > 0) {
        lowest = { timestamp, value: activeNodes }
      }

      current = activeNodes

      seriesData[0].data.push({
        x: timestamp,
        y: activeNodes,
        activeNodesChartData: {
          standbyNodes,
        },
      })
    }
  })

  return { seriesData, highLight: { highest, lowest, current } }
}
