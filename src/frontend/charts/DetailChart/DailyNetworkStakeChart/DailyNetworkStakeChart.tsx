import React from 'react'

import { ContentLayout, DailyStatsChart } from '../../../components'

import styles from './DailyNetworkStakeChart.module.scss'
import { useStats } from '../../../api'
import {
  convertDailyCoinStatsToSeriesData,
  NetworkStakeChartData,
  DataPoint,
} from '../../../utils/transformChartData'
import { breadcrumbsList } from '../../../types/routes'

export const DailyNetworkStakeChart: React.FC = () => {
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
    dailyNetworkStake: true,
  })

  // Tooltip formatter for daily network stake
  const tooltipFormatter = (
    timestamp: number,
    point: any,
    Highcharts: typeof import('highcharts')
  ): string => {
    const xDate = new Date(timestamp)
    const xDateString = Highcharts.dateFormat('%A, %B %e, %Y', xDate.getTime())
    const totalStake = point.y || 0

    const pointData = (point.point as DataPoint)?.networkStakeChartData as NetworkStakeChartData
    const stakeAmount = pointData?.stakeAmount || 0
    const unstakeAmount = pointData?.unstakeAmount || 0
    const penaltyAmount = pointData?.penaltyAmount || 0

    return `<div style="font-family: Inter, sans-serif; font-size: 13px;">
      <div style="font-weight: 600; margin-bottom: 8px; color: #333;">
        ${xDateString}
      </div>
      <div style="margin-bottom: 4px;">
        <span style="color: #666;">Total Stake:</span> <span style="font-weight: 600; color: #000;">${totalStake.toLocaleString()} LIB</span>
      </div>
      <div style="border-top: 1px solid #eee; padding-top: 6px; margin-top: 6px;">
        <div style="margin-bottom: 2px;">
          <span style="color: #666;">New Staked Amount:</span> <span style="font-weight: 500; color: #000;">${stakeAmount.toLocaleString()} LIB</span>
        </div>
        <div style="margin-bottom: 2px;">
          <span style="color: #666;">New Unstaked Amount:</span> <span style="font-weight: 500; color: #000;">${unstakeAmount.toLocaleString()} LIB</span>
        </div>
        <div>
          <span style="color: #666;">Penalty Amount:</span> <span style="font-weight: 500; color: #000;">${penaltyAmount.toLocaleString()} LIB</span>
        </div>
      </div>
    </div>`
  }

  return (
    <div className={styles.DailyNetworkStakeChart}>
      <ContentLayout title="Daily Network Stake" breadcrumbItems={breadcrumbs} showBackButton>
        <div className={styles.chartContainer}>
          <div className={styles.chartWrapper}>
            {loading ? (
              <div className={styles.loading}>Loading...</div>
            ) : (
              <DailyStatsChart
                title="Daily Network Stake Chart"
                subTitle="Daily breakdown of staked, unstaked, and penalty amounts to arrive at total network stake"
                height={height}
                data={seriesData}
                yAxisTitle="Staked LIB"
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
                The Network Stake Chart shows a breakdown of daily staked, unstaked, and penalty amounts to
                arrive at the total network stake.
              </p>
              {highest && (
                <div className={styles.highlight}>
                  <div className={styles.highlightIcon}>📍</div>
                  <div className={styles.highlightContent}>
                    <div className={styles.highlightLabel}>HIGHLIGHT</div>
                    <div className={styles.highlightText}>
                      Highest network stake <strong>{highest.value.toLocaleString()} LIB</strong> on{' '}
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
                      Lowest network stake <strong>{lowest.value.toLocaleString()} LIB</strong> on{' '}
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
