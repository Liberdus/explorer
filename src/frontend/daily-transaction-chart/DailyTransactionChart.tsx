import React from 'react'

import { ContentLayout } from '../components'
import { DailyTransactionChart as DailyTransactionChartComponent } from '../components/Chart/LineChart/DailyTransactionChart'

import styles from './DailyTransactionChart.module.scss'
import { useStats } from '../api'
import { convertTransactionStatsToDailyData } from '../utils/transformChartData'

export const DailyTransactionChart: React.FC = () => {
  const height = 600

  const transactionResponseType = 'array'

  const { transactionStats, loading } = useStats({
    transactionResponseType,
    allDailyTxsReport: true,
  })

  return (
    <div className={styles.DailyTransactionChart}>
      <ContentLayout title="Daily Transactions">
        {/* <div className={styles.controls}>
          <div className={styles.timeRangeSelector}>
            <button
              className={`${styles.rangeButton} ${timeRange === 14 ? styles.active : ''}`}
              onClick={() => handleTimeRangeChange(14)}
            >
              14 Days
            </button>
            <button
              className={`${styles.rangeButton} ${timeRange === 30 ? styles.active : ''}`}
              onClick={() => handleTimeRangeChange(30)}
            >
              30 Days
            </button>
            <button
              className={`${styles.rangeButton} ${timeRange === 60 ? styles.active : ''}`}
              onClick={() => handleTimeRangeChange(60)}
            >
              60 Days
            </button>
          </div>
        </div> */}

        {loading ? (
          <div className={styles.loading}>Loading...</div>
        ) : (
          <DailyTransactionChartComponent
            title="Daily Transactions Chart"
            subTitle="Historical daily transaction data with breakdown by transaction type"
            height={height}
            data={convertTransactionStatsToDailyData(transactionStats)}
            name="Daily Transactions"
          />
        )}
      </ContentLayout>
    </div>
  )
}
