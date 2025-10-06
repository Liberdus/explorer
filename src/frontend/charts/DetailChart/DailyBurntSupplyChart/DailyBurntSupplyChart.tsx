import React from 'react'

import { ContentLayout, DailyStatsChart } from '../../../components'

import styles from './DailyBurntSupplyChart.module.scss'
import { useStats } from '../../../api'
import {
  convertDailyCoinStatsToSeriesData,
  BurntSupplyChartData,
  DataPoint,
} from '../../../utils/transformChartData'
import { breadcrumbsList } from '../../../types/routes'

export const DailyBurntSupplyChart: React.FC = () => {
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
    dailyBurntSupply: true,
  })

  // Tooltip formatter for daily burnt supply
  const tooltipFormatter = (
    timestamp: number,
    point: any,
    Highcharts: typeof import('highcharts')
  ): string => {
    const xDate = new Date(timestamp)
    const xDateString = Highcharts.dateFormat('%A, %B %e, %Y', xDate.getTime())
    const totalBurnt = point.y || 0

    const pointData = (point.point as DataPoint)?.burntSupplyChartData as BurntSupplyChartData
    const transactionFee = pointData?.transactionFee || 0
    const networkFee = pointData?.networkFee || 0
    const penaltyAmount = pointData?.penaltyAmount || 0

    return `<div style="font-family: Inter, sans-serif; font-size: 13px;">
      <div style="font-weight: 600; margin-bottom: 8px; color: #333;">
        ${xDateString}
      </div>
      <div style="margin-bottom: 4px;">
        <span style="color: #666;">Daily LIB Burnt:</span> <span style="font-weight: 600; color: #000;">${totalBurnt.toLocaleString()} LIB</span>
      </div>
      <div style="border-top: 1px solid #eee; padding-top: 6px; margin-top: 6px;">
        <div style="margin-bottom: 2px;">
          <span style="color: #666;">Transaction Fee:</span> <span style="font-weight: 500; color: #000;">${transactionFee.toLocaleString()} LIB</span>
        </div>
        <div style="margin-bottom: 2px;">
          <span style="color: #666;">Toll Tax Fees:</span> <span style="font-weight: 500; color: #000;">${networkFee.toLocaleString()} LIB</span>
        </div>
        <div>
          <span style="color: #666;">Penalty Amount:</span> <span style="font-weight: 500; color: #000;">${penaltyAmount.toLocaleString()} LIB</span>
        </div>
      </div>
    </div>`
  }

  return (
    <div className={styles.DailyBurntSupplyChart}>
      <ContentLayout title="Daily LIB Burnt" breadcrumbItems={breadcrumbs} showBackButton>
        <div className={styles.chartContainer}>
          <div className={styles.chartWrapper}>
            {loading ? (
              <div className={styles.loading}>Loading...</div>
            ) : (
              <DailyStatsChart
                title="Daily LIB Burnt Chart"
                subTitle="Daily amount of LIB burnt from transaction fees, network toll tax fees, and penalty amounts"
                height={height}
                data={seriesData}
                yAxisTitle="Daily LIB Burnt"
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
                The chart shows the daily amount of LIB burnt ( transaction fees + network toll tax fees +
                penalty amount ).
              </p>
              {lowest && lowest.value !== Infinity && (
                <div className={styles.highlight}>
                  <div className={styles.highlightIcon}>📍</div>
                  <div className={styles.highlightContent}>
                    <div className={styles.highlightLabel}>HIGHLIGHT</div>
                    <div className={styles.highlightText}>
                      Lowest amount of LIB Burnt <strong>{lowest.value.toLocaleString()} LIB</strong> on{' '}
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
                      Highest number of LIB Burnt <strong>{highest.value.toLocaleString()} LIB</strong> on{' '}
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
