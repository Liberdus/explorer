import React from 'react'

import { ContentLayout, DailyStatsChart } from '../../../components'

import styles from './DailyTransactionFeeChart.module.scss'
import { useStats } from '../../../api'
import { convertDailyCoinStatsToSeriesData } from '../../../utils/transformChartData'
import { breadcrumbsList } from '../../../types/routes'

export const DailyTransactionFeeChart: React.FC = () => {
  const height = 600

  const breadcrumbs = [breadcrumbsList.chart]

  const coinResponseType = 'array'

  const { dailyCoinStats, loading } = useStats({
    coinResponseType,
    allDailyCoinReport: true,
  })

  const {
    seriesData,
    stats: { highest, lowest },
  } = convertDailyCoinStatsToSeriesData(dailyCoinStats, coinResponseType, {
    dailyTransactionFee: true,
  })

  // Tooltip formatter for transaction fee
  const tooltipFormatter = (
    timestamp: number,
    point: any,
    Highcharts: typeof import('highcharts')
  ): string => {
    const xDate = new Date(timestamp)
    const xDateString = Highcharts.dateFormat('%A, %B %e, %Y', xDate.getTime())
    const txnFee = point.y || 0

    return `<div style="font-family: Inter, sans-serif; font-size: 13px;">
      <div style="font-weight: 600; margin-bottom: 8px; color: #333;">
        ${xDateString}
      </div>
      <div>
        <span style="color: #666;">Txn Fee (LIB):</span> <span style="font-weight: 600; color: #000;">${txnFee.toLocaleString()}</span>
      </div>
    </div>`
  }

  return (
    <div className={styles.DailyTransactionFeeChart}>
      <ContentLayout title="Txn Fee (LIB)" breadcrumbItems={breadcrumbs} showBackButton>
        <div className={styles.chartContainer}>
          <div className={styles.chartWrapper}>
            {loading ? (
              <div className={styles.loading}>Loading...</div>
            ) : (
              <DailyStatsChart
                title="Liberdus Network Transaction Fee Chart"
                subTitle="Historical total number of LIB paid as transaction fee"
                height={height}
                data={seriesData}
                yAxisTitle="Transaction Fee (LIB)"
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
                The Liberdus Network Transaction Fee Chart shows historical total number of LIB paid as
                transaction fee for the Liberdus network.
              </p>
              {lowest && lowest.value !== Infinity && (
                <div className={styles.highlight}>
                  <div className={styles.highlightIcon}>📍</div>
                  <div className={styles.highlightContent}>
                    <div className={styles.highlightLabel}>HIGHLIGHT</div>
                    <div className={styles.highlightText}>
                      Lowest transaction fee of <strong>{lowest.value.toLocaleString()} LIB</strong> on{' '}
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
              {highest && (
                <div className={styles.highlight}>
                  <div className={styles.highlightIcon}>📍</div>
                  <div className={styles.highlightContent}>
                    <div className={styles.highlightLabel}>HIGHLIGHT</div>
                    <div className={styles.highlightText}>
                      Highest transaction fee of <strong>{highest.value.toLocaleString()} LIB</strong> on{' '}
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
            </div>
          </div>
        </div>
      </ContentLayout>
    </div>
  )
}
