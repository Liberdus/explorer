import React from 'react'
import Link from 'next/link'
import moment from 'moment'

import { Chip } from '../../../components'

import { Transaction, TransactionType } from '../../../../types'

import styles from './Ovewview.module.scss'

import { calculateFullValue } from '../../../utils/calculateValue'
import { toEthereumAddress } from '../../../utils/transformAddress'

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
        <div className={styles.item}>
          <div className={styles.title}>Transaction Status:</div>
          <div className={styles.value}>
            <Chip
              title={transaction?.data?.success === true ? 'Success' : 'Failed'}
              size="medium"
              color={transaction?.data?.success === true ? 'success' : 'error'}
              className={styles.chip}
            />
          </div>
        </div>
        {transaction?.data?.reason && (
          <div className={styles.item}>
            <div className={styles.title}>Reason:</div>
            <div className={styles.value} style={{ fontStyle: 'italic', fontWeight: 600 }}>
              {transaction?.data?.reason}
            </div>
          </div>
        )}
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
              {transaction?.txFrom ? toEthereumAddress(transaction?.txFrom) : ''}
            </Link>
          </div>
        </div>

        <div className={styles.item}>
          <div className={styles.title}>To:</div>
          <div className={styles.value}>
            <Link href={`/account/${transaction?.txTo}`} className={styles.link}>
              {transaction?.txTo ? toEthereumAddress(transaction?.txTo) : ''}
            </Link>
          </div>
        </div>

        {transaction.transactionType === TransactionType.transfer && (
          <>
            <div className={styles.item}>
              <div className={styles.title}>Value:</div>
              <div className={styles.value}>
                {calculateFullValue(`${transaction?.data?.additionalInfo?.amount}`)} LIB
              </div>
            </div>
          </>
        )}
        {transaction.transactionType === TransactionType.message && (
          <div className={styles.item}>
            <div className={styles.title}>Toll Fee:</div>
            <div className={styles.value}>
              {calculateFullValue(`${transaction?.data?.additionalInfo?.tollFee}` || '0')}
            </div>
          </div>
        )}
        {transaction.transactionType === TransactionType.deposit_stake && (
          <>
            <div className={styles.item}>
              <div className={styles.title}>Stake Amount:</div>
              <div className={styles.value}>
                {calculateFullValue(`${transaction?.data?.additionalInfo?.stake}` || '0')}
              </div>
            </div>
            <div className={styles.item}>
              <div className={styles.title}>Total Stake Amount:</div>
              <div className={styles.value}>
                {calculateFullValue(`${transaction?.data?.additionalInfo?.totalStake}` || '0')}
              </div>
            </div>
          </>
        )}
        {transaction.transactionType === TransactionType.withdraw_stake &&
          transaction?.data?.additionalInfo && (
            <>
              <div className={styles.item}>
                <div className={styles.title}>Stake Amount:</div>
                <div className={styles.value}>
                  {calculateFullValue(`${transaction?.data?.additionalInfo?.stake}` || '0')}
                </div>
              </div>
              <div className={styles.item}>
                <div className={styles.title}>Reward:</div>
                <div className={styles.value}>
                  {calculateFullValue(`${transaction?.data?.additionalInfo?.reward}` || '0')}
                </div>
              </div>
              <div className={styles.item}>
                <div className={styles.title}>Penalty:</div>
                <div className={styles.value}>
                  {calculateFullValue(`${transaction?.data?.additionalInfo?.penalty}` || '0')}
                </div>
              </div>
              <div className={styles.item}>
                <div className={styles.title}>Total Unstake Amount:</div>
                <div className={styles.value}>
                  {calculateFullValue(`${transaction?.data?.additionalInfo?.totalUnstakeAmount}` || '0')}
                </div>
              </div>
            </>
          )}
        {transaction.transactionType === TransactionType.set_cert_time &&
          transaction?.data?.additionalInfo && (
            <div className={styles.item}>
              <div className={styles.title}>Cert Time:</div>
              <div className={styles.value}>
                {toReadableDateFromMillis(transaction?.data?.additionalInfo?.certExp)}
              </div>
            </div>
          )}
        {transaction.transactionType === TransactionType.init_reward && transaction?.data?.additionalInfo && (
          <div className={styles.item}>
            <div className={styles.title}>Node Start Time:</div>
            <div className={styles.value}>
              {toReadableDateFromMillis(transaction?.data?.additionalInfo?.nodeStartTime * 1000)}
            </div>
          </div>
        )}
        {transaction.transactionType === TransactionType.claim_reward &&
          transaction?.data?.additionalInfo && (
            <>
              <div className={styles.item}>
                <div className={styles.title}>Node Start Time:</div>
                <div className={styles.value}>
                  {toReadableDateFromMillis(transaction?.data?.additionalInfo?.nodeStartTime * 1000)}
                </div>
              </div>
              <div className={styles.item}>
                <div className={styles.title}>Node End Time:</div>
                <div className={styles.value}>
                  {toReadableDateFromMillis(transaction?.data?.additionalInfo?.nodeEndTime * 1000)}
                </div>
              </div>
              <div className={styles.item}>
                <div className={styles.title}>Reward Amount:</div>
                <div className={styles.value}>
                  {calculateFullValue(`${transaction?.data?.additionalInfo?.rewardedAmount}` || '0')}
                </div>
              </div>
            </>
          )}
        <div className={styles.item}>
          <div className={styles.title}>Transaction Fee:</div>
          <div className={styles.value}>
            {calculateFullValue(`${transaction?.data?.transactionFee}` || '0.0')}
          </div>
        </div>
      </div>
    )
  } else {
    return <div> No Data</div>
  }
}
