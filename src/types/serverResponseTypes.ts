import { BalanceChange } from '../storage/accountHistoryState'
import { OriginalTxData } from './originalTxData'

export type ErrorResponse = {
  success: boolean
  error: string
}

export type ReceiptResponse = {
  success: boolean
  receipts?: unknown
  totalPages?: number
  totalReceipts?: number
}

export type OriginalTxResponse = {
  success: boolean
  originalTxs?: OriginalTxData[] | number
  totalPages?: number
  totalOriginalTxs?: number
}

export type TransactionResponse = {
  success: boolean
  transactions?: Array<unknown>
  totalPages?: number
  totalTransactions?: number
  balanceChanges?: BalanceChange[]
}

export type AccountResponse = {
  success: boolean
  accounts?: unknown
  totalPages?: number
  totalAccounts?: number
}

export type CoinResponse = {
  success: boolean
  lastUpdatedCycle: number
  totalSupply: number
  totalStaked: number
}
