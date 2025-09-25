import React from 'react'
import { useCycle, useTransaction, useAccount, useStats } from '../../api'
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
  const { data: cycles } = useCycle({ count: 10 })
  const {
    totalTransferTxs,
    totalMessageTxs,
    totalDepositStakeTxs,
    totalWithdrawStakeTxs,
    totalTransactions,
  } = useTransaction({
    count: 10,
    txType: TransactionSearchParams.all,
    totalTxsDetail: true,
  })

  const { totalAccounts } = useAccount({ count: 10 })
  const { totalLIB, totalStakedLIB } = useStats({
    fetchCoinStats: true,
  })

  const latestCycle = cycles?.[0]
  const activeNodes = latestCycle?.cycleRecord?.active || 0
  const standbyNodes = latestCycle?.cycleRecord?.standby || 0

  // 👇 Prepare an array of stats
  const stats: StatsCardProps[] = [
    { title: 'Active Nodes', value: activeNodes, change: '3%', changeType: 'neutral' },
    { title: 'Standby Nodes', value: standbyNodes, change: '5%', changeType: 'negative' },
    { title: 'Total Accounts', value: totalAccounts, change: '10%', changeType: 'positive' },
    { title: 'Total Transactions', value: totalTransactions },
    { title: 'Transfer Txns', value: totalTransferTxs },
    { title: 'Message Txns', value: totalMessageTxs },
    { title: 'Deposit Stake Txns', value: totalDepositStakeTxs },
    { title: 'Withdraw Stake Txns', value: totalWithdrawStakeTxs },
    { title: 'Total LIB', value: totalLIB },
    { title: 'Total Staked LIB', value: totalStakedLIB },
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
