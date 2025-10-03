import React from 'react'

import { ContentLayout, DailyStatsChart } from '../../../components'

import styles from './DailyNewAddressChart.module.scss'
import { useStats } from '../../../api'
import {
  convertDailyAccountStatsToSeriesData,
  DataPoint,
  NewAddressChartData,
} from '../../../utils/transformChartData'
import { breadcrumbsList } from '../../../types/routes'

export const DailyNewAddressChart: React.FC = () => {
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
    newAddress: true,
    activeAddress: false,
  })

  // Tooltip formatter for new addresses
  const tooltipFormatter = (
    timestamp: number,
    point: any,
    Highcharts: typeof import('highcharts')
  ): string => {
    const xDate = new Date(timestamp)
    const xDateString = Highcharts.dateFormat('%A, %B %e, %Y', xDate.getTime())
    const cumulativeTotal = point.y || 0
    const pointData = (point.point as DataPoint).newAddressChartData as NewAddressChartData
    const dailyIncrease = pointData?.dailyIncrease || 0

    return `<div style="font-family: Inter, sans-serif; font-size: 13px;">
      <div style="font-weight: 600; margin-bottom: 8px; color: #333;">
        ${xDateString}
      </div>
      <div style="margin-bottom: 4px;">
        <span style="color: #666;">Total Distinct Addresses:</span> <span style="font-weight: 600; color: #000;">${Highcharts.numberFormat(
          cumulativeTotal,
          0
        )}</span>
      </div>
      <div>
        <span style="color: #666;">Daily Increase:</span> <span style="font-weight: 600; color: #000;">${Highcharts.numberFormat(
          dailyIncrease,
          0
        )}</span>
      </div>
    </div>`
  }

  return (
    <div className={styles.DailyNewAddressChart}>
      <ContentLayout title="Liberdus Cumulative Address Growth" breadcrumbItems={breadcrumbs} showBackButton>
        <div className={styles.chartContainer}>
          <div className={styles.chartWrapper}>
            {loading ? (
              <div className={styles.loading}>Loading...</div>
            ) : (
              <DailyStatsChart
                title="Liberdus Unique Addresses Chart"
                subTitle=""
                height={height}
                data={seriesData}
                yAxisTitle="New Addresses Per Day"
                tooltipFormatter={tooltipFormatter}
              />
            )}
          </div>
          <div className={styles.infoPanel}>
            <div className={styles.infoPanelHeader}>
              <h3>About</h3>
            </div>
            <div className={styles.infoPanelContent}>
              <h4 className={styles.sectionTitle}>Liberdus Unique Addresses Chart</h4>
              <p>
                The chart shows the total distinct numbers of address on the Liberdus blockchain and the
                increase in the number of address daily.
              </p>
              {highest && (
                <div className={styles.highlight}>
                  <div className={styles.highlightIcon}>📍</div>
                  <div className={styles.highlightContent}>
                    <div className={styles.highlightLabel}>HIGHLIGHT</div>
                    <div className={styles.highlightText}>
                      Highest increase of <strong>{highest.value.toLocaleString()}</strong> new addresses was
                      recorded on
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
                      Lowest increase of <strong>{lowest.value.toLocaleString()}</strong> new addresses was
                      recorded on
                      {lowest.timestamp}
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
