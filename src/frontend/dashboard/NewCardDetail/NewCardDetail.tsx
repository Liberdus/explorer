import Link from 'next/link'
import React from 'react'
import Image from 'next/image'

import { Icon, LineChart } from '../../components'

import styles from './NewCardDetail.module.scss'
import { TransactionStats } from '../../../stats/transactionStats'

export interface NewCardDetailProps {
  tokenPrice: number
  marketCap: number
  totalCycles: number
  totalTransactions: number
  transactionStats: TransactionStats[]
}

export const NewCardDetail: React.FC<NewCardDetailProps> = (data) => {
  return (
    <div className={styles.NewCardDetail}>
      <div className={styles.column}>
        <Link href="/cycle">
          <div className={styles.item}>
            {/* <div className={styles.icon}>
              <Icon name="cycle" size="medium" color="black" />
            </div> */}
            <Image src="/favicon.ico" alt="Image" width={32} height={32} className={styles.logo} />
            <div>
              <p className={styles.title}>LIB PRICE</p>
              <p>${data?.tokenPrice?.toLocaleString('en-US')}</p>
            </div>
          </div>
        </Link>
        <hr className={styles.hr} />
        <div className={styles.item}>
          <div className={styles.icon}>
            <Icon name="earth" size="large" color="black" />
          </div>
          <div>
            <p className={styles.title}>MARKET CAP</p>
            <p>${data?.marketCap?.toLocaleString('en-US')}</p>
          </div>
        </div>
      </div>
      <div className={styles.column}>
        <Link href="/transaction">
          <div className={styles.item}>
            <div className={styles.icon}>
              <Icon name="server" size="large" />
            </div>
            <div>
              <p className={styles.title}>TOTAL TRANSACTIONS</p>
              <p>{data?.totalTransactions?.toLocaleString('en-US')}</p>
            </div>
          </div>
        </Link>
        <hr className={styles.hr} />
        <Link href="/transaction">
          <div className={styles.item}>
            <div className={styles.icon}>
              <Icon name="gauge" size="large" />
            </div>
            <div>
              <p className={styles.title}>TOTAL CYCLES</p>
              <p>{data?.totalCycles?.toLocaleString('en-US')}</p>
            </div>
          </div>
        </Link>
      </div>
      <div className={styles.column}>
        <LineChart
          title="TRANSACTION HISTORY IN 14 DAYS"
          data={data?.transactionStats as unknown as number[][]}
        />
      </div>
    </div>
  )
}
