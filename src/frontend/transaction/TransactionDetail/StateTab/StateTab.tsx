import React from 'react'
import Link from 'next/link'
import { toEthereumAddress, truncateAddress } from '../../../utils/transformAddress'

import styles from './StateTab.module.scss'
import { BalanceChange } from '../../../../storage/accountHistoryState'

interface StateTabProps {
  balanceChanges?: BalanceChange[]
}

const getDecimals = (num: number): number => {
  const str = num.toString()

  if (!str.includes('.')) return 0

  return str.split('.')[1].length
}

export const StateTab: React.FC<StateTabProps> = ({ balanceChanges }) => {
  if (!balanceChanges || balanceChanges.length === 0) {
    return (
      <div className={styles.StateTab}>
        <div className={styles.noData}>No balance changes occurred in this transaction.</div>
      </div>
    )
  }

  return (
    <div className={styles.StateTab}>
      <div className={styles.gridContainer}>
        <div className={styles.gridRow}>
          <div className={styles.header}>Account</div>
          <div className={styles.header}>Before</div>
          <div className={styles.header}>After</div>
          <div className={styles.header}>Difference</div>
        </div>
        <div className={styles.divider}></div>
        {balanceChanges.map((change, index) => {
          // Calculate difference with high precision to avoid floating point errors
          const beforeValue = change.before
          const afterValue = change.after
          const amount = afterValue - beforeValue
          const maxDecimals = Math.max(getDecimals(beforeValue), getDecimals(afterValue))
          const difference = maxDecimals > 0
            ? amount.toFixed(maxDecimals).replace(/\.?0+$/, '')
            : amount.toFixed(maxDecimals)

          return (
            <div key={index} className={styles.gridRow}>
              <div className={styles.value}>
                <Link href={`/account/${change.accountId}`} className={styles.link}>
                  {truncateAddress(toEthereumAddress(change.accountId))}
                </Link>
              </div>
              <div className={styles.value}>{beforeValue}</div>
              <div className={styles.value}>{afterValue}</div>
              <div
                className={
                  difference > '0' ? styles.positive : difference < '0' ? styles.negative : styles.value
                }
              >
                {difference > '0' ? '+' : ''}
                {difference} LIB
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
