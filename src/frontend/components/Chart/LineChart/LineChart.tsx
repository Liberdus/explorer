import React from 'react'
import Highcharts from 'highcharts'
import HighchartsExporting from 'highcharts/modules/exporting'
import HighchartsReact from 'highcharts-react-official'
import { useRouter } from 'next/router'

if (typeof Highcharts === 'object') {
  HighchartsExporting(Highcharts)
}

interface LineChartProps {
  title: string
  centerTitle?: boolean
  subTitle?: string
  data: number[][]
  height?: number
  name?: string
}

export const LineChart: React.FC<LineChartProps> = (props: LineChartProps) => {
  const router = useRouter()

  const { title, centerTitle, subTitle, data, height = 150, name } = props

  const option = {
    accessibility: {
      enabled: false,
    },
    title: {
      text: title,
      align: centerTitle ? 'center' : 'left',
      style: {
        fontSize: '12px',
        fontWeight: '600',
        color: '#495057',
        fontFamily: 'Inter, sans-serif',
      },
    },
    subtitle: {
      text: subTitle || undefined,
      style: {
        fontSize: '12px',
      },
    },
    series: [
      {
        name: name,
        data: data,
        findNearestPointBy: 'xy',
        color: '#000',
        lineWidth: 1,
        marker: {
          enabled: false,
          states: {
            hover: {
              enabled: true,
              radius: 4,
            },
          },
        },
        spline: true,
        linecap: 'round',
        lineJoin: 'round',
        connectNulls: true,
        type: 'spline',
        connectEnds: true,
        tension: 0.4,
      },
    ],
    legend: {
      enabled: false,
    },
    xAxis: {
      type: 'datetime',
      gridLineWidth: 0,
      tickLength: 0,
      labels: {
        style: {
          color: '#666',
          fontSize: '12px',
        },
        formatter: function () {
          const date = new Date(this.value)
          return Highcharts.dateFormat('%b %e', Number(date))
        },
      },
      tickPositioner: function () {
        const positions = this.series[0].xData
        return [
          positions[0], // First date
          positions[Math.floor(positions.length / 2)], // Middle date
          positions[positions.length - 1], // Last date
        ]
      },
      lineColor: 'transparent',
    },
    yAxis: {
      title: {
        text: undefined,
      },
      gridLineWidth: 0,
      labels: {
        format: '{value:,.0f}k',
        align: 'right',
        x: 0,
        y: -3,
        style: {
          color: '#666',
          fontSize: '12px',
        },
      },
      tickPosition: 'inside',
      tickLength: 0,
      offset: 20, // Add spacing between labels and chart
    },
    tooltip: {
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderWidth: 0,
      borderRadius: 4,
      shadow: true,
      // padding: 12,
      headerFormat: '',
      pointFormatter: function () {
        const date = new Date(this.x)
        return `<div style="font-family: Inter, sans-serif;">
          <div style="font-weight: 500; margin-bottom: 8px;">
            ${Highcharts.dateFormat('%A, %B %d, %Y', date.getTime())}
          </div>
          <div>
            Transactions: <b>${Highcharts.numberFormat(this.y, 0)}</b>
          </div>
        </div>`
      },
      useHTML: true,
    },
    chart: {
      height: height,
      zoomType: 'x',
      backgroundColor: 'transparent',
      spacing: [20, 20, 20, 20], // Increased left spacing
    },
    credits: {
      enabled: false,
    },
    navigation: {
      buttonOptions: {
        enabled: false,
      },
    },
    plotOptions: {
      series: {
        states: {
          hover: {
            enabled: true,
            lineWidth: 1,
          },
        },
      },
      spline: {
        marker: {
          enabled: false,
        },
      },
    },
  }

  return <HighchartsReact highcharts={Highcharts} options={option} />
}

export default LineChart
