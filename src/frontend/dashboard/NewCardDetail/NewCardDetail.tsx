import Link from 'next/link'
import React from 'react'
import Image from 'next/image'

import { Icon, LineChart } from '../../components'

import styles from './NewCardDetail.module.scss'
import { TransactionStats } from '../../../stats/transactionStats'
import { config } from '../../../config'
import { NetworkParameters } from '../../../types'
import { getBaseTxFeeUSD, getBaseTxFeeLIB } from '../../utils/calculateValue'

export interface NewCardDetailProps {
  tokenPrice: number
  marketCap: number
  totalCycles: number
  totalTransactions: number
  transactionStats: TransactionStats[]
  totalLIB: number
  networkParameters: NetworkParameters
}

export const NewCardDetail: React.FC<NewCardDetailProps> = (data) => {
  return (
    <div className={styles.NewCardDetail}>
      <div className={styles.column}>
        <div className={styles.cardRow}>
          <Link href={config.dexScreenerLink} target="_blank" rel="noreferrer">
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
          <div className={styles.item} style={{ textAlign: 'right' }}>
            <div>
              <p className={styles.title}>MARKET CAP</p>
              <p>${(data?.tokenPrice * data?.totalLIB).toFixed(2)}</p>
            </div>
          </div>
        </div>
        <hr className={styles.hr} />
        <div className={styles.cardRow}>
          <div className={styles.item}>
            <div className={styles.icon}>
              <Icon name="earth" size="large" color="black" />
            </div>
            <div>
              <p className={styles.title}> TOTAL SUPPLY </p>
              <p>{data?.totalLIB?.toLocaleString('en-US')} LIB</p>
            </div>
          </div>
          <div className={styles.item} style={{ textAlign: 'right' }}>
            <div>
              <p className={styles.title}>MAX SUPPLY</p>
              <p>210,000,000 LIB </p>
            </div>
          </div>
        </div>
      </div>
      <div className={styles.column}>
        <div className={styles.cardRow}>
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
          <div className={styles.item} style={{ textAlign: 'right' }}>
            <div>
              <p className={styles.title}>BASE TX FEE</p>
              <p>
                ${getBaseTxFeeUSD(data?.networkParameters)}
                {' ~ '}
                {getBaseTxFeeLIB(data?.networkParameters)} LIB
              </p>
            </div>
          </div>
        </div>
        <hr className={styles.hr} />
        <Link href="/cycle">
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
