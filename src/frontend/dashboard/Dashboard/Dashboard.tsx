import React from 'react'

import { NewCardDetail } from '../NewCardDetail'
import { SearchBox } from '../SearchBox'
import { Spacer } from '../../components'

import { useCycle, useTransaction, useStats } from '../../api'
import styles from './Dashboard.module.scss'
import { TransactionSearchParams } from '../../../types'

import { LatestTransactions } from '../LatestTransaction'
import { LatestCycle } from '../LatestCycle'
import { useDexTokenPrice } from '../../api/useDexTokenPrice'
import useAccountDetail from '../../api/useAccountDetail'
import { NetworkAccountId } from '../../../config'
import { TransactionStats } from '../../../stats/transactionStats'

export const Dashboard: React.FC = () => {
  const { data: cycles } = useCycle({ count: 10 })
  const { transactions, totalTransactions } = useTransaction({
    count: 10,
    txType: TransactionSearchParams.all,
    totalTxsDetail: false,
  })
  const { transactionStats, totalLIB } = useStats({
    last14DaysTxsReport: true,
    transactionResponseType: 'array',
    fetchCoinStats: true,
  })

  const { account: networkAccount } = useAccountDetail(NetworkAccountId)

  const { tokenPrice, marketCap } = useDexTokenPrice()

  return (
    <div className={styles.Dashboard}>
      <Spacer space="32" />
      <SearchBox mode={cycles[0]?.cycleRecord['mode']} />
      <Spacer space="48" />
      <NewCardDetail
        totalCycles={cycles[0]?.cycleRecord['counter'] ?? 0}
        totalActiveNodes={cycles[0]?.cycleRecord['active'] ?? 0}
        totalTransactions={totalTransactions}
        tokenPrice={tokenPrice}
        marketCap={marketCap}
        transactionStats={transactionStats as TransactionStats[]}
        totalLIB={totalLIB}
        networkParameters={networkAccount?.data?.current}
      />
      <Spacer space="48" />
      <div className={styles.tableGrid}>
        <LatestCycle cycles={cycles} />
        <LatestTransactions transactions={transactions} />
      </div>
      <Spacer space="48" />
    </div>
  )
}
