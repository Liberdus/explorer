import React from 'react'
import { Receipt as ReceiptType } from '../../../../types'
import styles from './Receipt.module.scss'
import { bigIntReviver } from '../../../api/axios'


interface ReceiptProps {
  receipt: ReceiptType
}

export const Receipt: React.FC<ReceiptProps> = ({ receipt }) => {
  console.log('receipt', receipt)
  return (
    <div className={styles.Receipt}>
      <pre>{JSON.stringify(receipt, bigIntReviver, 4)}</pre>
    </div>
  )
}
