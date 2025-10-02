import React, { useState } from 'react'
import Highcharts from 'highcharts/highstock'
import HighchartsReact from 'highcharts-react-official'
import HighchartsBoost from 'highcharts/modules/boost'

if (typeof Highcharts === 'object') {
  HighchartsBoost(Highcharts)
}

interface DataPoint {
  x: number
  y: number
  cycle: number
}

interface SeriesData {
  name: string
  data: DataPoint[]
  zIndex: number
  tooltip?: string
  visible?: boolean
}

interface DailyTransactionChartProps {
  title: string
  subTitle?: string
  data: SeriesData[]
  height?: number
  name?: string
}

export const DailyTransactionChart: React.FC<DailyTransactionChartProps> = (
  props: DailyTransactionChartProps
) => {
  const { title, subTitle, data, height = 300 } = props

  const getPlotOptions = (): object => {
    return {
      line: {
        marker: {
          enabled: false,
        },
        lineWidth: 2,
        states: {
          hover: {
            lineWidth: 2,
          },
        },
      },
      series: {
        boostThreshold: 1,
        findNearestPointBy: 'xy',
        dataGrouping: {
          enabled: false,
        },
      },
    }
  }

  const option = {
    title: {
      text: title,
      align: 'left', // Always align to left
      x: 20, // Add some padding from the left edge
      style: {
        fontSize: '20px',
        fontWeight: '600',
        color: '#212529',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      },
      margin: 25,
    },
    subtitle: {
      text: subTitle || undefined,
      align: 'left', // Align subtitle to left as well
      x: 20, // Same padding as title
      style: {
        fontSize: '14px',
        color: '#6c757d',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      },
      margin: 15,
    },
    series: data.map((row) => ({
      ...row,
      data: row.data
        .filter((point: DataPoint) => point.x != null && point.y != null)
        .map((point: DataPoint) => ({
          x: point.x,
          y: point.y,
          transferTxs: point.transferTxs,
          messageTxs: point.messageTxs,
          depositStakeTxs: point.depositStakeTxs,
          withdrawStakeTxs: point.withdrawStakeTxs,
        })),
      showInNavigator: false,
      type: 'line',
      lineWidth: 2,
      color: '#3498db', // Blue line for Total Txs
      marker: {
        enabled: false,
        states: {
          hover: {
            enabled: true,
            radius: 4,
          },
        },
      },
    })),
    boost: {},

    plotOptions: getPlotOptions(),
    legend: {
      enabled: false,
    },
    xAxis: {
      type: 'datetime',
      gridLineWidth: 0, // Remove vertical grid lines
      lineWidth: 1, // Keep the axis line
      lineColor: '#e9ecef',
      labels: {
        style: {
          color: '#666',
          fontSize: '12px',
        },
        formatter: function () {
          return Highcharts.dateFormat('%b %e', this.value)
        },
      },
      title: {
        text: 'Date',
        style: {
          color: '#666',
          fontSize: '12px',
          fontWeight: '500',
        },
      },
      events: {},
    },
    yAxis: {
      title: {
        text: 'Transactions Per Day',
        style: {
          color: '#666',
          fontSize: '12px',
          fontWeight: '500',
        },
        margin: 20,
      },
      gridLineWidth: 1,
      gridLineColor: '#e9ecef',
      labels: {
        style: {
          color: '#666',
          fontSize: '12px',
        },
        align: 'right',
        x: -10,
        formatter: function () {
          return Highcharts.numberFormat(this.value, 0)
        },
      },
      opposite: false, // This ensures the Y-axis is on the left side
      zoomEnabled: true,
      min: 0,
    },
    tooltip: {
      backgroundColor: '#ffffff',
      borderColor: '#ddd',
      borderRadius: 6,
      borderWidth: 1,
      shadow: {
        color: 'rgba(0, 0, 0, 0.1)',
        offsetX: 0,
        offsetY: 2,
        opacity: 0.1,
        width: 4,
      },
      shared: true,
      useHTML: true,
      formatter: function () {
        const timestamp = this.x
        const xDate = new Date(timestamp)
        const xDateString = Highcharts.dateFormat('%B %d, %Y', xDate.getTime())
        const point = this.points ? this.points[0] : this
        const value = point.y || 0

        // Extract transaction type data from the point
        const pointData = point.point || point
        const transferTxs = pointData.transferTxs || 0
        const messageTxs = pointData.messageTxs || 0
        const depositStakeTxs = pointData.depositStakeTxs || 0
        const withdrawStakeTxs = pointData.withdrawStakeTxs || 0

        return `<div style="font-family: Inter, sans-serif; font-size: 13px;">
          <div style="font-weight: 600; margin-bottom: 6px; color: #333;">
            ${xDateString}
          </div>
          <div style="margin-bottom: 4px;">
            <span style="color: #666;">Total Txs:</span> <span style="font-weight: 600; color: #000;">${Highcharts.numberFormat(
              value,
              0
            )}</span>
          </div>
          <div style="border-top: 1px solid #eee; padding-top: 6px; margin-top: 6px;">
            <div style="margin-bottom: 2px;">
              <span style="color: #666;">Transfer:</span> <span style="font-weight: 500; color: #000;">${Highcharts.numberFormat(
                transferTxs,
                0
              )}</span>
            </div>
            <div style="margin-bottom: 2px;">
              <span style="color: #666;">Message:</span> <span style="font-weight: 500; color: #000;">${Highcharts.numberFormat(
                messageTxs,
                0
              )}</span>
            </div>
            <div style="margin-bottom: 2px;">
              <span style="color: #666;">Deposit Stake:</span> <span style="font-weight: 500; color: #000;">${Highcharts.numberFormat(
                depositStakeTxs,
                0
              )}</span>
            </div>
            <div>
              <span style="color: #666;">Withdraw Stake:</span> <span style="font-weight: 500; color: #000;">${Highcharts.numberFormat(
                withdrawStakeTxs,
                0
              )}</span>
            </div>
          </div>
        </div>`
      },
    },
    chart: {
      backgroundColor: '#ffffff',
      borderColor: '#e9ecef',
      borderWidth: 1,
      borderRadius: 8,
      spacingTop: 30,
      spacingBottom: 20,
      spacingLeft: 20, // Reduced space for Y-axis labels on the left
      spacingRight: 20, // Less space on the right
      height: height,
      zoomType: 'x',
    },
    credits: {
      enabled: false,
    },
    navigation: {
      menuStyle: {
        border: '1px solid #e9ecef',
        background: '#ffffff',
        padding: '5px 0',
      },
      menuItemStyle: {
        color: '#343a40',
      },
    },
    rangeSelector: {
      inputStyle: {
        color: '#039',
        fontWeight: 'bold',
        backgroundColor: 'white',
        border: 'none',
      },
      labelStyle: {
        color: 'silver',
        fontWeight: 'bold',
      },
      selected: 4, // Select "All" by default
      buttons: [
        {
          type: 'day',
          count: 7,
          text: '7d',
        },
        {
          type: 'day',
          count: 14,
          text: '14d',
        },
        {
          type: 'month',
          count: 1,
          text: '1m',
        },
        {
          type: 'month',
          count: 3,
          text: '3m',
        },
        {
          type: 'all',
          text: 'All',
        },
      ],
    },
    navigator: {
      enabled: false,
    },
    scrollbar: {
      enabled: false,
    },
  }

  return (
    <HighchartsReact
      highcharts={Highcharts}
      options={option}
      allowChartUpdate={true}
      constructorType="stockChart"
    />
  )
}
