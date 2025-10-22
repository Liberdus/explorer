import { NextPage } from 'next'
import Head from 'next/head'

const TotalSupplyPage: NextPage = () => {
  return (
    <>
      <Head>
        <title>Liberdus Total Supply and Market Capitalization Chart | Liberdus Explorer</title>
        <meta name="description" content="" />
      </Head>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '50vh',
        }}
      >
        <h1 style={{ marginBottom: '1rem', fontSize: '1.2rem', fontWeight: '#700' }}>
          Liberdus Total Supply and Market Capitalization Chart
        </h1>
        <p style={{ fontSize: '2rem' }}>IN PROGRESS</p>
      </div>
    </>
  )
}

export default TotalSupplyPage
