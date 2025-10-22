import React from 'react'

import { ContentLayout, DailyStatsChart } from '../../../components'

import styles from './DailyAvgTransactionFeeChart.module.scss'
import { useStats } from '../../../api'
import {
  convertDailyCoinStatsToSeriesData,
  AvgTxFeeChartData,
  DataPoint,
} from '../../../utils/transformChartData'
import { breadcrumbsList } from '../../../types/routes'

export const DailyAvgTransactionFeeChart: React.FC = () => {
  const height = 600
  const feeDecimalPoint = 4

  const breadcrumbs = [breadcrumbsList.chart]

  const coinResponseType = 'array'

  const { dailyCoinStats, loading } = useStats({
    coinResponseType,
    allDailyCoinReport: true,
    withTotalTxs: true,
  })

  const {
    seriesData,
    highLight: { highest, lowest },
  } = convertDailyCoinStatsToSeriesData(dailyCoinStats, coinResponseType, {
    dailyAvgTransactionFee: true,
  })

  // Tooltip formatter for average transaction fee
  // Shows calculation: (Total Fee in LIB / Total Txs) × LIB Price = Avg Fee USD
  const tooltipFormatter = (
    timestamp: number,
    point: any,
    Highcharts: typeof import('highcharts')
  ): string => {
    const xDate = new Date(timestamp)
    const xDateString = Highcharts.dateFormat('%A, %B %e, %Y', xDate.getTime())
    const avgFee = point.y || 0

    const pointData = (point.point as DataPoint)?.avgTxFeeChartData as AvgTxFeeChartData
    const priceUSD = pointData?.priceUSD || 0
    const totalTxFee = pointData?.totalTxFee || 0
    const totalUserTxs = pointData?.totalUserTxs || 0

    return `<div style="font-family: Inter, sans-serif; font-size: 13px;">
      <div style="font-weight: 600; margin-bottom: 8px; color: #333;">
        ${xDateString}
      </div>
      <div style="margin-bottom: 4px;">
        <span style="color: #666;">Average Transaction Fee:</span> <span style="font-weight: 600; color: #000;">$${(
          avgFee * priceUSD
        ).toLocaleString()}</span>
      </div>
      <div style="border-top: 1px solid #eee; padding-top: 6px; margin-top: 6px;">
        <div>
          <span style="color: #666;">Txn Fee(LIB):</span> <span style="font-weight: 500; color: #000;">${
            totalTxFee / totalUserTxs || 0
          } LIB</span>
        </div>
      </div>
    </div>`

    // return `<div style="font-family: Inter, sans-serif; font-size: 13px;">
    //   <div style="font-weight: 600; margin-bottom: 8px; color: #333;">
    //     ${xDateString}
    //   </div>
    //   <div style="margin-bottom: 4px;">
    //     <span style="color: #666;">Average Transaction Fee:</span> <span style="font-weight: 600; color: #000;">$${
    //       avgFee * priceUSD
    //     }</span>
    //   </div>
    //   <div style="border-top: 1px solid #eee; padding-top: 6px; margin-top: 6px;">
    //     <div style="margin-bottom: 4px;">
    //       <span style="color: #666;">Total Transaction Fee:</span> <span style="font-weight: 500; color: #000;">${totalTxFee.toLocaleString()} LIB</span>
    //     </div>
    //     <div style="margin-bottom: 4px;">
    //       <span style="color: #666;">Total Transactions:</span> <span style="font-weight: 500; color: #000;">${totalUserTxs.toLocaleString()}</span>
    //     </div>
    //     <div>
    //       <span style="color: #666;">LIB Price Set:</span> <span style="font-weight: 500; color: #000;">$${priceUSD}</span>
    //     </div>
    //   </div>
    //   <div style="border-top: 1px solid #eee; padding-top: 6px; margin-top: 6px; font-size: 11px; color: #888;">
    //     <div style="font-style: italic;">
    //       Calculation: (${totalTxFee} LIB / ${totalUserTxs.toLocaleString()} txs) × $${priceUSD} = $${avgFee}
    //     </div>
    //   </div>
    // </div>`
  }

  return (
    <div className={styles.DailyAvgTransactionFeeChart}>
      <ContentLayout title="Average Transaction Fee Chart" breadcrumbItems={breadcrumbs} showBackButton>
        <div className={styles.chartContainer}>
          <div className={styles.chartWrapper}>
            {loading ? (
              <div className={styles.loading}>Loading...</div>
            ) : (
              <DailyStatsChart
                title="Average Transaction Fee Chart"
                subTitle="Daily average amount in USD spent per transaction"
                height={height}
                data={seriesData}
                yAxisTitle="Average Transaction Fee (USD)"
                yAxisDecimals={feeDecimalPoint}
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
                The chart shows the daily average amount in USD spent per transaction on the Liberdus network.
              </p>
              {highest && (
                <div className={styles.highlight}>
                  <div className={styles.highlightIcon}>📍</div>
                  <div className={styles.highlightContent}>
                    <div className={styles.highlightLabel}>HIGHLIGHT</div>
                    <div className={styles.highlightText}>
                      Highest average transaction fee of{' '}
                      <strong>${parseFloat(highest.value.toFixed(feeDecimalPoint))}</strong> on{' '}
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
                      Lowest average transaction fee of{' '}
                      <strong>${parseFloat(lowest.value.toFixed(feeDecimalPoint))}</strong> on{' '}
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
