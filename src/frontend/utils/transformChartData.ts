import { TransactionStats } from '../../stats/transactionStats'
import { ValidatorStats } from '../../stats/validatorStats'

interface DataPoint {
  x: number
  y: number
  cycle: number
  // Additional properties for tooltip data
  transferTxs?: number
  messageTxs?: number
  depositStakeTxs?: number
  withdrawStakeTxs?: number
}

interface SeriesData {
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
    .sort((a, b) => (transactionResponseType === 'array' ? a[0] - b[0] : a.timestamp - b.timestamp))
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
  validatorResponseType?: string
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

export function convertTransactionStatsToDailyData(
  transactionStats: TransactionStats[] | number[][]
): SeriesData[] {
  if (!transactionStats || transactionStats.length === 0) {
    return [
      { name: 'Total Txs', data: [], zIndex: 1, tooltip: 'Total transactions per day', visible: true },
    ]
  }

  // Initialize series data array - only Total Txs
  const seriesData: SeriesData[] = [
    { name: 'Total Txs', data: [], zIndex: 1, tooltip: 'Total transactions per day', visible: true },
  ]

  transactionStats
    .sort((a, b) => {
      if (Array.isArray(a) && Array.isArray(b)) {
        return a[0] - b[0] // Sort by dateStartTime (index 0 in array format for daily stats)
      }
      return (a as TransactionStats).timestamp - (b as TransactionStats).timestamp
    })
    .forEach((transactionStat) => {
      let timestamp: number
      let totalTxs: number

      if (Array.isArray(transactionStat)) {
        // Array format for daily stats: [dateStartTime, totalTxs, ...]
        timestamp = transactionStat[0] // dateStartTime is already in milliseconds
        totalTxs = transactionStat[1] || 0
      } else {
        // Object format
        timestamp = transactionStat.timestamp * 1000
        totalTxs = transactionStat.totalTxs || 0
      }

      // Extract transaction type data for tooltip
      let transferTxs = 0
      let messageTxs = 0
      let depositStakeTxs = 0
      let withdrawStakeTxs = 0

      if (Array.isArray(transactionStat)) {
        // For daily stats array format: [dateStartTime, totalTxs, totalTransferTxs, totalMessageTxs, totalDepositStakeTxs, totalWithdrawStakeTxs]
        transferTxs = transactionStat[2] || 0 // Transfer index in daily stats
        messageTxs = transactionStat[3] || 0 // Message index in daily stats
        depositStakeTxs = transactionStat[4] || 0 // Deposit Stake index in daily stats
        withdrawStakeTxs = transactionStat[5] || 0 // Withdraw Stake index in daily stats
      } else {
        // Object format
        transferTxs = transactionStat.totalTransferTxs || 0
        messageTxs = transactionStat.totalMessageTxs || 0
        depositStakeTxs = transactionStat.totalDepositStakeTxs || 0
        withdrawStakeTxs = transactionStat.totalWithdrawStakeTxs || 0
      }

      // Add data point for Total Txs with transaction type breakdown for tooltip
      seriesData[0].data.push({
        x: timestamp,
        y: totalTxs,
        cycle: 0,
        transferTxs,
        messageTxs,
        depositStakeTxs,
        withdrawStakeTxs,
      })
    })

  return seriesData
}
