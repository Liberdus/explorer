import { NextPage } from 'next'
import Head from 'next/head'

import { DailyNodeRewardRateChart } from '../../frontend/charts'

const DailyNodeRewardRatePage: NextPage = () => {
  return (
    <>
      <Head>
        <title>Daily Node Reward Rate (USD) | Liberdus Explorer</title>
        <meta
          name="description"
          content="View the historical daily node reward rate in USD on the Liberdus Network"
        />
      </Head>
      <DailyNodeRewardRateChart />
    </>
  )
}

export default DailyNodeRewardRatePage
