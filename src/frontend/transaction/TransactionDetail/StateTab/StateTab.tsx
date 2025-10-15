import React from 'react'
import Link from 'next/link'
import { toEthereumAddress, truncateAddress } from '../../../utils/transformAddress'

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
          const difference = change.after - change.before

          return (
            <div key={index} className={styles.gridRow}>
              <Link href={`/account/${change.accountId}`} className={styles.link}>
                <div className={styles.value}>{truncateAddress(toEthereumAddress(change.accountId))} </div>
              </Link>
              <div className={styles.value}>{change.before.toLocaleString()}</div>
              <div className={styles.value}>{change.after.toLocaleString()}</div>
              <div
                className={difference > 0 ? styles.positive : difference < 0 ? styles.negative : styles.value}
              >
                {difference > 0 ? '+' : ''}
                {difference.toLocaleString()} LIB
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
