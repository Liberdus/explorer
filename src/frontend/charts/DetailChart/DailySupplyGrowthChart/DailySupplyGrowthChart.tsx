import React from 'react'

import { ContentLayout, DailyStatsChart } from '../../../components'

import styles from './DailySupplyGrowthChart.module.scss'
import { useStats } from '../../../api'
import {
  convertDailyCoinStatsToSeriesData,
  DataPoint,
  SupplyGrowthChartData,
} from '../../../utils/transformChartData'
import { breadcrumbsList } from '../../../types/routes'

export const DailySupplyGrowthChart: React.FC = () => {
  const height = 600

  const breadcrumbs = [breadcrumbsList.chart]

  const coinResponseType = 'array'

  const { dailyCoinStats, loading } = useStats({
    coinResponseType,
    allDailyCoinReport: true,
  })

  const { seriesData } = convertDailyCoinStatsToSeriesData(dailyCoinStats, coinResponseType, {
    dailySupplyGrowth: true,
  })

  // Tooltip formatter for supply growth
  const tooltipFormatter = (
    timestamp: number,
    point: any,
    Highcharts: typeof import('highcharts')
  ): string => {
    const xDate = new Date(timestamp)
    const xDateString = Highcharts.dateFormat('%A, %B %e, %Y', xDate.getTime())
    const totalSupply = point.y || 0

    const pointData = (point.point as DataPoint)?.supplyGrowthChartData as SupplyGrowthChartData

    const mintedCoin = pointData?.mintedCoin || 0
    const rewardAmountRealized = pointData?.rewardAmountRealized || 0
    const transactionFee = pointData?.transactionFee || 0
    const networkFee = pointData?.networkFee || 0
    const penaltyAmount = pointData?.penaltyAmount || 0
    const totalSupplyChange = pointData?.totalSupplyChange || 0

    return `<div style="font-family: Inter, sans-serif; font-size: 13px;">
      <div style="font-weight: 600; margin-bottom: 6px; color: #333;">
        ${xDateString}
      </div>
      <div style="margin-bottom: 4px;">
        <span style="color: #666;">Total LIB Supply:</span> <span style="font-weight: 600; color: #000;">${Highcharts.numberFormat(
          totalSupply,
          2
        )} LIB</span>
      </div>
      <div style="border-top: 1px solid #eee; padding-top: 6px; margin-top: 6px;">
        <div style="margin-bottom: 2px; color: #28a745;">
          + <span style="color: #666;">Daily Minted LIB:</span> <span style="font-weight: 500; color: #000;">${Highcharts.numberFormat(
            mintedCoin,
            2
          )} LIB</span>
        </div>
        <div style="margin-bottom: 2px; color: #28a745;">
          + <span style="color: #666;">Daily Realized Rewards:</span> <span style="font-weight: 500; color: #000;">${Highcharts.numberFormat(
            rewardAmountRealized,
            2
          )} LIB</span>
        </div>
        <div style="margin-bottom: 2px; color: #dc3545;">
          - <span style="color: #666;">Daily Transaction Fees:</span> <span style="font-weight: 500; color: #000;">${Highcharts.numberFormat(
            transactionFee,
            2
          )} LIB</span>
        </div>
        <div style="margin-bottom: 2px; color: #dc3545;">
          - <span style="color: #666;">Daily Toll Tax Fees:</span> <span style="font-weight: 500; color: #000;">${Highcharts.numberFormat(
            networkFee,
            2
          )} LIB</span>
        </div>
        <div style="margin-bottom: 2px; color: #dc3545;">
          - <span style="color: #666;">Daily Penalty:</span> <span style="font-weight: 500; color: #000;">${Highcharts.numberFormat(
            penaltyAmount,
            2
          )} LIB</span>
        </div>
        <div style="border-top: 1px solid #eee; padding-top: 6px; margin-top: 6px;">
          = <span style="color: #666;">Total:</span> <span style="font-weight: 600; color: #000;">${Highcharts.numberFormat(
            totalSupplyChange,
            2
          )} LIB</span>
        </div>
      </div>
    </div>`
  }

  return (
    <div className={styles.DailySupplyGrowthChart}>
      <ContentLayout title="LIB Supply Growth Chart" breadcrumbItems={breadcrumbs} showBackButton>
        <div className={styles.chartContainer}>
          <div className={styles.chartWrapper}>
            {loading ? (
              <div className={styles.loading}>Loading...</div>
            ) : (
              <DailyStatsChart
                title="LIB Supply Growth Chart"
                subTitle="Daily breakdown of newly minted LIB, node rewards, transaction fees and burnt fees"
                height={height}
                data={seriesData}
                yAxisTitle="LIB Supply"
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
                The LIB Supply Growth Chart shows a breakdown of daily newly created accounts minted LIB, node
                realized rewards, transaction fees and burnt fees to arrive at the total daily LIB supply.
              </p>
            </div>
          </div>
        </div>
      </ContentLayout>
    </div>
  )
}
