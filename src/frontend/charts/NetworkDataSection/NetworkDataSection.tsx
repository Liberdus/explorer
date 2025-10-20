import React from 'react'
import Link from 'next/link'
import { ChartSVG, chartSVGTypes } from '../../components'
import styles from './NetworkDataSection.module.scss'

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

export const NetworkDataSection: React.FC = () => {
  const charts: ChartCardProps[] = [
    { title: 'Transaction Fee Set (USD) Chart', chartSvgName: 'avgTxnFee', route: '/charts/txfeeset' },
    {
      title: 'Node Reward Rate (USD) Chart',
      chartSvgName: 'dailyBlockRewards',
      route: '/charts/noderewardrate',
    },
    { title: 'Required Stake (USD) Chart', chartSvgName: 'blockCount', route: '/charts/requiredstake' },
    {
      title: 'Daily Active Nodes Chart',
      chartSvgName: 'networkPendingTxn',
      route: '/charts/activenodes',
    },
  ]

  return (
    <div className={styles.NetworkDataSection}>
      <div className={styles.sectionHeader}>
        <h5>Network Data</h5>
      </div>

      <div className={styles.chartsGrid}>
        {charts.map((chart, index) => (
          <ChartCard key={index} title={chart.title} chartSvgName={chart.chartSvgName} route={chart.route} />
        ))}
      </div>
    </div>
  )
}
