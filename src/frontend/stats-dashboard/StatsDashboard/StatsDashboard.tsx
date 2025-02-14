import React from 'react'
import moment from 'moment'

import { CardDetail } from '../CardDetail'
import { Spacer, ContentLayout } from '../../components'
import { breadcrumbsList } from '../../types'

import { useCycle, useTransaction, useAccount, useStats } from '../../api'
import styles from './StatsDashboard.module.scss'
import { ChartDetail } from '../ChartDetail'
import { TransactionSearchParams } from '../../../types'

export const StatsDashboard: React.FC = () => {
  const breadcrumbs = [breadcrumbsList.dashboard]
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
    <div className={styles.StatsDashboard}>
      <ContentLayout title="Stats Dashboard" breadcrumbItems={breadcrumbs} showBackButton>
        <Spacer space="32" />
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
      </ContentLayout>
    </div>
  )
}
