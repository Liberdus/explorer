import React, { FC } from 'react'
import cx from 'classnames'

import styles from './ChartSVG.module.scss'

import AvgBlockSize from './svgs/avg-block-size.svg'
import AvgBlockTime from './svgs/avg-block-time.svg'
import AvgGasLimit from './svgs/avg-gas-limit.svg'
import AvgGasPrice from './svgs/avg-gas-price.svg'
import AvgTxnFee from './svgs/avg-txn-fee.svg'
import BlockCount from './svgs/block-count.svg'
import DailyActiveErc20Address from './svgs/daily-active-erc20-address.svg'
import DailyActiveEthAddress from './svgs/daily-active-eth-address.svg'
import DailyBlockRewards from './svgs/daily-block-rewards.svg'
import DailyEthBurnt from './svgs/daily-eth-burnt.svg'
import DailyGasUsed from './svgs/daily-gas-used.svg'
import DashboardLineChart1 from './svgs/dashboard-line-chart-1.svg'
import DashboardLineChartGrid from './svgs/dashboard-line-chart-grid.svg'
import DashboardPieChart from './svgs/dashboard-pie-chart.svg'
import DoughnutChart from './svgs/doughnut-chart.svg'
import Erc20DailyToken from './svgs/erc20-daily-token.svg'
import EthDailyPrice from './svgs/eth-daily-price.svg'
import EthDailyTxn from './svgs/eth-daily-txn.svg'
import EthDailyVerifiedContracts from './svgs/eth-daily-verified-contracts.svg'
import EthDeployedContracts from './svgs/eth-deployed-contracts.svg'
import EthMarketCap from './svgs/eth-market-cap.svg'
import EthSupplyGrowth from './svgs/eth-supply-growth.svg'
import FullNodeSyncArchive from './svgs/full-node-sync-archive.svg'
import FullNodeSync from './svgs/full-node-sync.svg'
import NetworkDifficulty from './svgs/network-difficulty.svg'
import NetworkHashRate from './svgs/network-hash-rate.svg'
import NetworkPendingTxn from './svgs/network-pending-txn.svg'
import NetworkTxnFee from './svgs/network-txn-fee.svg'
import NetworkUtilization from './svgs/network-utilization.svg'
import PieChart from './svgs/pie-chart.svg'
import UncleCountRewards from './svgs/uncle-count-rewards.svg'
import UniqueAddress from './svgs/unique-address.svg'
import WorldMap from './svgs/world-map.svg'

export const chartSVGTypes = {
  avgBlockSize: AvgBlockSize,
  avgBlockTime: AvgBlockTime,
  avgGasLimit: AvgGasLimit,
  avgGasPrice: AvgGasPrice,
  avgTxnFee: AvgTxnFee,
  blockCount: BlockCount,
  dailyActiveErc20Address: DailyActiveErc20Address,
  dailyActiveEthAddress: DailyActiveEthAddress,
  dailyBlockRewards: DailyBlockRewards,
  dailyEthBurnt: DailyEthBurnt,
  dailyGasUsed: DailyGasUsed,
  dashboardLineChart1: DashboardLineChart1,
  dashboardLineChartGrid: DashboardLineChartGrid,
  dashboardPieChart: DashboardPieChart,
  doughnutChart: DoughnutChart,
  erc20DailyToken: Erc20DailyToken,
  ethDailyPrice: EthDailyPrice,
  ethDailyTxn: EthDailyTxn,
  ethDailyVerifiedContracts: EthDailyVerifiedContracts,
  ethDeployedContracts: EthDeployedContracts,
  ethMarketCap: EthMarketCap,
  ethSupplyGrowth: EthSupplyGrowth,
  fullNodeSyncArchive: FullNodeSyncArchive,
  fullNodeSync: FullNodeSync,
  networkDifficulty: NetworkDifficulty,
  networkHashRate: NetworkHashRate,
  networkPendingTxn: NetworkPendingTxn,
  networkTxnFee: NetworkTxnFee,
  networkUtilization: NetworkUtilization,
  pieChart: PieChart,
  uncleCountRewards: UncleCountRewards,
  uniqueAddress: UniqueAddress,
  worldMap: WorldMap,
}

export interface ChartSvgProps {
  name: keyof typeof chartSVGTypes
  className?: string
  color?: 'primary' | 'black' | 'white' | 'disabled' | undefined
}

export const ChartSVG: FC<ChartSvgProps> = ({
  name,
  className,
  color,
  ...props
}): React.ReactElement | null => {
  // eslint-disable-next-line security/detect-object-injection
  const ChartComponent = chartSVGTypes[name]

  const style = cx(styles.ChartSVG, color && styles[color], className)

  return ChartComponent ? (
    <ChartComponent {...props} className={style} viewBox="0 0 300 120" preserveAspectRatio="meet" />
  ) : null
}
