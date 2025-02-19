import { useRouter } from 'next/router'
import React, { useState, useEffect, useMemo } from 'react'
import { ContentLayout } from '../../../components'
import { Tab } from '../../../components/Tab'
import { breadcrumbsList } from '../../../types'
import { JsonView } from '../JsonView'
import { Ovewview } from '../Overview'
import { Receipt } from '../Receipt'
import { AccountInfo } from '../AccountInfo'

import styles from './TransactionDetail.module.scss'
import { useTransactionDetailHook } from './useTransactionDetailHook'
import { AccountsCopy } from '../../../../types'

export const TransactionDetail: React.FC = () => {
  const router = useRouter()

  const txId = router?.query?.id as string

  const { transactionData, receiptData, setShowReceipt, showReceipt } = useTransactionDetailHook(txId)

  const tabs = useMemo(() => {
    const tabsArray = [
      {
        key: 'overview',
        value: 'Overview',
        content: <Ovewview transaction={transactionData} />,
      },
      {
        key: 'jsonview',
        value: 'Json View',
        content: <JsonView transaction={transactionData} />,
      },
    ]

    return tabsArray
  }, [transactionData])

  const receiptTabs = useMemo(
    () => [
      {
        key: 'fullReceipt',
        value: 'Full Receipt',
        content: <Receipt receipt={receiptData} />,
      },
      {
        key: 'accountInfo',
        value: 'Account Info',
        content: <AccountInfo accounts={receiptData ? receiptData.afterStates : [] as AccountsCopy[]} />,
      },
    ],
    [receiptData]
  )

  useEffect(() => {
    const receipt = router?.query?.receipt === 'true' ? true : false
    setShowReceipt(receipt)
    setActiveTab(receipt ? receiptTabs[0].key : tabs[0].key)
  }, [router?.query?.receipt, receiptTabs, setShowReceipt, tabs])
  const breadcrumbs = [breadcrumbsList.dashboard, breadcrumbsList.transaction]

  const [activeTab, setActiveTab] = useState(showReceipt ? receiptTabs[0].key : tabs[0].key)

  return (
    <div className={styles.TransactionDetail}>
      <ContentLayout title="Transaction Details" showBackButton breadcrumbItems={breadcrumbs}>
        <Tab
          tabs={showReceipt ? receiptTabs : tabs}
          activeTab={activeTab}
          onClick={(tab) => setActiveTab(tab)}
        />
      </ContentLayout>
    </div>
  )
}
