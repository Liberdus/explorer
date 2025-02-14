import Link from 'next/link'
import React from 'react'

import { Icon, LineChart } from '../../components'

import styles from './NewCardDetail.module.scss'

export interface NewCardDetailProps {
  libPrice: number
  totalLIB: number
  totalCycles: number
  totalTransactions: number
  transactionStats: number[][]
}

export const NewCardDetail: React.FC<NewCardDetailProps> = (data) => {
  return (
    <div className={styles.CardDetail}>
      <div className={styles.column}>
        <Link href="/cycle">
          <div className={styles.item}>
            <div className={styles.icon}>
              <Icon name="cycle" size="medium" color="black" />
            </div>
            <div>
              <p className={styles.title}>LIB PRICE</p>
              <p>{data?.libPrice?.toLocaleString('en-US')}</p>
            </div>
          </div>
        </Link>
        <hr className={styles.hr} />
        <div className={styles.item}>
          <div className={styles.icon}>
            <Icon name="standby" size="medium" color="black" />
          </div>
          <div>
            <p className={styles.title}>MARKET CAP</p>
            <p>{data?.totalLIB?.toLocaleString('en-US')}</p>
          </div>
        </div>
      </div>
      <div className={styles.column}>
        <Link href="/transaction">
          <div className={styles.item}>
            <div className={styles.icon}>
              <Icon name="transaction" size="medium" color="black" />
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
              <Icon name="reward" size="medium" color="black" />
            </div>
            <div>
              <p className={styles.title}>TOTAL CYCLES</p>
              <p>{data?.totalCycles?.toLocaleString('en-US')}</p>
            </div>
          </div>
        </Link>
      </div>
      <div className={styles.column}>
        <LineChart title="TRANSACTION HISTORY IN 14 DAYS" data={data?.transactionStats} />
      </div>
    </div>
  )
}
