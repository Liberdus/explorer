import Link from 'next/link'
import React from 'react'

import { Icon } from '../../components'

import styles from './CardDetail.module.scss'

export interface CardDetailProps {
  totalCycles: number
  totalNodes: number
  totalStandby: number
  totalTransactions: number
  totalTransferTxs: number
  totalMessageTxs: number
  totalDepositStakeTxs: number
  totalWithdrawStakeTxs: number
  totalAccounts: number
  totalStakedLIB: number
  totalLIB: number
}

export const CardDetail: React.FC<CardDetailProps> = (data) => {
  return (
    <div className={styles.CardDetail}>
      <div className={styles.column}>
        <Link href="/cycle">
          <div className={styles.item}>
            <div className={styles.icon}>
              <Icon name="cycle" size="medium" color="primary" />
            </div>
            <div>
              <p className={styles.title}>Total Cycles</p>
              <p>{data?.totalCycles?.toLocaleString('en-US')}</p>
            </div>
          </div>
        </Link>
        <hr />
        <div className={styles.item}>
          <div className={styles.icon}>
            <Icon name="node" size="medium" color="primary" />
          </div>
          <div>
            <p className={styles.title}>Active Validators</p>
            <p>{data?.totalNodes?.toLocaleString('en-US')}</p>
          </div>
        </div>
        <hr />
        <div className={styles.item}>
          <div className={styles.icon}>
            <Icon name="standby" size="medium" color="primary" />
          </div>
          <div>
            <p className={styles.title}>Standby Nodes</p>
            <p>{data?.totalStandby?.toLocaleString('en-US')}</p>
          </div>
        </div>
      </div>
      <div className={styles.column}>
        <Link href="/account">
          <div className={styles.item}>
            <div className={styles.icon}>
              <Icon name="account" size="medium" color="primary" />
            </div>
            <div>
              <p className={styles.title}>Total Accounts</p>
              <p>{data?.totalAccounts?.toLocaleString()}</p>
            </div>
          </div>
        </Link>
        <hr />
        <Link href="/transaction">
          <div className={styles.item}>
            <div className={styles.icon}>
              <Icon name="transaction" size="medium" color="primary" />
            </div>
            <div>
              <p className={styles.title}>Total Transactions</p>
              <p>{data?.totalTransactions?.toLocaleString()}</p>
            </div>
          </div>
        </Link>
        <hr />
        <Link href="/transaction">
          <div className={styles.item}>
            <div className={styles.icon}>
              <Icon name="contract" size="medium" color="primary" />
            </div>
            <div>
              <p className={styles.title}>Total Transfer / Message Transactions</p>
              <p>
                {data?.totalTransferTxs?.toLocaleString()} / {data?.totalMessageTxs?.toLocaleString()}
              </p>
            </div>
          </div>
        </Link>
      </div>
      <div className={styles.column}>
        <Link href="/transaction">
          <div className={styles.item}>
            <div className={styles.icon}>
              <Icon name="transaction" size="medium" color="primary" />
            </div>
            <div>
              <p className={styles.title}>Total Stake / Unstake Transactions</p>
              <p>
                {data?.totalDepositStakeTxs?.toLocaleString()} /{' '}
                {data?.totalWithdrawStakeTxs?.toLocaleString()}
              </p>
            </div>
          </div>
        </Link>
        <hr />
        <Link href="/account">
          <div className={styles.item}>
            <div className={styles.icon}>
              <Icon name="reward" size="medium" color="primary" />
            </div>
            <div>
              <p className={styles.title}>Total LIB</p>
              <p>{data?.totalLIB?.toLocaleString('en-US')}</p>
            </div>
          </div>
        </Link>
        <hr />
        <Link href="/transaction">
          <div className={styles.item}>
            <div className={styles.icon}>
              <Icon name="reward" size="medium" color="primary" />
            </div>
            <div>
              <p className={styles.title}>Total Staked LIB</p>
              <p>{data?.totalStakedLIB?.toLocaleString('en-US')}</p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  )
}
