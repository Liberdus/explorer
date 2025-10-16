import { NextPage } from 'next'
import Head from 'next/head'

import { DailyNetworkStakeChart } from '../../frontend/charts'

const DailyNetworkStakePage: NextPage = () => {
  return (
    <>
      <Head>
        <title>Daily Network Stake | Liberdus Explorer</title>
        <meta
          name="description"
          content="View the daily breakdown of staked, unstaked, and penalty amounts to arrive at the total network stake on the Liberdus Network"
        />
      </Head>
      <DailyNetworkStakeChart />
    </>
  )
}

export default DailyNetworkStakePage
