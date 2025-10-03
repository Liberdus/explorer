import { NextPage } from 'next'
import Head from 'next/head'

import { DailyMarketCapChart } from '../../frontend/charts'

const DailyMarketCapPage: NextPage = () => {
  return (
    <>
      <Head>
        <title>LIB Market Capitalization | Liberdus Explorer</title>
        <meta
          name="description"
          content="View the historical breakdown of LIB daily market capitalization and average price on the Liberdus Network"
        />
      </Head>
      <DailyMarketCapChart />
    </>
  )
}

export default DailyMarketCapPage
