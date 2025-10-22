import React from 'react'

import { ContentLayout, DailyStatsChart } from '../../../components'

import styles from './DailyPriceChart.module.scss'
import { useStats } from '../../../api'
import { convertDailyNetworkStatsToSeriesData } from '../../../utils/transformChartData'
import { breadcrumbsList } from '../../../types/routes'

export const DailyPriceChart: React.FC = () => {
  const height = 600
  const priceDecimalPoint = 4

  const breadcrumbs = [breadcrumbsList.chart]

  const networkResponseType = 'array'

  const { dailyNetworkStats, loading } = useStats({
    networkResponseType,
    allDailyNetworkReport: true,
  })

  const {
    seriesData,
    highLight: { highest, lowest, current },
  } = convertDailyNetworkStatsToSeriesData(dailyNetworkStats, networkResponseType, {
    dailyPrice: true,
  })

  // Tooltip formatter for price
  const tooltipFormatter = (
    timestamp: number,
    point: any,
    Highcharts: typeof import('highcharts')
  ): string => {
    const xDate = new Date(timestamp)
    const xDateString = Highcharts.dateFormat('%A, %B %e, %Y', xDate.getTime())
    const price = point.y || 0

    return `<div style="font-family: Inter, sans-serif; font-size: 13px;">
      <div style="font-weight: 600; margin-bottom: 8px; color: #333;">
        ${xDateString}
      </div>
      <div>
        <span style="color: #666;">LIB Price:</span> <span style="font-weight: 600; color: #000;">$${price}</span>
      </div>
    </div>`
  }

  return (
    <div className={styles.DailyPriceChart}>
      <ContentLayout title="LIB Daily Price (USD) Chart" breadcrumbItems={breadcrumbs} showBackButton>
        <div className={styles.chartContainer}>
          <div className={styles.chartWrapper}>
            {loading ? (
              <div className={styles.loading}>Loading...</div>
            ) : (
              <DailyStatsChart
                title="LIB Daily Price (USD) Chart"
                subTitle="Historical daily LIB price in USD"
                height={height}
                data={seriesData}
                yAxisTitle="LIB Price (USD)"
                yAxisDecimals={priceDecimalPoint}
                tooltipFormatter={tooltipFormatter}
              />
            )}
          </div>
          <div className={styles.infoPanel}>
            <div className={styles.infoPanelHeader}>
              <h3>About</h3>
            </div>
            <div className={styles.infoPanelContent}>
              <p>The LIB Daily Price (USD) chart shows the daily historical price for LIB in USD.</p>
              {highest && (
                <div className={styles.highlight}>
                  <div className={styles.highlightIcon}>📍</div>
                  <div className={styles.highlightContent}>
                    <div className={styles.highlightLabel}>HIGHLIGHT</div>
                    <div className={styles.highlightText}>
                      Highest price of <strong>${highest.value}</strong> on{' '}
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
                      Lowest price of <strong>${lowest.value}</strong> on{' '}
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
              {current && current > 0 && (
                <div className={styles.currentPrice}>
                  <div className={styles.currentPriceLabel}>CURRENT LIB PRICE</div>
                  <div className={styles.currentPriceValue}>
                    ${parseFloat(current.toFixed(priceDecimalPoint))}
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
