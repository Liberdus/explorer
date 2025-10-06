import { NextPage } from 'next'
import Head from 'next/head'

import { DailyAvgTransactionFeeChart } from '../../frontend/charts'

const DailyAvgTransactionFeePage: NextPage = () => {
  return (
    <>
      <Head>
        <title>Average Transaction Fee (USD) | Liberdus Explorer</title>
        <meta
          name="description"
          content="View the daily average amount in USD spent per transaction on the Liberdus Network"
        />
      </Head>
      <DailyAvgTransactionFeeChart />
    </>
  )
}

export default DailyAvgTransactionFeePage
