import React from 'react'
import Link from 'next/link'
import { toEthereumAddress, truncateAddress } from '../../../utils/transformAddress'
import { formatFullAmount } from '../../../utils/calculateValue'

import styles from './StateTab.module.scss'
import { BalanceChange } from '../../../../storage/accountHistoryState'

interface StateTabProps {
  balanceChanges?: BalanceChange[]
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
          const beforeValue = Number(change.before)
          const afterValue = Number(change.after)
          const difference = afterValue - beforeValue

          return (
            <div key={index} className={styles.gridRow}>
              <div className={styles.value}>
                <Link href={`/account/${change.accountId}`} className={styles.link}>
                  {truncateAddress(toEthereumAddress(change.accountId))}
                </Link>
              </div>
              <div className={styles.value}>{formatFullAmount(beforeValue)}</div>
              <div className={styles.value}>{formatFullAmount(afterValue)}</div>
              <div
                className={difference > 0 ? styles.positive : difference < 0 ? styles.negative : styles.value}
              >
                {difference > 0 ? '+' : ''}
                {formatFullAmount(difference)} LIB
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
