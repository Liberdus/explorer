import React from 'react'

import { ContentLayout, DailyStatsChart } from '../../../components'
import styles from './DailyActiveAccountChart.module.scss'
import { useStats } from '../../../api'
import { convertDailyAccountStatsToSeriesData } from '../../../utils/transformChartData'
import { breadcrumbsList } from '../../../types/routes'

export const DailyActiveAccountChart: React.FC = () => {
  const height = 600

  const breadcrumbs = [breadcrumbsList.chart]

  const accountResponseType = 'array'

  const { dailyAccountStats, loading } = useStats({
    accountResponseType,
    allDailyAccountReport: true,
  })

  const {
    seriesData,
    stats: { highest, lowest },
  } = convertDailyAccountStatsToSeriesData(dailyAccountStats, accountResponseType, {
    newAddress: false,
    activeAccount: true,
  })

  // Tooltip formatter for active accounts
  const tooltipFormatter = (
    timestamp: number,
    point: any,
    Highcharts: typeof import('highcharts')
  ): string => {
    const xDate = new Date(timestamp)
    const xDateString = Highcharts.dateFormat('%A, %B %e, %Y', xDate.getTime())
    const activeAccounts = point.y || 0

    return `<div style="font-family: Inter, sans-serif; font-size: 13px;">
      <div style="font-weight: 600; margin-bottom: 8px; color: #333;">
        ${xDateString}
      </div>
      <div>
        <span style="color: #666;">Active Liberdus Accounts :</span> <span style="font-weight: 600; color: #000;">${Highcharts.numberFormat(
          activeAccounts,
          0
        )}</span>
      </div>
    </div>`
  }

  return (
    <div className={styles.DailyActiveAccountChart}>
      <ContentLayout title="Active Liberdus Accounts" breadcrumbItems={breadcrumbs} showBackButton>
        <div className={styles.chartContainer}>
          <div className={styles.chartWrapper}>
            {loading ? (
              <div className={styles.loading}>Loading...</div>
            ) : (
              <DailyStatsChart
                title="Active Liberdus Accounts"
                subTitle=""
                height={height}
                data={seriesData}
                yAxisTitle="Active Accounts"
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
                The Active Liberdus Accounts chart shows the daily number of unique accounts that were active
                on the network as a transaction sender.
              </p>
              {highest && (
                <div className={styles.highlight}>
                  <div className={styles.highlightIcon}>📍</div>
                  <div className={styles.highlightContent}>
                    <div className={styles.highlightLabel}>HIGHLIGHT</div>
                    <div className={styles.highlightText}>
                      Highest number of <strong>{highest.value.toLocaleString()}</strong> accounts on{' '}
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
                      Lowest number of <strong>{lowest.value.toLocaleString()}</strong> accounts on{' '}
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
