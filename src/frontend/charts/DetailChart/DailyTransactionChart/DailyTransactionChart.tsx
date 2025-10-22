import React from 'react'

import { ContentLayout, DailyStatsChart } from '../../../components'

import styles from './DailyTransactionChart.module.scss'
import { useStats } from '../../../api'
import {
  convertDailyTransactionStatsToSeriesData,
  DailyTxsChartData,
  DataPoint,
} from '../../../utils/transformChartData'
import { breadcrumbsList } from '../../../types/routes'
import { DailyTransactionStats } from '../../../../stats/dailyTransactionStats'

export const DailyTransactionChart: React.FC = () => {
  const height = 600

  const breadcrumbs = [breadcrumbsList.chart]

  const transactionResponseType = 'array'

  const { transactionStats, loading } = useStats({
    transactionResponseType,
    allDailyTxsReport: true,
  })

  const {
    seriesData,
    highLight: { highest, lowest },
  } = convertDailyTransactionStatsToSeriesData(
    transactionStats as DailyTransactionStats[],
    transactionResponseType
  )

  // Tooltip formatter for transactions
  const tooltipFormatter = (
    timestamp: number,
    point: any,
    Highcharts: typeof import('highcharts')
  ): string => {
    const xDate = new Date(timestamp)
    const xDateString = Highcharts.dateFormat('%A, %B %e, %Y', xDate.getTime())
    const value = point.y || 0

    const pointData = (point.point as DataPoint)?.dailyTxsChartData as DailyTxsChartData
    const transferTxs = pointData.transferTxs || 0
    const messageTxs = pointData.messageTxs || 0
    const stakingTxs = pointData.stakingTxs || 0
    const otherTxs = pointData.otherTxs || 0

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
          <span style="color: #666;">Transfer Txs :  </span> <span style="font-weight: 500; color: #000;">${Highcharts.numberFormat(
            transferTxs,
            0
          )}</span>
        </div>
        <div style="margin-bottom: 2px;">
          <span style="color: #666;">Message Txs : </span> <span style="font-weight: 500; color: #000;">${Highcharts.numberFormat(
            messageTxs,
            0
          )}</span>
        </div>
        <div style="margin-bottom: 2px;">
          <span style="color: #666;">Staking Txs : </span> <span style="font-weight: 500; color: #000;">${Highcharts.numberFormat(
            stakingTxs,
            0
          )}</span>
        </div>
        <div>
          <span style="color: #666;">Other Txs :</span> <span style="font-weight: 500; color: #000;">${Highcharts.numberFormat(
            otherTxs,
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
                data={seriesData}
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
                The chart highlights the total number of transactions on the Liberdus network with daily
                breakdown by transaction type (transfer, message, staking, others).
              </p>
              {highest && (
                <div className={styles.highlight}>
                  <div className={styles.highlightIcon}>📍</div>
                  <div className={styles.highlightContent}>
                    <div className={styles.highlightLabel}>HIGHLIGHT</div>
                    <div className={styles.highlightText}>
                      Highest number of <strong>{highest.value.toLocaleString()}</strong> transactions on{' '}
                      {new Date(highest.timestamp).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
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
                      {new Date(lowest.timestamp).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
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
