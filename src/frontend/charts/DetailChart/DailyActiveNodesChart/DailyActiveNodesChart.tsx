import React from 'react'

import { ContentLayout, DailyStatsChart } from '../../../components'

import styles from './DailyActiveNodesChart.module.scss'
import { useStats } from '../../../api'
import {
  convertDailyNetworkStatsToSeriesData,
  ActiveNodesChartData,
  DataPoint,
} from '../../../utils/transformChartData'
import { breadcrumbsList } from '../../../types/routes'

export const DailyActiveNodesChart: React.FC = () => {
  const height = 600

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
    dailyActiveNodes: true,
  })

  // Tooltip formatter for active nodes
  const tooltipFormatter = (
    timestamp: number,
    point: any,
    Highcharts: typeof import('highcharts')
  ): string => {
    const xDate = new Date(timestamp)
    const xDateString = Highcharts.dateFormat('%A, %B %e, %Y', xDate.getTime())
    const activeNodes = point.y || 0

    const pointData = (point.point as DataPoint)?.activeNodesChartData as ActiveNodesChartData
    const standbyNodes = pointData?.standbyNodes || 0

    return `<div style="font-family: Inter, sans-serif; font-size: 13px;">
      <div style="font-weight: 600; margin-bottom: 8px; color: #333;">
        ${xDateString}
      </div>
      <div style="margin-bottom: 4px;">
        <span style="color: #666;">Active Nodes:</span> <span style="font-weight: 600; color: #000;">${activeNodes.toLocaleString()}</span>
      </div>
      <div style="border-top: 1px solid #eee; padding-top: 6px; margin-top: 6px;">
        <div>
          <span style="color: #666;">Standby Nodes:</span> <span style="font-weight: 500; color: #000;">${standbyNodes.toLocaleString()}</span>
        </div>
      </div>
    </div>`
  }

  return (
    <div className={styles.DailyActiveNodesChart}>
      <ContentLayout title="Daily Active Nodes Chart" breadcrumbItems={breadcrumbs} showBackButton>
        <div className={styles.chartContainer}>
          <div className={styles.chartWrapper}>
            {loading ? (
              <div className={styles.loading}>Loading...</div>
            ) : (
              <DailyStatsChart
                title="Daily Active Nodes Chart"
                subTitle="Historical daily active nodes count on the Liberdus Network"
                height={height}
                data={seriesData}
                yAxisTitle="Active Nodes"
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
                The Daily Active Nodes chart shows the daily number of average active nodes on the Liberdus
                Network. Active nodes are validators that are actively participating in consensus.
              </p>
              {highest && (
                <div className={styles.highlight}>
                  <div className={styles.highlightIcon}>📍</div>
                  <div className={styles.highlightContent}>
                    <div className={styles.highlightLabel}>HIGHLIGHT</div>
                    <div className={styles.highlightText}>
                      Highest active nodes count of <strong>{highest.value.toLocaleString()}</strong> on{' '}
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
                      Lowest active nodes count of <strong>{lowest.value.toLocaleString()}</strong> on{' '}
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
                  <div className={styles.currentPriceLabel}>CURRENT ACTIVE NODES</div>
                  <div className={styles.currentPriceValue}>{current.toLocaleString()}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </ContentLayout>
    </div>
  )
}
