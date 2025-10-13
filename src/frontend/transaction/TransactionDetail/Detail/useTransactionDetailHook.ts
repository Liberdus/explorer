import { useCallback, useEffect, useState } from 'react'
import { api, PATHS } from '../../../api'
import { Receipt, Transaction } from '../../../../types'
import { BalanceChange } from '../../../../storage/accountHistoryState'

interface TransactionDetailHookResult {
  transactionData: Transaction
  receiptData: Receipt
  showReceipt: boolean
  setShowReceipt: (show: boolean) => void
  balanceChanges: BalanceChange[]
}

export const useTransactionDetailHook = (txId: string): TransactionDetailHookResult => {
  const [transactionData, setTransactionData] = useState<Transaction>({} as Transaction)
  const [receiptData, setReceiptData] = useState({} as Receipt)
  const [showReceipt, setShowReceipt] = useState(false)
  const [balanceChanges, setBalanceChanges] = useState<BalanceChange[]>([])

  const getTransaction = useCallback(async () => {
    const data = await api.get(`${PATHS.TRANSACTION_DETAIL}?txId=${txId}&balanceChanges=true&requery=true`)
    let transaction = {} as Transaction
    if (txId) transaction = data?.data?.transactions?.filter((tx: Transaction) => tx.txId === txId)?.[0]
    else transaction = data?.data?.transactions?.[0]
    return { transaction, balanceChanges: data?.data?.balanceChanges || [] }
  }, [txId])

  const getReceipt = useCallback(async () => {
    const data = await api.get(`${PATHS.RECEIPT_DETAIL}?txId=${txId}`)
    if (data?.data?.receipts) {
      return {
        receiptData: data?.data?.receipts?.[0],
      }
    }
    return {
      receiptData: {},
    }
  }, [txId])

  useEffect(() => {
    if (!txId) return
    async function fetchData(): Promise<void> {
      if (showReceipt) {
        const data = await getReceipt()
        setReceiptData(data?.receiptData)
      } else {
        const data = await getTransaction()
        setTransactionData(data.transaction)
        setBalanceChanges(data.balanceChanges)
      }
    }

    fetchData()
  }, [txId, showReceipt, getReceipt, getTransaction])

  return {
    transactionData,
    receiptData,
    showReceipt,
    setShowReceipt,
    balanceChanges,
  }
}
