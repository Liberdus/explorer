import React from 'react'
import moment from 'moment'

import { CardDetail } from '../CardDetail'
import { SearchBox } from '../SearchBox'
import { Spacer } from '../../components'

import { useCycle, useTransaction, useAccount, useStats } from '../../api'
import styles from './Dashboard.module.scss'
import { ChartDetail } from '../ChartDetail'
import { TransactionType } from '../../../types'

import { LatestTransactions } from '../LatestTransaction'
import { LatestCycle } from '../LatestCycle'

export const Dashboard: React.FC = () => {
  const { data: cycles } = useCycle({ count: 10 })
  const {
    transactions,
    totalTransferTxs,
    totalMessageTxs,
    totalDepositStakeTxs,
    totalWithdrawStakeTxs,
    totalTransactions,
  } = useTransaction({
    count: 10,
    txType: TransactionType.transfer,
    totalTxsDetail: true,
  })

  const { totalAccounts } = useAccount({ count: 10 })

  const { validatorStats, transactionStats, totalLIB, totalStakedLIB } = useStats({
    validatorStatsCount: 1000,
    transactionStatsCount: 1000,
    fetchCoinStats: true,
  })

  const cyclesList = cycles.map((row) => {
    return {
      key: row?.cycleRecord?.counter ?? -1,
      value: moment(row?.cycleRecord?.start * 1000).calendar(),
      activeNodes: row?.cycleRecord?.active || 0,
      standbyNodes: row?.cycleRecord?.standby || 0,
    }
  })

  return (
    <div className={styles.Dashboard}>
      <Spacer space="32" />
      <SearchBox mode={cycles[0]?.cycleRecord['mode']} />
      <Spacer space="48" />
      <CardDetail
        totalCycles={cyclesList[0]?.key}
        totalNodes={cyclesList[0]?.activeNodes}
        totalStandby={cyclesList[0]?.standbyNodes}
        totalAccounts={totalAccounts}
        totalTransactions={totalTransactions}
        totalTransferTxs={totalTransferTxs}
        totalMessageTxs={totalMessageTxs}
        totalDepositStakeTxs={totalDepositStakeTxs}
        totalWithdrawStakeTxs={totalWithdrawStakeTxs}
        totalLIB={totalLIB}
        totalStakedLIB={totalStakedLIB}
      />
      <Spacer space="48" />
      <ChartDetail validatorStats={validatorStats} transactionStats={transactionStats} />
      <Spacer space="48" />
      <div className={styles.tableGrid}>
        <LatestCycle cycles={cycles} />
        <LatestTransactions transactions={transactions} />
      </div>
      <Spacer space="48" />
    </div>
  )
}
