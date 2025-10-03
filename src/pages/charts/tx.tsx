import { NextPage } from 'next'
import Head from 'next/head'

import { DailyTransactionChart } from '../../frontend/charts'

const DailyTransactionsPage: NextPage = () => {
  return (
    <>
      <Head>
        <title>Daily Transactions | Liberdus Explorer</title>
        <meta
          name="description"
          content="View transactions per day with historical data and breakdown by transaction type on the Liberdus Network"
        />
      </Head>
      <DailyTransactionChart />
    </>
  )
}

export default DailyTransactionsPage
