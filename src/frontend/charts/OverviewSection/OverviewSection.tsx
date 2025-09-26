import React from 'react'
import { useCycle, useTransaction, useAccount, useNewStats } from '../../api'
import { TransactionSearchParams } from '../../../types'
import styles from './OverviewSection.module.scss'

interface StatsCardProps {
  title: string
  value: string | number
  change?: string
  changeType?: 'positive' | 'negative' | 'neutral'
}

const StatsCard: React.FC<StatsCardProps> = ({ title, value, change, changeType = 'neutral' }) => (
  <div className={styles.statsCard}>
    <div className={styles.cardHeader}>
      <div className={styles.cardTitle}>{title}</div>
    </div>
    <div className={styles.cardValue}>
      {typeof value === 'number' ? value.toLocaleString() : value}
      {change && <span className={`${styles.cardChange} ${styles[changeType]}`}>({change})</span>}
    </div>
  </div>
)

export const OverviewSection: React.FC = () => {
  const {
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
  } = useNewStats({
    fetchAccountStats: true,
    fetchTransactionStats: true,
    last24HrsCoinReport: true,
    fetchNetworkStats: true,
  })

  // Helper function to format percentage and determine change type
  const formatPercentage = (
    value: number
  ): { change: string; changeType: 'positive' | 'negative' | 'neutral' } => {
    const formattedValue = Math.abs(value).toFixed(1)
    if (value > 0) {
      return { change: `+${formattedValue}%`, changeType: 'positive' }
    } else if (value < 0) {
      return { change: `-${formattedValue}%`, changeType: 'negative' }
    } else {
      return { change: '0%', changeType: 'neutral' }
    }
  }

  // 👇 Prepare an array of stats
  const stats: StatsCardProps[] = [
    {
      title: 'Addresses (Total)',
      value: totalAccounts,
      ...formatPercentage(totalAccountsChange),
    },
    {
      title: 'Transactions (Total)',
      value: totalUserTxs,
      ...formatPercentage(totalUserTxsChange),
    },
    {
      title: 'New Addresses (24H)',
      value: totalNewAccounts,
      ...formatPercentage(totalNewAccountsChange),
    },
    {
      title: 'Transactions (24H)',
      value: totalNewUserTxs,
      ...formatPercentage(totalNewUserTxsChange),
    },
    // Avg tx fee would be total_tx_fee_24h / transactions_24h
    {
      title: 'Total Transaction Fee (24H)',
      value: totalNewTransactionFee,
    },
    {
      title: 'Avg Transaction Fee (24H)',
      value: totalNewTransactionFee / totalNewUserTxs,
    },
    { title: 'Network Utilization (24H)', value: 0 },
    {
      title: 'Burnt Fees (24H)',
      value: totalNewTransactionFee + totalNewBurntFee,
    },
    { title: 'Tx Fee Set', value: `$${transactionFeeUsd}` },
    { title: 'Node Reward / Hr', value: `$${nodeRewardAmountUsd}` },
    { title: 'Stake Required Amount', value: `$${stakeRequiredUsd}` },
    { title: 'Active Nodes', value: activeNodes },
  ]

  return (
    <div className={styles.OverviewSection}>
      <div className={styles.sectionHeader}>
        <h5>Overview Stats</h5>
        {/* <p>Key statistics and metrics for the Liberdus network</p> */}
      </div>

      {/* Network Statistics Grid */}
      <div className={styles.statsGrid}>
        {stats.map((s, i) => (
          <StatsCard key={i} title={s.title} value={s.value} change={s?.change} changeType={s?.changeType} />
        ))}
      </div>
    </div>
  )
}
