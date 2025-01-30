import { useCallback, useEffect, useState } from 'react'
import { api, PATHS } from '../../../api'
import { Receipt, Transaction } from '../../../../types'

interface TransactionDetailHookResult<D extends object> {
  transactionData: Transaction
  receiptData: Receipt
  showReceipt: boolean
  setShowReceipt: (show: boolean) => void
}

export const useTransactionDetailHook = <D extends object>(
  txId: string
): TransactionDetailHookResult<D> => {
  const [transactionData, setTransactionData] = useState<Transaction>({} as Transaction)
  const [receiptData, setReceiptData] = useState({} as Receipt)
  const [showReceipt, setShowReceipt] = useState(false)

  const getTransaction = useCallback(async () => {
    const data = await api.get(`${PATHS.TRANSACTION_DETAIL}?txId=${txId}&type=requery`)
    let transaction = {} as Transaction
    if (txId) transaction = data?.data?.transactions?.filter((tx: Transaction) => tx.txId === txId)?.[0]
    else transaction = data?.data?.transactions?.[0]
    return transaction
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
        const transaction = await getTransaction()
        setTransactionData(transaction)
      }
    }

    fetchData()
  }, [txId, showReceipt, getReceipt, getTransaction])

  return {
    transactionData,
    receiptData,
    showReceipt,
    setShowReceipt,
  }
}
