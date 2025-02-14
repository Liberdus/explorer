import React from 'react'
import moment from 'moment'

import { NewCardDetail } from '../NewCardDetail'
import { SearchBox } from '../SearchBox'
import { Spacer } from '../../components'

import { useCycle, useTransaction, useStats } from '../../api'
import styles from './Dashboard.module.scss'
import { TransactionSearchParams } from '../../../types'

import { LatestTransactions } from '../LatestTransaction'
import { LatestCycle } from '../LatestCycle'

export const Dashboard: React.FC = () => {
  const { data: cycles } = useCycle({ count: 10 })
  const { transactions, totalTransactions } = useTransaction({
    count: 10,
    txType: TransactionSearchParams.all,
    totalTxsDetail: false,
  })

  const cyclesList = cycles.map((row) => {
    return {
      key: row?.cycleRecord?.counter ?? -1,
      value: moment(row?.cycleRecord?.start * 1000).calendar(),
      activeNodes: row?.cycleRecord?.active || 0,
      standbyNodes: row?.cycleRecord?.standby || 0,
    }
  })

  const { totalLIB } = useStats({ fetchCoinStats: true })

  const transactionStats = [
    [1506988800000, 1000],
    [1507075200000, 2000],
    [1507161600000, 1500],
    [1507248000000, 700],
    [1507507200000, 4000],
    [1507593600000, 3000],
    [1507680000000, 2000],
    [1507766400000, 1000],
    [1507852800000, 1500],
    [1508112000000, 2200],
  ]

  return (
    <div className={styles.Dashboard}>
      <Spacer space="32" />
      <SearchBox mode={cycles[0]?.cycleRecord['mode']} />
      <Spacer space="48" />
      <NewCardDetail
        totalCycles={cyclesList[0]?.key}
        totalTransactions={totalTransactions}
        totalLIB={totalLIB}
        libPrice={0.082323}
        transactionStats={transactionStats}
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
