import React from 'react'
import { AccountsCopy } from '../../../../types'

import styles from './AccountInfo.module.scss'
import { bigIntReviver } from '../../../api/axios'

interface AccountInfoProps {
  accounts?: AccountsCopy[]
}

export const AccountInfo: React.FC<AccountInfoProps> = ({ accounts }) => {
  return (
    <div className={styles.AccountInfo}>
      <pre>{JSON.stringify(accounts, bigIntReviver, 4)}</pre>
    </div>
  )
}
