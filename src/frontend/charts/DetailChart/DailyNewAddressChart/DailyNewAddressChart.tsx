import React from 'react'

import { ContentLayout, DailyStatsChart } from '../../../components'

import styles from './DailyNewAddressChart.module.scss'
import { useStats } from '../../../api'
import { convertAccountStatsToDailyData } from '../../../utils/transformChartData'
import { breadcrumbsList } from '../../../types/routes'

export const DailyNewAddressChart: React.FC = () => {
  const height = 600

  const breadcrumbs = [breadcrumbsList.chart]

  const accountResponseType = 'array'

  const { accountStats, loading } = useStats({
    accountResponseType,
    allDailyAccountReport: true,
  })

  // Calculate highest and lowest
  const getStats = (): {
    highest: { date: string; value: number } | null
    lowest: { date: string; value: number } | null
  } => {
    if (!accountStats || accountStats.length === 0) {
      return { highest: null, lowest: null }
    }

    let highest = { date: '', value: 0 }
    let lowest = { date: '', value: Infinity }

    accountStats.forEach((stat: any) => {
      const timestamp = stat.dateStartTime || stat[0]
      const newAccounts = stat.newAccounts || stat[1]
      const date = new Date(timestamp).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })

      if (newAccounts > highest.value) {
        highest = { date, value: newAccounts }
      }
      if (newAccounts < lowest.value && newAccounts > 0) {
        lowest = { date, value: newAccounts }
      }
    })

    return { highest, lowest }
  }

  const { highest, lowest } = getStats()

  // Tooltip formatter for new addresses
  const tooltipFormatter = (timestamp: number, point: any, Highcharts: any) => {
    const xDate = new Date(timestamp)
    const xDateString = Highcharts.dateFormat('%A, %B %e, %Y', xDate.getTime())
    const dailyIncrease = point.y || 0
    const pointData = point.point || point
    const cumulativeTotal = pointData.cumulativeTotal || 0

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
                data={convertAccountStatsToDailyData(accountStats)}
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
                      recorded on {highest.date}
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
                      recorded on {lowest.date}
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
