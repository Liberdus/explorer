import { NextPage } from 'next'
import Head from 'next/head'

import { DailySupplyGrowthChart } from '../../frontend/charts'

const DailySupplyGrowthPage: NextPage = () => {
  return (
    <>
      <Head>
        <title>LIB Supply Growth | Liberdus Explorer</title>
        <meta
          name="description"
          content="View the breakdown of daily newly minted LIB, node rewards, transaction fees and burnt fees on the Liberdus Network"
        />
      </Head>
      <DailySupplyGrowthChart />
    </>
  )
}

export default DailySupplyGrowthPage
