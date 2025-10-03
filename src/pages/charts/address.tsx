import React from 'react'
import { NextPage } from 'next'
import Head from 'next/head'

import { DailyNewAddressChart } from '../../frontend/charts/DetailChart'

const DailyNewAddressesPage: NextPage = () => {
  return (
    <>
      <Head>
        <title>Liberdus Unique Addresses Chart | Liberdus Explorer</title>
        <meta
          name="description"
          content="View the total distinct numbers of address on the Liberdus blockchain and the increase in the number of address daily"
        />
      </Head>
      <DailyNewAddressChart />
    </>
  )
}

export default DailyNewAddressesPage
