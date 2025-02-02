import { useCallback, useEffect, useState } from 'react'
import { api, PATHS } from '../../api'
import {
  Account,
  Transaction,
  TransactionSearchType,
  TransactionType,
} from '../../../types'

interface detailProps {
  id: string
  txType?: TransactionSearchType
}

export type AccountDetails = {
  account: Account | undefined
  transactions: Transaction[]
  totalPages: number
  totalTransactions: number
  page: number
  transactionType: TransactionSearchType
  setPage: (page: number) => void
  setTransactionType: (type: TransactionSearchType) => void
}

export const useAccountDetailHook = ({ id, txType }: detailProps): AccountDetails => {
  const [account, setAccount] = useState<Account>()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [totalPages, setTotalPages] = useState<number>(1)
  const [totalTransactions, setTotalTransactions] = useState<number>(0)
  const [page, setPage] = useState<number>(1)
  const [transactionType, setTransactionType] = useState<TransactionSearchType>(
    txType || TransactionType.transfer
  )

  const getAccount = useCallback(async () => {
    const data = await api.get(`${PATHS.ACCOUNT}?accountId=${id}`)

    return data?.data?.accounts as Account[]
  }, [id])

  const getTransaction = useCallback(async () => {
    const data = await api.get(`${PATHS.TRANSACTION}?accountId=${id}&page=${page}&txSearchType=${transactionType}`)

    return {
      transactions: data?.data?.transactions as Transaction[],
      totalTransactions: data?.data?.totalTransactions,
      totalPages: data?.data?.totalPages,
    }
  }, [id, page, transactionType])

  useEffect(() => {
    setTransactions([])
    setAccount(undefined)

    async function fetchData(): Promise<void> {
      const accounts = await getAccount()

      if (accounts && accounts.length > 0 && accounts[0].accountId) {
        setAccount(accounts[0])
        const { totalTransactions, transactions, totalPages } = await getTransaction()

        setTransactions(transactions as Transaction[])
        setTotalTransactions(totalTransactions)
        setTotalPages(totalPages)
      }
    }

    fetchData()
  }, [id, getAccount, getTransaction])

  return {
    account,
    transactions,
    totalTransactions,
    totalPages,
    page,
    setPage,
    transactionType,
    setTransactionType,
  }
}
