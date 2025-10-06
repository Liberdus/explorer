import { NextPage } from 'next'
import Head from 'next/head'

import { DailyDistributedSupplyChart } from '../../frontend/charts'

const DailyDistributedSupplyPage: NextPage = () => {
  return (
    <>
      <Head>
        <title>Daily LIB Distributed | Liberdus Explorer</title>
        <meta
          name="description"
          content="View the daily amount of LIB distributed as minted coins to newly created accounts and node rewards collected by nominators on the Liberdus Network"
        />
      </Head>
      <DailyDistributedSupplyChart />
    </>
  )
}

export default DailyDistributedSupplyPage
