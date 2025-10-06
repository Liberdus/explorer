import { NextPage } from 'next'
import Head from 'next/head'

import { DailyBurntSupplyChart } from '../../frontend/charts'

const DailyBurntSupplyPage: NextPage = () => {
  return (
    <>
      <Head>
        <title>Daily LIB Burnt | Liberdus Explorer</title>
        <meta
          name="description"
          content="View the daily amount of LIB burnt from transaction fees, network toll tax fees, and penalty amounts on the Liberdus Network"
        />
      </Head>
      <DailyBurntSupplyChart />
    </>
  )
}

export default DailyBurntSupplyPage
