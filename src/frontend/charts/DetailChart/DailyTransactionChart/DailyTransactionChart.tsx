import React from 'react'

import { ContentLayout, DailyStatsChart } from '../../../components'

import styles from './DailyTransactionChart.module.scss'
import { useStats } from '../../../api'
import { convertTransactionStatsToDailyData } from '../../../utils/transformChartData'
import { breadcrumbsList } from '../../../types/routes'

export const DailyTransactionChart: React.FC = () => {
  const height = 600

  const breadcrumbs = [breadcrumbsList.chart]

  const transactionResponseType = 'array'

  const { transactionStats, loading } = useStats({
    transactionResponseType,
    allDailyTxsReport: true,
  })

  // Calculate highest and lowest transactions
  const getHighestLowest = (): {
    highest: { date: string; value: number } | null
    lowest: { date: string; value: number } | null
  } => {
    if (!transactionStats || transactionStats.length === 0) {
      return { highest: null, lowest: null }
    }

    let highest = { date: '', value: 0 }
    let lowest = { date: '', value: Infinity }

    transactionStats.forEach((stat: any) => {
      const timestamp = stat.timestamp || stat[0]
      const total = stat.totalTxs || stat[1]
      const date = new Date(timestamp).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })

      if (total > highest.value) {
        highest = { date, value: total }
      }
      if (total < lowest.value && total > 0) {
        lowest = { date, value: total }
      }
    })

    return { highest, lowest }
  }

  const { highest, lowest } = getHighestLowest()

  // Tooltip formatter for transactions
  const tooltipFormatter = (timestamp: number, point: any, Highcharts: any) => {
    const xDate = new Date(timestamp)
    const xDateString = Highcharts.dateFormat('%A, %B %e, %Y', xDate.getTime())
    const value = point.y || 0

    // Extract transaction type data from the point
    const pointData = point.point || point
    const transferTxs = pointData.transferTxs || 0
    const messageTxs = pointData.messageTxs || 0
    const depositStakeTxs = pointData.depositStakeTxs || 0
    const withdrawStakeTxs = pointData.withdrawStakeTxs || 0

    return `<div style="font-family: Inter, sans-serif; font-size: 13px;">
      <div style="font-weight: 600; margin-bottom: 6px; color: #333;">
        ${xDateString}
      </div>
      <div style="margin-bottom: 4px;">
        <span style="color: #666;">Total Txs:</span> <span style="font-weight: 600; color: #000;">${Highcharts.numberFormat(
          value,
          0
        )}</span>
      </div>
      <div style="border-top: 1px solid #eee; padding-top: 6px; margin-top: 6px;">
        <div style="margin-bottom: 2px;">
          <span style="color: #666;">Transfer:</span> <span style="font-weight: 500; color: #000;">${Highcharts.numberFormat(
            transferTxs,
            0
          )}</span>
        </div>
        <div style="margin-bottom: 2px;">
          <span style="color: #666;">Message:</span> <span style="font-weight: 500; color: #000;">${Highcharts.numberFormat(
            messageTxs,
            0
          )}</span>
        </div>
        <div style="margin-bottom: 2px;">
          <span style="color: #666;">Deposit Stake:</span> <span style="font-weight: 500; color: #000;">${Highcharts.numberFormat(
            depositStakeTxs,
            0
          )}</span>
        </div>
        <div>
          <span style="color: #666;">Withdraw Stake:</span> <span style="font-weight: 500; color: #000;">${Highcharts.numberFormat(
            withdrawStakeTxs,
            0
          )}</span>
        </div>
      </div>
    </div>`
  }

  return (
    <div className={styles.DailyTransactionChart}>
      <ContentLayout title="Daily Transactions" breadcrumbItems={breadcrumbs} showBackButton>
        <div className={styles.chartContainer}>
          <div className={styles.chartWrapper}>
            {loading ? (
              <div className={styles.loading}>Loading...</div>
            ) : (
              <DailyStatsChart
                title="Liberdus Daily Transactions Chart"
                subTitle="Historical daily transaction data with breakdown by transaction type"
                height={height}
                data={convertTransactionStatsToDailyData(transactionStats)}
                yAxisTitle="Transactions Per Day"
                tooltipFormatter={tooltipFormatter}
              />
            )}
          </div>
          <div className={styles.infoPanel}>
            <div className={styles.infoPanelHeader}>
              <h3>About</h3>
            </div>
            <div className={styles.infoPanelContent}>
              <p>
                The chart highlights the total number of transactions on the Liberdus blockchain with daily
                individual breakdown for average difficulty, estimated hash rate, average block time and size,
                total block and uncle block count and total new address seen.
              </p>
              {highest && (
                <div className={styles.highlight}>
                  <div className={styles.highlightIcon}>📍</div>
                  <div className={styles.highlightContent}>
                    <div className={styles.highlightLabel}>HIGHLIGHT</div>
                    <div className={styles.highlightText}>
                      Highest number of <strong>{highest.value.toLocaleString()}</strong> transactions on{' '}
                      {highest.date}
                    </div>
                  </div>
                </div>
              )}
              {lowest && lowest.value !== Infinity && (
                <div className={styles.highlight}>
                  <div className={styles.highlightIcon}>📍</div>
                  <div className={styles.highlightContent}>
                    <div className={styles.highlightLabel}>HIGHLIGHT</div>
                    <div className={styles.highlightText}>
                      Lowest number of <strong>{lowest.value.toLocaleString()}</strong> transactions on{' '}
                      {lowest.date}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </ContentLayout>
    </div>
  )
}
