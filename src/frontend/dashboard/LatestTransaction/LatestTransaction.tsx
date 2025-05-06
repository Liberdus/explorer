import moment from 'moment'
import { useRouter } from 'next/router'
import React from 'react'
import { AnchorLink, Button, Chip } from '../../components'
import { Transaction } from '../../../types'

import styles from './LatestTransaction.module.scss'
import { NetworkAccountId } from '../../../config'
import { toEthereumAddress } from '../../utils/transformAddress'

export interface LatestTransactionsProps {
  transactions: Transaction[]
}

export const LatestTransactions: React.FC<LatestTransactionsProps> = ({ transactions }) => {
  const router = useRouter()

  return (
    <div className={styles.LatestTransactions}>
      <div className={styles.title}>Latest Transactions</div>
      <hr />
      <div className={styles.content}>
        {transactions.map((item) => (
          <div key={item.txId} className={styles.item}>
            <div className={styles.column1}>
              <div className={styles.logo}>Tx</div>
              <div>
                <AnchorLink
                  href={`/transaction/${item.txId}`}
                  label={item.txId}
                  size="small"
                  width={220}
                  ellipsis
                />
                <div className={styles.timestampRow}>
                  <span>{moment(item.timestamp).fromNow()}</span>
                  <Chip
                    title={item.transactionType}
                    color={item.data?.success === true ? 'success' : 'error'}
                    size="small"
                  />
                </div>
              </div>
            </div>
            <div>
              <div className={styles.row}>
                <span>From</span>
                <AnchorLink
                  href={`/account/${item.txFrom || NetworkAccountId}`}
                  label={
                    (item.txFrom as string) ? toEthereumAddress(item.txFrom as string) : NetworkAccountId
                  }
                  size="small"
                  width={220}
                  ellipsis
                />
              </div>
              <div className={styles.row}>
                <span>To</span>
                <AnchorLink
                  href={`/account/${item.txTo || NetworkAccountId}`}
                  label={(item.txTo as string) ? toEthereumAddress(item.txTo as string) : NetworkAccountId}
                  size="small"
                  width={220}
                  ellipsis
                />
              </div>
            </div>
          </div>
        ))}
      </div>
      <hr />
      <Button
        className={styles.button}
        apperance="outlined"
        size="medium"
        onClick={() => {
          router.push('/transaction')
        }}
      >
        View all transactions
      </Button>
    </div>
  )
}
