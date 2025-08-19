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
import { useDexTokenPrice } from '../../api/useDexTokenPrice'
import useAccountDetail from '../../api/useAccountDetail'
import { config } from '../../../config'

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

  const { account: networkAccount } = useAccountDetail(config.networkAccountId)

  const { tokenPrice, marketCap } = useDexTokenPrice()
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
      <NewCardDetail
        totalCycles={cyclesList[0]?.key}
        totalTransactions={totalTransactions}
        tokenPrice={tokenPrice}
        marketCap={marketCap}
        transactionStats={transactionStats}
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
