import { useCallback, useEffect, useState } from 'react'
import { api, PATHS } from '../../api'
import { Account, Transaction, TransactionSearchParams, TransactionSearchType } from '../../../types'
import { isEthereumAddress, isShardusAddress, toShardusAddress } from '../../utils/transformAddress'

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
    txType || TransactionSearchParams.all
  )

  const getAccount = useCallback(async () => {
    if (!id) return
    if (isEthereumAddress(id) && isShardusAddress(id)) return
    const accountId = (isEthereumAddress(id) && toShardusAddress(id)) || id
    const data = await api.get(`${PATHS.ACCOUNT}?accountId=${accountId}`)

    return data?.data?.accounts as Account[]
  }, [id])

  const getTransaction = useCallback(async () => {
    if (!id) return
    if (isEthereumAddress(id) && isShardusAddress(id)) return
    const accountId = (isEthereumAddress(id) && toShardusAddress(id)) || id
    const data = await api.get(
      `${PATHS.TRANSACTION}?accountId=${accountId}&page=${page}&txSearchType=${transactionType}`
    )

    return {
      transactions: (data?.data?.transactions as Transaction[]) || [],
      totalTransactions: data?.data?.totalTransactions || 0,
      totalPages: data?.data?.totalPages || 1,
    }
  }, [id, page, transactionType])

  useEffect(() => {
    setTransactions([])
    setAccount(undefined)

    async function fetchData(): Promise<void> {
      const accounts = await getAccount()

      if (accounts && accounts.length > 0 && accounts[0].accountId) {
        setAccount(accounts[0])
        setPage(1)
      }
    }

    fetchData()
  }, [getAccount])

  useEffect(() => {
    async function fetchData(): Promise<void> {
      const res = await getTransaction()
      if (!res) return
      const { transactions, totalTransactions, totalPages } = res
      setTransactions(transactions as Transaction[])
      setTotalTransactions(totalTransactions)
      setTotalPages(totalPages)
    }

    fetchData()
  }, [getTransaction])

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
