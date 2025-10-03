import React from 'react'

import { ContentLayout, DailyStatsChart } from '../../../components'

import styles from './DailyActiveAddressChart.module.scss'
import { useStats } from '../../../api'
import { convertActiveAccountStatsToDailyData } from '../../../utils/transformChartData'
import { breadcrumbsList } from '../../../types/routes'

export const DailyActiveAddressChart: React.FC = () => {
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
      const activeAccounts = stat.activeAccounts || stat[3]
      const date = new Date(timestamp).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })

      if (activeAccounts > highest.value) {
        highest = { date, value: activeAccounts }
      }
      if (activeAccounts < lowest.value) {
        lowest = { date, value: activeAccounts }
      }
    })

    return { highest, lowest }
  }

  const { highest, lowest } = getStats()

  // Tooltip formatter for active addresses
  const tooltipFormatter = (timestamp: number, point: any, Highcharts: any) => {
    const xDate = new Date(timestamp)
    const xDateString = Highcharts.dateFormat('%A, %B %e, %Y', xDate.getTime())
    const activeAddresses = point.y || 0

    return `<div style="font-family: Inter, sans-serif; font-size: 13px;">
      <div style="font-weight: 600; margin-bottom: 8px; color: #333;">
        ${xDateString}
      </div>
      <div>
        <span style="color: #666;">Active Liberdus Addresses:</span> <span style="font-weight: 600; color: #000;">${Highcharts.numberFormat(
          activeAddresses,
          0
        )}</span>
      </div>
    </div>`
  }

  return (
    <div className={styles.DailyActiveAddressChart}>
      <ContentLayout title="Active Liberdus Addresses" breadcrumbItems={breadcrumbs} showBackButton>
        <div className={styles.chartContainer}>
          <div className={styles.chartWrapper}>
            {loading ? (
              <div className={styles.loading}>Loading...</div>
            ) : (
              <DailyStatsChart
                title="Active Liberdus Addresses"
                subTitle=""
                height={height}
                data={convertActiveAccountStatsToDailyData(accountStats)}
                yAxisTitle="Active Addresses"
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
                The Active Liberdus Address chart shows the daily number of unique addresses that were active
                on the network as a sender or receiver.
              </p>
              {lowest && lowest.value !== Infinity && (
                <div className={styles.highlight}>
                  <div className={styles.highlightIcon}>📍</div>
                  <div className={styles.highlightContent}>
                    <div className={styles.highlightLabel}>HIGHLIGHT</div>
                    <div className={styles.highlightText}>
                      Lowest number of <strong>{lowest.value.toLocaleString()}</strong> addresses on{' '}
                      {lowest.date}
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
                      Highest number of <strong>{highest.value.toLocaleString()}</strong> addresses on{' '}
                      {highest.date}
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
