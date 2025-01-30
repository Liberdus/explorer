import { TransactionSearchType, Transaction, OriginalTxData, TransactionSearchParams, TransactionType } from '../../types'

export interface ReadableReceipt {
  blockHash: string
  blockNumber: string
  contractAddress: string
  cumulativeGasUsed: string
  data: string
  from: string
  gasUsed: string
  logs: Log[]
  nonce: string
  status: number
  to: string
  transactionHash: string
  transactionIndex: string
  value: string
  stakeInfo: StakeInfo
}

export interface WrappedEVMAccount {
  accountType: number
  ethAddress: string
  hash: string
  readableReceipt: ReadableReceipt
  timestamp: number
  txFrom: string
  txId: string
  amountSpent?: string
}

export interface TransactionQuery {
  page?: number
  count?: number
  txType?: TransactionSearchType
  totalTxsDetail?: boolean
}

export const TransactionSearchList: {
  key: TransactionSearchType
  value: string
}[] = [
  { key: TransactionType.transfer, value: 'Transfer Txns' },
  { key: TransactionType.message, value: 'Message Txns' },
  { key: TransactionType.deposit_stake, value: 'Deposit Stake Txns' },
  { key: TransactionType.withdraw_stake, value: 'Withdraw Stake Txns' },
  { key: TransactionSearchParams.pending, value: 'Pending Transactions' },
]

export interface StakeInfo {
  nominee: string
  stake?: string
  totalStakeAmount?: string
  penalty?: string
  reward?: string
  totalUnstakeAmount?: string
}

export interface Log {
  logIndex: number
  address: number
  topics: string[]
  data: string
}

export type PagedTransaction = {
  transactions: Transaction[]
  totalPages: number
  totalTransactions: number
  totalTransferTxs: number
  totalMessageTxs: number
  totalDepositStakeTxs: number
  totalWithdrawStakeTxs: number
  originalTxs: OriginalTxData[]
  totalOriginalTxs: number
  loading: boolean
}
