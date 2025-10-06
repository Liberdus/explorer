import React from 'react'

import { ContentLayout, DailyStatsChart } from '../../../components'

import styles from './DailyDistributedSupplyChart.module.scss'
import { useStats } from '../../../api'
import {
  convertDailyCoinStatsToSeriesData,
  DistributedSupplyChartData,
  DataPoint,
} from '../../../utils/transformChartData'
import { breadcrumbsList } from '../../../types/routes'

export const DailyDistributedSupplyChart: React.FC = () => {
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
    dailyDistributedSupply: true,
  })

  // Tooltip formatter for daily distributed supply
  const tooltipFormatter = (
    timestamp: number,
    point: any,
    Highcharts: typeof import('highcharts')
  ): string => {
    const xDate = new Date(timestamp)
    const xDateString = Highcharts.dateFormat('%A, %B %e, %Y', xDate.getTime())
    const totalDistributed = point.y || 0

    const pointData = (point.point as DataPoint)?.distributedSupplyChartData as DistributedSupplyChartData
    const mintedCoin = pointData?.mintedCoin || 0
    const rewardAmountRealized = pointData?.rewardAmountRealized || 0

    return `<div style="font-family: Inter, sans-serif; font-size: 13px;">
      <div style="font-weight: 600; margin-bottom: 8px; color: #333;">
        ${xDateString}
      </div>
      <div style="margin-bottom: 4px;">
        <span style="color: #666;">Daily LIB Distributed:</span> <span style="font-weight: 600; color: #000;">${totalDistributed.toLocaleString()} LIB</span>
      </div>
      <div style="border-top: 1px solid #eee; padding-top: 6px; margin-top: 6px;">
        <div style="margin-bottom: 2px;">
          <span style="color: #666;">Minted Amount:</span> <span style="font-weight: 500; color: #000;">${mintedCoin.toLocaleString()} LIB</span>
        </div>
        <div style="margin-bottom: 2px;">
          <span style="color: #666;">Node Reward Collected:</span> <span style="font-weight: 500; color: #000;">${rewardAmountRealized.toLocaleString()} LIB</span>
        </div>
      </div>
    </div>`
  }

  return (
    <div className={styles.DailyDistributedSupplyChart}>
      <ContentLayout title="Daily LIB Distributed" breadcrumbItems={breadcrumbs} showBackButton>
        <div className={styles.chartContainer}>
          <div className={styles.chartWrapper}>
            {loading ? (
              <div className={styles.loading}>Loading...</div>
            ) : (
              <DailyStatsChart
                title="Daily LIB Distributed Chart"
                subTitle="Daily amount of LIB distributed as minted coins to newly created accounts and node rewards collected by nominators"
                height={height}
                data={seriesData}
                yAxisTitle="Daily LIB Distributed"
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
                The chart shows the daily amount of LIB Distributed ( minted LIB to the newly created
                accounts, node rewards collected by the nominator ).
              </p>
              {lowest && lowest.value !== Infinity && (
                <div className={styles.highlight}>
                  <div className={styles.highlightIcon}>📍</div>
                  <div className={styles.highlightContent}>
                    <div className={styles.highlightLabel}>HIGHLIGHT</div>
                    <div className={styles.highlightText}>
                      Lowest amount of LIB Distributed <strong>{lowest.value.toLocaleString()} LIB</strong> on{' '}
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
                      Highest number of LIB Distributed <strong>{highest.value.toLocaleString()} LIB</strong>{' '}
                      on{' '}
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
