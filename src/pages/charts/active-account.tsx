import { NextPage } from 'next'
import Head from 'next/head'

import { DailyActiveAccountChart } from '../../frontend/charts'

const DailyActiveAddressPage: NextPage = () => {
  return (
    <>
      <Head>
        <title>Active Liberdus Accounts | Liberdus Explorer</title>
        <meta
          name="description"
          content="The Active Liberdus Accounts chart shows the daily number of unique accounts that were active on the network as a transaction sender"
        />
      </Head>
      <DailyActiveAccountChart />
    </>
  )
}

export default DailyActiveAddressPage
