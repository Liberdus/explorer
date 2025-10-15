import React from 'react'
import Link from 'next/link'
import { useNewStats } from '../../api'
import styles from './OverviewSection.module.scss'

interface StatsCardProps {
  title: string
  value: string | number
  change?: string
  changeType?: 'positive' | 'negative' | 'neutral'
  route?: string
}

const StatsCard: React.FC<StatsCardProps> = ({ title, value, change, changeType = 'neutral', route }) => {
  const cardContent = (
    <div className={`${styles.statsCard} ${route ? styles.clickable : ''}`}>
      <div className={styles.cardHeader}>
        <div className={styles.cardTitle}>{title}</div>
        {route && <div className={styles.arrowIcon}>↗</div>}
      </div>
      <div className={styles.cardValue}>
        {typeof value === 'number' ? value.toLocaleString() : value}
        {change && <span className={`${styles.cardChange} ${styles[changeType]}`}>({change})</span>}
      </div>
    </div>
  )

  if (route) {
    return (
      <Link href={route} className={styles.cardLink}>
        {cardContent}
      </Link>
    )
  }

  return cardContent
}

export const OverviewSection: React.FC = () => {
  const {
    totalAccounts,
    newAccounts,
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
    totalStaked,
    stabilityFactorStr,
    transactionFeeUsdStr,
    nodeRewardAmountUsdStr,
    stakeRequiredUsdStr,
    activeNodes,
    standbyNodes,
    totalUserAccounts,
    newUserAccounts,
    activeAccounts,
    activeAccountsChange,
  } = useNewStats({
    fetchAccountStats: true,
    fetchTransactionStats: true,
    fetchCoinStats: true,
    fetchNetworkStats: true,
  })

  // Helper function to format percentage and determine change type
  const formatPercentage = (
    value: number
  ): { change: string; changeType: 'positive' | 'negative' | 'neutral' } => {
    const formattedValue = Math.abs(value).toFixed(2)
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
      route: '/charts/address',
    },
    {
      title: 'Transactions (Total)',
      value: totalUserTxs,
      // ...formatPercentage(totalUserTxsChange),
      route: '/charts/tx',
    },
    {
      title: 'New Addresses (24H)',
      value: newAccounts,
      ...formatPercentage(newAccountsChange),
      route: '/charts/address',
    },
    {
      title: 'Transactions (24H)',
      value: newUserTxs,
      ...formatPercentage(newUserTxsChange),
      route: '/charts/tx',
    },
    {
      title: 'Total Transaction Fee (24H)',
      value: `$${newTransactionFee * parseFloat(stabilityFactorStr)}`,
      route: '/charts/transactionfee',
    },
    // Avg tx fee would be total_tx_fee_24h / transactions_24h
    {
      title: 'Avg Transaction Fee (24H)',
      value: `$${
        newUserTxs
          ? ((newTransactionFee / newUserTxs) * parseFloat(stabilityFactorStr)).toLocaleString(undefined, {
              maximumFractionDigits: 4,
            })
          : 0
      }`,
      route: '/charts/avg-txfee-usd',
    },
    { title: 'Network Utilization (24H)', value: 0 },
    {
      title: 'Burnt Fees (24H)',
      value: `$${newBurntFee * parseFloat(stabilityFactorStr)}`,
      route: '/charts/dailylibburnt',
    },
    { title: 'Tx Fee Set', value: `$${transactionFeeUsdStr}` },
    { title: 'Node Reward / Hr', value: `$${nodeRewardAmountUsdStr}` },
    { title: 'Stake Required Amount', value: `$${stakeRequiredUsdStr}` },
    { title: 'Active Nodes', value: activeNodes },
    { title: 'LIB Price Set', value: `$${stabilityFactorStr}`, route: '/charts/libprice' },
    {
      title: 'LIB Supply',
      value: `${totalSupply.toLocaleString(undefined, {
        maximumFractionDigits: 2,
      })}`,
      route: '/charts/libsupplygrowth',
    },
    {
      title: 'LIB MarketCap',
      value: `$${(totalSupply * parseFloat(stabilityFactorStr)).toLocaleString(undefined, {
        maximumFractionDigits: 2,
      })}`,
      route: '/charts/marketcap',
    },
    {
      title: '$Total Staked',
      value: `$${(totalStaked * parseFloat(stabilityFactorStr)).toLocaleString(undefined, {
        maximumFractionDigits: 2,
      })}`,
    },
    {
      title: '$Network Rev (24H)',
      value: `$${(newBurntFee * parseFloat(stabilityFactorStr)).toLocaleString(undefined, {
        maximumFractionDigits: 2,
      })}`,
      route: '/charts/dailylibburnt',
    },
    {
      title: '$Network Exp (24H)',
      value: `$${(newNetworkExpense * parseFloat(stabilityFactorStr)).toLocaleString(undefined, {
        maximumFractionDigits: 2,
      })}`,
      route: '/charts/dailylibdistributed',
    },
    {
      title: 'SA Ratio',
      value: `${standbyNodes} :  ${activeNodes}`,
    },
    {
      title: 'LIB Supply (24H)',
      value: `${newSupply.toLocaleString(undefined, {
        maximumFractionDigits: 2,
      })}`,
      route: '/charts/libsupplygrowth',
    },
    {
      title: 'Accounts (Total)',
      value: totalUserAccounts,
      ...formatPercentage(totalUserAccountsChange),
      route: '/charts/account',
    },
    {
      title: 'Accounts (24H)',
      value: newUserAccounts,
      ...formatPercentage(newUserAccountsChange),
      route: '/charts/account',
    },
    {
      title: 'Daily Active Accounts (24H)',
      value: activeAccounts,
      ...formatPercentage(activeAccountsChange),
      route: '/charts/active-account',
    },
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
          <StatsCard
            key={i}
            title={s.title}
            value={s.value}
            change={s?.change}
            changeType={s?.changeType}
            route={s?.route}
          />
        ))}
      </div>
    </div>
  )
}
