import { NextPage } from 'next'
import Head from 'next/head'

import { DailyActiveAddressChart } from '../../frontend/charts'

const DailyActiveAddressPage: NextPage = () => {
  return (
    <>
      <Head>
        <title>Active Liberdus Addresses | Liberdus Explorer</title>
        <meta
          name="description"
          content="The Active Liberdus Address chart shows the daily number of unique addresses that were active on the network as a sender or receiver"
        />
      </Head>
      <DailyActiveAddressChart />
    </>
  )
}

export default DailyActiveAddressPage
