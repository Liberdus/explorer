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

  const latestCycle = cycles[0]
  const activeNodes = latestCycle?.cycleRecord?.active || 0
  const standbyNodes = latestCycle?.cycleRecord?.standby || 0

  return (
    <div className={styles.OverviewSection}>
      <div className={styles.sectionHeader}>
        <h5>Overview Stats</h5>
        {/* <p>Key statistics and metrics for the Liberdus network</p> */}
      </div>

      {/* Network Statistics Grid */}
      <div className={styles.statsGrid}>
        <StatsCard
          title="Total Transactions"
          value={totalTransactions}
          change="0.20%"
          changeType="positive"
        />

        <StatsCard title="Total Accounts" value={totalAccounts} />

        <StatsCard title="Active Validators" value={activeNodes} />

        <StatsCard title="Standby Nodes" value={standbyNodes} />

        <StatsCard title="Total LIB Supply" value={totalLIB?.toLocaleString() || 'Loading...'} />

        <StatsCard title="Staked LIB" value={totalStakedLIB?.toLocaleString() || 'Loading...'} />

        <StatsCard title="Transfer Transactions" value={totalTransferTxs} />

        <StatsCard title="Message Transactions" value={totalMessageTxs} />

        <StatsCard title="Stake Deposits" value={totalDepositStakeTxs} />

        <StatsCard title="Stake Withdrawals" value={totalWithdrawStakeTxs} />
      </div>
    </div>
  )
}
