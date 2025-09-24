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

export const DailyTransactionChart: React.FC<DailyTransactionChartProps> = (props: DailyTransactionChartProps) => {
  const { title, subTitle, data, height = 300 } = props

  const [selectedRange, setSelectedRange] = useState('')

  const getColorForSeries = (seriesName: string): string => {
    const colors: { [key: string]: string } = {
      'Transfer': '#4CAF50', // Green
      'Message': '#2196F3', // Blue
      'Deposit Stake': '#FF9800', // Orange
      'Withdraw Stake': '#F44336', // Red
    }
    return colors[seriesName] || '#9E9E9E' // Default gray
  }

  const getPlotOptions = (): object => {
    return {
      area: {
        stacking: 'normal',
        marker: {
          enabled: false,
        },
        lineWidth: 1,
        states: {
          hover: {
            lineWidth: 1,
          },
        },
      },
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
        .map((point: DataPoint) => [point.x, point.y]),
      showInNavigator: true,
      type: row.name === 'Total Txs' ? 'line' : 'area',
      stacking: row.name === 'Total Txs' ? undefined : 'normal',
      lineWidth: row.name === 'Total Txs' ? 2 : 1,
      fillOpacity: row.name === 'Total Txs' ? 0 : 0.6,
      color: row.name === 'Total Txs' ? '#000000' : getColorForSeries(row.name),
    })),
    boost: {},

    plotOptions: getPlotOptions(),
    legend: {
      enabled: true,
      layout: 'horizontal',
      align: 'center',
      verticalAlign: 'bottom',
      labelFormatter: function () {
        const series = this as Highcharts.Series
        const tooltipText = series.userOptions.tooltip || ''
        return `<span title="${tooltipText}">${series.name}</span>`
      },
      useHTML: true,
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
      events: {
        setExtremes: function (e) {
          const totalRange = e.max - e.min
          const oneWeek = 7 * 24 * 3600 * 1000 // one week in milliseconds
          setSelectedRange(totalRange >= oneWeek ? 'week' : '')
        },
      },
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
        width: 4
      },
      shared: true,
      useHTML: true,
      formatter: function () {
        const timestamp = this.x
        const xDate = new Date(timestamp)
        const xDateString = Highcharts.dateFormat('%B %d, %Y', xDate.getTime())

        let tooltipContent = `<div style="font-family: Inter, sans-serif; font-size: 13px;">
          <div style="font-weight: 600; margin-bottom: 6px; color: #333;">
            ${xDateString}
          </div>`

        // First, show Total Txs if available
        const totalTxsPoint = this.points.find((point) => point.series.name === 'Total Txs')
        if (totalTxsPoint) {
          tooltipContent += `<div style="margin-bottom: 4px;">
            <span style="color: #666;">Total Txs:</span> <span style="font-weight: 600; color: #000;">${Highcharts.numberFormat(totalTxsPoint.y, 0)}</span>
          </div>`
        }

        // Then show individual transaction types (excluding Total Txs)
        const otherPoints = this.points.filter((point) => point.series.name !== 'Total Txs')
        otherPoints.forEach((point) => {
          const seriesName = point.series.name
          const value = point.y
          const color = point.color
          if (value > 0) { // Only show non-zero values
            tooltipContent += `<div style="margin-bottom: 2px;">
              <span style="display: inline-block; width: 8px; height: 8px; background-color: ${color}; border-radius: 50%; margin-right: 6px;"></span>
              <span style="color: #666;">${seriesName}:</span> <span style="font-weight: 600; color: #000;">${Highcharts.numberFormat(value, 0)}</span>
            </div>`
          }
        })

        tooltipContent += `</div>`
        return tooltipContent
      },
    },
    chart: {
      backgroundColor: '#ffffff',
      borderColor: '#e9ecef',
      borderWidth: 1,
      borderRadius: 8,
      spacingTop: 30,
      spacingBottom: 60,
      spacingLeft: 100, // More space for Y-axis labels on the left
      spacingRight: 20,  // Less space on the right
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