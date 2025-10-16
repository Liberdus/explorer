import { NextPage } from 'next'
import Head from 'next/head'

import { DailyActiveNodesChart } from '../../frontend/charts'

const DailyActiveNodesPage: NextPage = () => {
  return (
    <>
      <Head>
        <title>Daily Active Nodes | Liberdus Explorer</title>
        <meta
          name="description"
          content="View the historical daily active nodes count on the Liberdus Network"
        />
      </Head>
      <DailyActiveNodesChart />
    </>
  )
}

export default DailyActiveNodesPage
