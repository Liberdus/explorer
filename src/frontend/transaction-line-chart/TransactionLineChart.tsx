import React from 'react'

import { ContentLayout, StackedLineStockChart } from '../components'

import styles from './TransactionLineChart.module.scss'
import { useStats } from '../api'
import { convertTransactionStatsToSeriesData } from '../utils/transformChartData'
import { config } from './../../config'

export const TransactionLineChart: React.FC = () => {
  const height = 600

  const transactionResponseType = 'array'

  const { transactionStats, loading } = useStats({
    transactionStatsCount: config.requestLimits.MAX_STATS_PER_REQUEST,
    transactionResponseType,
  })

  return (
    <div className={styles.TransactionLineChart}>
      <ContentLayout title="Transactions per Cycle Chart">
        {loading ? (
          <div>Loading...</div>
        ) : (
          <StackedLineStockChart
            title="Transactions per Cycle Chart"
            centerTitle
            subTitle="Click and drag in the plot area to zoom in"
            height={height}
            data={convertTransactionStatsToSeriesData(transactionStats, true, transactionResponseType)}
            name="Transactions"
            groupData
          />
        )}
      </ContentLayout>
    </div>
  )
}
