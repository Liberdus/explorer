import { NextPage } from 'next'
import Head from 'next/head'

import { DailyTxFeeSetChart } from '../../frontend/charts'

const DailyTxFeeSetPage: NextPage = () => {
  return (
    <>
      <Head>
        <title>Daily Transaction Fee Set (USD) | Liberdus Explorer</title>
        <meta
          name="description"
          content="View the historical daily transaction fee set in USD on the Liberdus Network"
        />
      </Head>
      <DailyTxFeeSetChart />
    </>
  )
}

export default DailyTxFeeSetPage
