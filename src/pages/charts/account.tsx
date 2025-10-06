import { NextPage } from 'next'
import Head from 'next/head'

import { DailyAccountChart } from '../../frontend/charts/DetailChart'

const DailyAccountsPage: NextPage = () => {
  return (
    <>
      <Head>
        <title>Active Liberdus Balance Accounts | Liberdus Explorer</title>
        <meta
          name="description"
          content="The Active Balance Address chart shows the daily number of unique accounts that hold some LIB coins"
        />
      </Head>
      <DailyAccountChart />
    </>
  )
}

export default DailyAccountsPage
