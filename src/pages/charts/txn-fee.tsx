import { NextPage } from 'next'
import Head from 'next/head'

import { DailyTransactionFeeChart } from '../../frontend/charts'

const DailyTransactionFeePage: NextPage = () => {
  return (
    <>
      <Head>
        <title>Txn Fee (LIB) | Liberdus Explorer</title>
        <meta
          name="description"
          content="View the historical total number of LIB paid as transaction fee for the Liberdus Network"
        />
      </Head>
      <DailyTransactionFeeChart />
    </>
  )
}

export default DailyTransactionFeePage
