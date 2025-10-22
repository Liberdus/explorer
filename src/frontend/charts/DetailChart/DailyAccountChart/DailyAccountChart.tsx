import React from 'react'

import { ContentLayout, DailyStatsChart } from '../../../components'
import styles from './DailyAccountChart.module.scss'
import { useStats } from '../../../api'
import {
  convertDailyAccountStatsToSeriesData,
  DataPoint,
  AccountChartData,
} from '../../../utils/transformChartData'
import { breadcrumbsList } from '../../../types/routes'

export const DailyAccountChart: React.FC = () => {
  const height = 600

  const breadcrumbs = [breadcrumbsList.chart]

  const accountResponseType = 'array'

  const { dailyAccountStats, loading } = useStats({
    accountResponseType,
    allDailyAccountReport: true,
  })

  const {
    seriesData,
    highLight: { highest, lowest },
  } = convertDailyAccountStatsToSeriesData(dailyAccountStats, accountResponseType, {
    newAccount: true,
  })

  // Tooltip formatter for total accounts
  const tooltipFormatter = (
    timestamp: number,
    point: any,
    Highcharts: typeof import('highcharts')
  ): string => {
    const xDate = new Date(timestamp)
    const xDateString = Highcharts.dateFormat('%A, %B %e, %Y', xDate.getTime())
    const totalAccounts = point.y || 0

    const pointData = (point.point as DataPoint)?.accountChartData as AccountChartData
    const newUsers = pointData?.newUsers || 0

    return `<div style="font-family: Inter, sans-serif; font-size: 13px;">
      <div style="font-weight: 600; margin-bottom: 8px; color: #333;">
        ${xDateString}
      </div>
      <div style="margin-bottom: 4px;">
        <span style="color: #666;">Total Accounts:</span> <span style="font-weight: 600; color: #000;">${Highcharts.numberFormat(
          totalAccounts,
          0
        )}</span>
      </div>
      <div>
        <span style="color: #666;">New Users:</span> <span style="font-weight: 600; color: #000;">${Highcharts.numberFormat(
          newUsers,
          0
        )}</span>
      </div>
    </div>`
  }

  return (
    <div className={styles.DailyAccountChart}>
      <ContentLayout title="Liberdus Accounts" breadcrumbItems={breadcrumbs} showBackButton>
        <div className={styles.chartContainer}>
          <div className={styles.chartWrapper}>
            {loading ? (
              <div className={styles.loading}>Loading...</div>
            ) : (
              <DailyStatsChart
                title="Liberdus Accounts"
                subTitle=""
                height={height}
                data={seriesData}
                yAxisTitle="Accounts"
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
                The Liberdus Accounts chart shows the cumulative number of user accounts that created in the
                network.
              </p>
              {highest && (
                <div className={styles.highlight}>
                  <div className={styles.highlightIcon}>📍</div>
                  <div className={styles.highlightContent}>
                    <div className={styles.highlightLabel}>HIGHLIGHT</div>
                    <div className={styles.highlightText}>
                      Highest number of new users <strong>{highest.value.toLocaleString()}</strong> on{' '}
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
                      Lowest number of new users <strong>{lowest.value.toLocaleString()}</strong> on{' '}
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
