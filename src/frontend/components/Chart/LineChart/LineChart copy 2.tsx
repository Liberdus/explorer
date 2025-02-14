import React from 'react'
import Highcharts from 'highcharts'
import HighchartsExporting from 'highcharts/modules/exporting'
import HighchartsReact from 'highcharts-react-official'

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
  price?: number
}

export const LineChart: React.FC<LineChartProps> = (props) => {
  const { title, data, height = 150, name, price } = props

  const options = {
    title: {
      text: title,
      align: 'left',
      style: {
        fontSize: '14px',
        fontWeight: '400',
        color: '#666',
        fontFamily: 'Inter, sans-serif',
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
        // Add smooth curve settings
        spline: true,
        linecap: 'round',
        lineJoin: 'round',
        connectNulls: true,
        type: 'spline',
        // Adjust the smoothness of the curve
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
        align: 'left',
        x: 0,
        y: -3,
        style: {
          color: '#666',
          fontSize: '12px',
        },
      },
      tickPosition: 'inside',
      tickLength: 0,
    },
    tooltip: {
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderWidth: 0,
      borderRadius: 4,
      shadow: true,
      padding: 12,
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
          ${price ? `<div>Price: <b>$${price.toFixed(2)}</b></div>` : ''}
        </div>`
      },
      useHTML: true,
    },
    chart: {
      height: height,
      zoomType: 'x',
      backgroundColor: 'transparent',
      spacing: [20, 20, 20, 40],
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

  return <HighchartsReact highcharts={Highcharts} options={options} />
}

export default LineChart
