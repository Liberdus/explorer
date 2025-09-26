import { Signature } from '@shardus/crypto-utils'

export interface Transaction {
  txId: string
  // appReceiptId?: string // Dapp receipt id (eg. txhash for the EVM receipt in shardeum)
  timestamp: number
  cycleNumber: number
  data: any & { txId?: string }
  originalTxData: unknown & { tx: any } // eslint-disable-line @typescript-eslint/no-explicit-any
  transactionType: TransactionType
  txFrom?: string
  txTo?: string
  txFee?: number
}

export interface BaseLiberdusTx {
  timestamp: number
  type: TransactionType
  sign: Signature
}

export interface Message extends BaseLiberdusTx {
  from: string
  to: string
  chatId: string
  message: string
}

// Liberdus Transaction Types
// https://github.com/Liberdus/server/blob/4acd5f4800c20e9904979724f38547572768de99/src/@types/index.ts#L72
export enum TransactionType {
  init_network = 'init_network',
  network_windows = 'network_windows',
  snapshot = 'snapshot',
  email = 'email',
  gossip_email_hash = 'gossip_email_hash',
  verify = 'verify',
  register = 'register',
  create = 'create',
  transfer = 'transfer',
  distribute = 'distribute',
  message = 'message',
  read = 'read',
  reclaim_toll = 'reclaim_toll',
  update_chat_toll = 'update_chat_toll',
  update_toll_required = 'update_toll_required',
  toll = 'toll',
  friend = 'friend',
  remove_friend = 'remove_friend',
  stake = 'stake',
  remove_stake = 'remove_stake',
  remove_stake_request = 'remove_stake_request',
  node_reward = 'node_reward',
  snapshot_claim = 'snapshot_claim',
  issue = 'issue',
  proposal = 'proposal',
  vote = 'vote',
  tally = 'tally',
  apply_tally = 'apply_tally',
  parameters = 'parameters',
  apply_parameters = 'apply_parameters',
  dev_issue = 'dev_issue',
  dev_proposal = 'dev_proposal',
  dev_vote = 'dev_vote',
  dev_tally = 'dev_tally',
  apply_dev_tally = 'apply_dev_tally',
  dev_parameters = 'dev_parameters',
  apply_dev_parameters = 'apply_dev_parameters',
  developer_payment = 'developer_payment',
  apply_developer_payment = 'apply_developer_payment',
  change_config = 'change_config',
  apply_change_config = 'apply_change_config',
  change_network_param = 'change_network_param',
  apply_change_network_param = 'apply_change_network_param',
  deposit_stake = 'deposit_stake',
  withdraw_stake = 'withdraw_stake',
  set_cert_time = 'set_cert_time',
  // query_certificate = 'query_certificate', // This is not an actual transaction in the network
  init_reward = 'init_reward',
  claim_reward = 'claim_reward',
  apply_penalty = 'apply_penalty',
}

export enum TransactionSearchParams {
  all = 'all',
  // pending = 'pending',
  stakingTxs = 'stakingTxs',
}

export type TransactionSearchType = TransactionType | TransactionSearchParams
