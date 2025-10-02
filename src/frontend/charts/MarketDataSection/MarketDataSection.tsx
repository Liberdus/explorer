import React from 'react'
import Link from 'next/link'
import { ChartSVG, chartSVGTypes } from '../../components'
import styles from './MarketDataSection.module.scss'

interface ChartCardProps {
  title: string
  chartSvgName: keyof typeof chartSVGTypes
  route: string
}

const ChartCard: React.FC<ChartCardProps> = ({ title, chartSvgName, route }) => {
  return (
    <Link href={route} className={styles.cardLink}>
      <div className={styles.chartCard}>
        <div className={styles.cardHeader}>
          <h4 className={styles.cardTitle}>{title}</h4>
          {/* <div className={styles.arrowIcon}>↗</div> */}
        </div>
        <div className={styles.chartPlaceholder}>
          {/* Placeholder for chart visualization */}
          {/* <svg className={styles.chartSvg} viewBox="0 0 300 120" preserveAspectRatio="none">
            <path
              d={generateChartPath(title)}
              fill="none"
              stroke="#cbd5e0"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
          </svg> */}

          <div className={styles.chartSvg}>
            <ChartSVG name={chartSvgName} />
          </div>
        </div>
      </div>
    </Link>
  )
}

// Generate different chart patterns based on title
const generateChartPath = (title: string): string => {
  const points = 50
  const width = 300
  const height = 120
  const seed = title.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)

  let path = `M 0,${height / 2}`

  for (let i = 1; i <= points; i++) {
    const x = (i / points) * width
    // Use seed to create consistent but different patterns for each chart
    const noise = Math.sin((i + seed) * 0.3) * Math.cos(i * seed * 0.05)
    const trend = title.includes('Unique')
      ? -i * 0.3
      : title.includes('Gas Price')
      ? Math.random() * 40 - 20
      : 0
    const y = height / 2 + noise * 20 + trend + Math.sin(i * 0.2) * 10
    path += ` L ${x},${Math.max(10, Math.min(height - 10, y))}`
  }

  return path
}

export const MarketDataSection: React.FC = () => {
  const charts: ChartCardProps[] = [
    { title: 'LIB Daily Price (USD) Chart', chartSvgName: 'ethDailyPrice', route: '/charts/libprice' },
    { title: 'LIB Market Capitalization Chart', chartSvgName: 'ethMarketCap', route: '/charts/marketcap' },
    { title: 'Total Supply & Market Cap Chart', chartSvgName: 'pieChart', route: '/charts/supply' },
    { title: 'LIB Supply Growth Chart', chartSvgName: 'ethSupplyGrowth', route: '/charts/libsupplygrowth' },
  ]

  return (
    <div className={styles.MarketDataSection}>
      <div className={styles.sectionHeader}>
        <h5>Market Data</h5>
      </div>

      <div className={styles.chartsGrid}>
        {charts.map((chart, index) => (
          <ChartCard key={index} title={chart.title} chartSvgName={chart.chartSvgName} route={chart.route} />
        ))}
      </div>
    </div>
  )
}
