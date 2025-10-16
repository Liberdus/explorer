import { NextPage } from 'next'
import Head from 'next/head'

import { DailyRequiredStakeChart } from '../../frontend/charts'

const DailyRequiredStakePage: NextPage = () => {
  return (
    <>
      <Head>
        <title>Daily Required Stake (USD) | Liberdus Explorer</title>
        <meta
          name="description"
          content="View the historical daily required stake in USD on the Liberdus Network"
        />
      </Head>
      <DailyRequiredStakeChart />
    </>
  )
}

export default DailyRequiredStakePage
