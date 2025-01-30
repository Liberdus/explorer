import React from 'react'
import { Transaction } from '../../../../types'

import styles from './JsonView.module.scss'
import { bigIntReviver } from '../../../api/axios'

interface JsonViewProps {
  transaction: Transaction
}

export const JsonView: React.FC<JsonViewProps> = ({ transaction }) => {
  return (
    <div className={styles.JsonView}>
        <pre>{JSON.stringify(transaction, bigIntReviver, 2)}</pre>
    </div>
  )
}
