import { NextPage } from 'next'
import Head from 'next/head'

import { DailyPriceChart } from '../../frontend/charts'

const DailyPricePage: NextPage = () => {
  return (
    <>
      <Head>
        <title>LIB Daily Price (USD) | Liberdus Explorer</title>
        <meta
          name="description"
          content="View the daily historical price for LIB in USD on the Liberdus Network"
        />
      </Head>
      <DailyPriceChart />
    </>
  )
}

export default DailyPricePage
