import useSWR from 'swr'
import { TransactionQuery } from '../types'
import { OriginalTxData, Transaction } from '../../types'
import { fetcher } from './fetcher'

import { PATHS } from './paths'
import { PagedTransaction } from '../types/transaction'

export const useTransaction = (query: TransactionQuery): PagedTransaction => {
  const { page, count, txType, totalTxsDetail = false } = query

  const createUrl = (): string => {
    let url = `${PATHS.TRANSACTION}?page=${page}`

    if (count) url = `${PATHS.TRANSACTION}?count=${count}`
    if (txType) {
      url += `&txSearchType=${txType}`
    }
    return url
  }

  const { data } = useSWR<PagedTransaction>(createUrl(), fetcher)

  const transactions: Transaction[] = data?.transactions || []
  const originalTxs: OriginalTxData[] = data?.originalTxs || []

  const response = useSWR<PagedTransaction>(
    totalTxsDetail ? `${PATHS.TRANSACTION}?totalTxsDetail=true` : null,
    fetcher
  )

  return {
    transactions,
    originalTxs,
    totalPages: data?.totalPages || 0,
    totalTransactions: response?.data?.totalTransactions || 0,
    totalOriginalTxs: data?.totalOriginalTxs || 0,
    totalTransferTxs: response?.data?.totalTransferTxs || 0,
    totalMessageTxs: response?.data?.totalMessageTxs || 0,
    totalDepositStakeTxs: response?.data?.totalDepositStakeTxs || 0,
    totalWithdrawStakeTxs: response?.data?.totalWithdrawStakeTxs || 0,
    loading: !data,
  }
}
