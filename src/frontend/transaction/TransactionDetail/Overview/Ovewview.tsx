import React from 'react'
import Link from 'next/link'
import moment from 'moment'

import { Chip } from '../../../components'

import { Transaction, TransactionType } from '../../../../types'

import styles from './Ovewview.module.scss'

import { calculateFullValue } from '../../../utils/calculateValue'

export function toReadableDateFromMillis(timeInMillis: number): string {
  return new Date(timeInMillis).toString()
}

interface OvewviewProps {
  transaction: Transaction
}

export const Ovewview: React.FC<OvewviewProps> = ({ transaction }) => {
  if (transaction) {
    return (
      <div className={styles.Ovewview}>
        <div className={styles.item}>
          <div className={styles.title}>Transaction ID:</div>
          <div className={styles.value}>{transaction?.txId}</div>
        </div>
        {/* <div className={styles.item}>
          <div className={styles.title}>Transaction Status:</div>
          <div className={styles.value}>
            <Chip
              title={
                transaction?.txStatus === 'Pending'
                  ? 'Pending ............. ( Please wait for a bit.)'
                  : 'Expired ............. ( Please submit the transaction again.)'
              }
              size="medium"
              color={transaction?.txStatus === 'Pending' ? 'gray' : 'error'}
              className={styles.chip}
            />
          </div>
        </div> */}
        <div className={styles.item}>
          <div className={styles.title}>Method:</div>
          <div className={styles.value}>
            <Chip title={transaction.transactionType} color="info" className={styles.chip} />
          </div>
        </div>
        <div className={styles.item}>
          <div className={styles.title}>Cycle:</div>
          <div className={styles.value}>{transaction?.cycleNumber}</div>
        </div>
        <div className={styles.item}>
          <div className={styles.title}>Timestamp:</div>
          <div className={styles.value}>
            {moment(transaction?.timestamp).fromNow()} ({toReadableDateFromMillis(transaction?.timestamp)})
          </div>
        </div>

        <div className={styles.item}>
          <div className={styles.title}>From:</div>
          <div className={styles.value}>
            <Link href={`/account/${transaction?.txFrom}`} className={styles.link}>
              {transaction?.txFrom}
            </Link>
          </div>
        </div>

        <div className={styles.item}>
          <div className={styles.title}>To:</div>
          <div className={styles.value}>
            <Link href={`/account/${transaction?.txTo}`} className={styles.link}>
              {transaction?.txTo}
            </Link>
          </div>
        </div>

        {transaction.transactionType === TransactionType.transfer && (
          <>
            <div className={styles.item}>
              <div className={styles.title}>Value:</div>
              <div className={styles.value}>
                {calculateFullValue(`${transaction?.originalTxData?.tx.amount}`)} LIB
              </div>
            </div>
            <div className={styles.item}>
              <div className={styles.title}>Transaction Fee:</div>
              <div className={styles.value}>
                {calculateFullValue(`${transaction?.originalTxData?.tx.fee}` || '0')}
              </div>
            </div>
          </>
        )}
        {transaction.transactionType === TransactionType.message && (
          <div className={styles.item}>
            <div className={styles.title}>Toll Fee:</div>
            <div className={styles.value}>
              {calculateFullValue(`${transaction?.originalTxData?.tx.amount}` || '0')}
            </div>
          </div>
        )}
      </div>
    )
  } else {
    return <div> No Data</div>
  }
}
