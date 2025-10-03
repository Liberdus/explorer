import React from 'react'

import { ContentLayout, DailyStatsChart } from '../../../components'

import styles from './DailyMarketCapChart.module.scss'
import { useStats } from '../../../api'
import {
  convertDailyCoinStatsToSeriesData,
  DataPoint,
  MarketCapChartData,
} from '../../../utils/transformChartData'
import { breadcrumbsList } from '../../../types/routes'

export const DailyMarketCapChart: React.FC = () => {
  const height = 600
  const priceDecimalPoint = 4

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
    dailyMarketCap: true,
  })

  // Tooltip formatter for market cap
  const tooltipFormatter = (
    timestamp: number,
    point: any,
    Highcharts: typeof import('highcharts')
  ): string => {
    const xDate = new Date(timestamp)
    const xDateString = Highcharts.dateFormat('%A, %B %e, %Y', xDate.getTime())
    const marketCap = point.y || 0
    const pointData = (point.point as DataPoint).marketCapChartData as MarketCapChartData
    const priceUSD = pointData?.priceUSD || 0

    return `<div style="font-family: Inter, sans-serif; font-size: 13px;">
      <div style="font-weight: 600; margin-bottom: 6px; color: #333;">
        ${xDateString}
      </div>
      <div style="margin-bottom: 4px;">
        <span style="color: #666;">Total Value:</span> <span style="font-weight: 600; color: #000;">$${parseFloat(
          marketCap.toFixed(priceDecimalPoint)
        )}</span>
      </div>
      <div style="border-top: 1px solid #eee; padding-top: 6px; margin-top: 6px;">
        <div style="margin-bottom: 2px;">
          <span style="color: #666;">Market Cap:</span> <span style="font-weight: 500; color: #000;">$${parseFloat(
            marketCap.toFixed(2) // show 2 decimal points
          )}</span>
        </div>
        <div>
          <span style="color: #666;">Avg Price/LIB:</span> <span style="font-weight: 500; color: #000;">$${priceUSD}</span>
        </div>
      </div>
    </div>`
  }

  return (
    <div className={styles.DailyMarketCapChart}>
      <ContentLayout title="LIB Market Cap (USD)" breadcrumbItems={breadcrumbs} showBackButton>
        <div className={styles.chartContainer}>
          <div className={styles.chartWrapper}>
            {loading ? (
              <div className={styles.loading}>Loading...</div>
            ) : (
              <DailyStatsChart
                title="LIB Market Capitalization Chart"
                subTitle="Historical breakdown of LIB daily market capitalization and average price"
                height={height}
                data={seriesData}
                yAxisTitle="Market Cap (USD)"
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
                The LIB Market Capitalization chart shows the historical breakdown of LIB daily market
                capitalization and average price.
              </p>
              {highest && (
                <div className={styles.highlight}>
                  <div className={styles.highlightIcon}>📍</div>
                  <div className={styles.highlightContent}>
                    <div className={styles.highlightLabel}>HIGHLIGHT</div>
                    <div className={styles.highlightText}>
                      Highest market cap of <strong>${highest.value.toLocaleString()}</strong> on{' '}
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
                      Lowest market cap of <strong>${lowest.value.toLocaleString()}</strong> on
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
