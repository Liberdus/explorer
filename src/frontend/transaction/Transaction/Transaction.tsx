import React, { Fragment, useEffect, useState } from 'react'
import { useRouter } from 'next/router'

import { useTransaction } from '../../api'

import { ContentLayout, Dropdown, Pagination, PaginationPrevNext } from '../../components'
import { TransactionTable } from '../TransactionTable'

import { breadcrumbsList, TransactionSearchList } from '../../types'

import styles from './Transaction.module.scss'
import { TransactionSearchType } from '../../../types'

const breadcrumbs = [breadcrumbsList.dashboard]

export const Transaction: React.FC = () => {
  const router = useRouter()

  const txType = router?.query?.txType as TransactionSearchType

  const tType = txType ? TransactionSearchList.filter((t) => t.key === txType)[0] : TransactionSearchList[0]

  const [transactionType, setTransactionType] = useState(tType)

  useEffect(() => {
    setTransactionType(tType)
  }, [tType])

  const [currentPage, setCurrentPage] = useState(1)
  const siblingCount = 3
  const pageSize = 10

  const { transactions, totalTransactions, originalTxs, totalOriginalTxs, loading } = useTransaction({
    page: currentPage,
    txType: transactionType.key,
  })

  const onNext = (): void => {
    const totalPage = Math.ceil((totalTransactions || totalOriginalTxs) / pageSize)
    setCurrentPage(currentPage < totalPage ? currentPage + 1 : totalPage)
  }

  const onPrev = (): void => {
    setCurrentPage(currentPage > 1 ? currentPage - 1 : 1)
  }

  return (
    <div className={styles.Transaction}>
      <ContentLayout title="All Transactions" breadcrumbItems={breadcrumbs} showBackButton>
        <div className={styles.wrapper}>
          <Dropdown
            apperance="outlined"
            size="medium"
            items={TransactionSearchList.map((t) => t.value)}
            selected={transactionType.value}
            onSelect={(t) => {
              setTransactionType(TransactionSearchList.filter((i) => i.value === t)[0])
              setCurrentPage(1)
            }}
            buttonClassName={styles.button}
            onHoverOpen
          />
          <PaginationPrevNext onNext={onNext} onPrev={onPrev} page={currentPage} />
        </div>
        {loading ? (
          <div>Loading...</div>
        ) : (transactions && transactions.length > 0) || (originalTxs && originalTxs.length > 0) ? (
          <Fragment>
            <TransactionTable
              // data={transactionType.key === TransactionSearchParams.pending ? originalTxs : transactions}
              data={transactions}
              txType={transactionType.key}
            />
            <div className={styles.paginationWrapper}>
              <Pagination
                onPageChange={(p) => setCurrentPage(p)}
                totalCount={totalTransactions || totalOriginalTxs}
                siblingCount={siblingCount}
                currentPage={currentPage}
                pageSize={pageSize}
              />
            </div>
          </Fragment>
        ) : (
          <div>No Data.</div>
        )}
      </ContentLayout>
    </div>
  )
}
