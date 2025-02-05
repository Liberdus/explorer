import React, { useState } from 'react'
import { useRouter } from 'next/router'
import moment from 'moment'
import { ContentLayout, CopyButton, Spacer, Pagination } from '../../components'
import { Tab } from '../../components/Tab'
import { DetailCard } from '../DetailCard'

import { useAccountDetailHook } from './useAccountDetailHook'

import styles from './AccountDetail.module.scss'
import { AccountType, TransactionSearchParams, TransactionSearchType } from '../../../types'

import { calculateFullValue } from '../../utils/calculateValue'

import { TransactionTable } from '../../transaction'
import { TransactionType } from '../../../types'
import { breadcrumbsList } from '../../types'
import { toEthereumAddress } from '../../utils/transformAddress'

export const AccountDetail: React.FC = () => {
  const router = useRouter()

  const id = router?.query?.id
  const txType = router?.query?.txType as TransactionSearchType

  const siblingCount = 3
  const pageSize = 10

  const { account, totalTransactions, page, transactions, setTransactionType, setPage } =
    useAccountDetailHook({
      id: id as string,
      txType,
    })

  const tabs = [
    {
      key: TransactionSearchParams.all as TransactionSearchType,
      value: 'All Txns',
      content: (
        <>
          {transactions.length > 0 ? (
            <>
              <TransactionTable data={transactions} txType={TransactionSearchParams.all} />
              <div className={styles.paginationWrapper}>
                <Pagination
                  onPageChange={(p) => setPage(p)}
                  totalCount={totalTransactions}
                  siblingCount={siblingCount}
                  currentPage={page}
                  pageSize={pageSize}
                />
              </div>
            </>
          ) : (
            <div>No Data.</div>
          )}
        </>
      ),
    },
    {
      key: TransactionType.transfer as TransactionSearchType,
      value: 'Transfer Txns',
      content: (
        <>
          {transactions.length > 0 ? (
            <>
              <TransactionTable data={transactions} txType={TransactionType.transfer} />
              <div className={styles.paginationWrapper}>
                <Pagination
                  onPageChange={(p) => setPage(p)}
                  totalCount={totalTransactions}
                  siblingCount={siblingCount}
                  currentPage={page}
                  pageSize={pageSize}
                />
              </div>
            </>
          ) : (
            <div>No Data.</div>
          )}
        </>
      ),
    },
    {
      key: TransactionType.message,
      value: 'Message Txns',
      content: (
        <>
          {transactions.length > 0 ? (
            <>
              <TransactionTable data={transactions} txType={TransactionType.message} />
              <div className={styles.paginationWrapper}>
                <Pagination
                  onPageChange={(p) => setPage(p)}
                  totalCount={totalTransactions}
                  siblingCount={siblingCount}
                  currentPage={page}
                  pageSize={pageSize}
                />
              </div>
            </>
          ) : (
            <div>No Data.</div>
          )}
        </>
      ),
    },
    {
      key: TransactionType.deposit_stake,
      value: 'Deposit Stake Txns',
      content: (
        <>
          {transactions.length > 0 ? (
            <>
              <TransactionTable data={transactions} txType={TransactionType.deposit_stake} />
              <div className={styles.paginationWrapper}>
                <Pagination
                  onPageChange={(p) => setPage(p)}
                  totalCount={totalTransactions}
                  siblingCount={siblingCount}
                  currentPage={page}
                  pageSize={pageSize}
                />
              </div>
            </>
          ) : (
            <div>No Data.</div>
          )}
        </>
      ),
    },
    {
      key: TransactionType.withdraw_stake,
      value: 'Withdraw Stake Txns',
      content: (
        <>
          {transactions.length > 0 ? (
            <>
              <TransactionTable data={transactions} txType={TransactionType.withdraw_stake} />
              <div className={styles.paginationWrapper}>
                <Pagination
                  onPageChange={(p) => setPage(p)}
                  totalCount={totalTransactions}
                  siblingCount={siblingCount}
                  currentPage={page}
                  pageSize={pageSize}
                />
              </div>
            </>
          ) : (
            <div>No Data.</div>
          )}
        </>
      ),
    },
  ]

  const breadcrumbs = [breadcrumbsList.dashboard, breadcrumbsList.account]

  const [activeTab, setActiveTab] = useState(tabs[0].key)

  return (
    <div className={styles.AccountDetail}>
      <ContentLayout
        title={
          <div className={styles.header}>
            <div className={styles.title}>
              Account ID -<span>&nbsp;&nbsp;{id ? toEthereumAddress(id as string) : ''}&nbsp;&nbsp;</span>
            </div>
            <CopyButton text={id ? toEthereumAddress(id as string) : ''} title="Copy address to clipboard" />
          </div>
        }
        breadcrumbItems={breadcrumbs}
        showBackButton
      >
        {account ? (
          <>
            <div className={styles.row}>
              <>
                {account.accountType === AccountType.UserAccount ? (
                  <DetailCard
                    title="Overview"
                    titleRight={null}
                    items={[
                      {
                        key: 'Account Type :',
                        value: account.accountType,
                      },
                      {
                        key: 'Username: ',
                        value: account?.data?.alias,
                      },
                      {
                        key: 'Balance :',
                        value: calculateFullValue(account?.data?.data?.balance) + '   LIB',
                      },
                      // {
                      //   key: 'Tokens :',
                      //   value: <TokenDropdown tokens={tokens} />,
                      // },
                    ]}
                  />
                ) : account?.accountType === AccountType.NodeAccount ? (
                  <DetailCard
                    title="Overview"
                    items={[
                      {
                        key: 'Account Type :',
                        value: account.accountType,
                      },
                      {
                        key: 'Node status',
                        value:
                          account?.data?.rewardStartTime > 0 && account?.data?.rewardEndTime === 0
                            ? 'Active'
                            : 'Inactive',
                      },
                      {
                        key: 'Nominator',
                        value: account?.data?.nominator && account?.data?.nominator,
                      },
                      {
                        key: 'StakeLock',
                        value:
                          account?.data?.stakeLock && calculateFullValue(`0x${account?.data?.stakeLock}`),
                      },
                    ]}
                    titleRight={null}
                  />
                ) : (
                  <DetailCard
                    title="Overview"
                    items={[
                      {
                        key: 'Account Type :',
                        value: account.accountType,
                      },
                    ]}
                    titleRight={null}
                  />
                )}
                {account.accountType === AccountType.NodeAccount && (
                  <DetailCard
                    title="More Info"
                    items={[
                      {
                        key: 'Reward Start Time',
                        value:
                          account?.data?.rewardStartTime &&
                          moment(account?.data?.rewardStartTime * 1000).calendar(),
                      },
                      {
                        key: 'Reward End Time',
                        value:
                          account?.data?.rewardEndTime &&
                          moment(account?.data?.rewardEndTime * 1000).calendar(),
                      },
                      {
                        key: 'Reward',
                        value: account?.data?.reward && calculateFullValue(`0x${account?.data?.reward}`),
                      },
                      {
                        key: 'Penalty',
                        value: account?.data?.penalty && calculateFullValue(`0x${account?.data?.penalty}`),
                      },
                    ]}
                  />
                )}
              </>
            </div>
            <Spacer space="64" />
            {account.accountType === AccountType.UserAccount ? (
              <Tab
                tabs={tabs}
                activeTab={activeTab}
                onClick={(tab) => {
                  setActiveTab(tab as TransactionSearchType)
                  setTransactionType(tab as TransactionSearchType)
                }}
              />
            ) : (
              <>
                <TransactionTable data={transactions} txType={TransactionSearchParams.all} />
                <div className={styles.paginationWrapper}>
                  <Pagination
                    onPageChange={(p) => setPage(p)}
                    totalCount={totalTransactions}
                    siblingCount={siblingCount}
                    currentPage={page}
                    pageSize={pageSize}
                  />
                </div>
              </>
            )}
          </>
        ) : (
          <>
            <div>Account Not Found!</div>
            <Spacer space="64" />
            <Spacer space="64" />
            <Spacer space="64" />
          </>
        )}
      </ContentLayout>
    </div>
  )
}
