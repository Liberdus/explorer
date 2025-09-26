import { Message } from './transaction'

/** Same as type AccountsCopy in the shardus core */
export type AccountsCopy = {
  accountId: string
  data: any // eslint-disable-line @typescript-eslint/no-explicit-any
  timestamp: number
  hash: string
  cycleNumber: number
  isGlobal: boolean
}

export interface Account extends AccountsCopy {
  createdTimestamp?: number // Automatically handled by SQL triggers - always preserves the oldest timestamp ( based on logic in src/storage/index.ts )
  accountType?: AccountType
}

/**
 * ---------------------- ACCOUNT export interfaceS ----------------------
 */

export interface UserAccount {
  id: string
  type: string
  data: {
    balance: bigint
    toll: bigint | null
    chats: chatMessages
    chatTimestamp: number
    friends: object
    stake?: bigint
    remove_stake_request: number | null
    // transactions: object[]
    payments: DeveloperPayment[]
  }
  alias: string | null
  emailHash: string | null
  verified: string | boolean
  lastMaintenance: number
  claimedSnapshot: boolean
  timestamp: number
  hash: string
  operatorAccountInfo?: OperatorAccountInfo
  publicKey: string
}

interface chatMessages {
  [address: string]: {
    receivedTimestamp: number
    chatId: string
  }
}

export interface OperatorAccountInfo {
  stake: bigint
  nominee: string
  certExp: number
  operatorStats: OperatorStats
}

export interface OperatorStats {
  //update when node is rewarded/penalized (exits)
  totalNodeReward: bigint
  totalNodePenalty: bigint
  totalNodeTime: number
  //push begin and end times when rewarded
  history: { b: number; e: number }[]

  //update then unstaked
  totalUnstakeReward: bigint
  unstakeCount: number

  lastStakedNodeKey: string
}

export interface NodeAccount {
  id: string
  type: string
  balance: bigint
  nodeRewardTime: number // TODO: remove
  hash: string
  timestamp: number
  nominator: string
  stakeLock: bigint //amount of coins in
  stakeTimestamp: number
  reward: bigint
  rewardStartTime: number
  rewardEndTime: number
  penalty: bigint
  nodeAccountStats: NodeAccountStats
  rewarded: boolean
  rewardRate: bigint
}

export interface NodeAccountStats {
  //update when node is rewarded/penalized (exits)
  totalReward: bigint
  totalPenalty: bigint
  //push begin and end times when rewarded
  history: { b: number; e: number }[]
  lastPenaltyTime: number
  penaltyHistory: { type: ViolationType; amount: bigint; timestamp: number }[]
}

export interface ChatAccount {
  id: string
  type: string
  messages: Message[]
  timestamp: number
  hash: string
}

export interface AliasAccount {
  id: string
  type: string
  hash: string
  inbox: string
  address: string
  timestamp: number
}

export interface NetworkAccount {
  id: string
  type: string
  listOfChanges: Array<{
    cycle: number
    change: any
    appData: any
  }>
  current: NetworkParameters
  next: NetworkParameters | object
  windows: Windows
  nextWindows: Windows | object
  devWindows: DevWindows
  nextDevWindows: DevWindows | object
  issue: number
  devIssue: number
  developerFund: DeveloperPayment[]
  nextDeveloperFund: DeveloperPayment[]
  hash: string
  timestamp: number
  snapshot?: object
}

export interface IssueAccount {
  id: string
  type: string
  active: boolean | null
  proposals: string[]
  proposalCount: number
  tallied: boolean
  number: number | null
  winnerId: string | null
  hash: string
  timestamp: number
}

export interface DevIssueAccount {
  id: string
  type: string
  devProposals: string[]
  devProposalCount: number
  winners: string[]
  active: boolean | null
  tallied: boolean
  number: number | null
  hash: string
  timestamp: number
}

export interface ProposalAccount {
  id: string
  type: string
  power: number
  totalVotes: number
  parameters: NetworkParameters
  winner: boolean
  number: number | null
  hash: string
  timestamp: number
}

export interface DevProposalAccount {
  id: string
  type: string
  approve: bigint
  reject: bigint
  title: string | null
  description: string | null
  totalVotes: number
  totalAmount: bigint | null
  payAddress: string
  payments: DeveloperPayment[]
  approved: boolean | null
  number: number | null
  hash: string
  timestamp: number
}

export type Accounts = NetworkAccount &
  IssueAccount &
  DevIssueAccount &
  UserAccount &
  AliasAccount &
  ProposalAccount &
  DevProposalAccount &
  NodeAccount &
  ChatAccount
export type AccountVariant =
  | NetworkAccount
  | IssueAccount
  | DevIssueAccount
  | UserAccount
  | AliasAccount
  | ProposalAccount
  | DevProposalAccount
  | NodeAccount
  | ChatAccount

/**
 * ---------------------- NETWORK DATA export interfaceS ----------------------
 */

export interface NetworkParameters {
  title: string
  description: string
  nodeRewardInterval: number
  transactionFee: bigint
  maintenanceInterval: number
  maintenanceFee: bigint
  proposalFee: bigint
  devProposalFee: bigint
  faucetAmount: bigint
  defaultToll: bigint
  nodeRewardAmountUsd: bigint
  nodePenaltyUsd: bigint
  stakeRequiredUsd: bigint
  restakeCooldown: number
  stabilityScaleMul: number
  stabilityScaleDiv: number
  minVersion: string
  activeVersion: string
  latestVersion: string
  archiver: {
    minVersion: string
    activeVersion: string
    latestVersion: string
  }
  txPause: boolean
  certCycleDuration: number
  enableNodeSlashing: boolean
  slashing: {
    enableLeftNetworkEarlySlashing: boolean
    enableSyncTimeoutSlashing: boolean
    enableNodeRefutedSlashing: boolean
    leftNetworkEarlyPenaltyPercent: number
    syncTimeoutPenaltyPercent: number
    nodeRefutedPenaltyPercent: number
  }
}

export interface Windows {
  proposalWindow: number[]
  votingWindow: number[]
  graceWindow: number[]
  applyWindow: number[]
}

export interface DevWindows {
  devProposalWindow: number[]
  devVotingWindow: number[]
  devGraceWindow: number[]
  devApplyWindow: number[]
}

export interface DeveloperPayment {
  id: string
  address: string
  amount: bigint
  delay: number
  timestamp: number
}

export enum ViolationType {
  ShardusCoreMaxID = 999,
  LiberdusMinID = 1000,
  // 0-999 reserved for shardus core
  LeftNetworkEarly = 1000,
  SyncingTooLong = 1001,
  DoubleVote = 1002,
  NodeRefuted = 1003,
  //..others tbd

  LiberdusMaxID = 2000,
}

export enum AccountType {
  UserAccount = 'UserAccount',
  NodeAccount = 'NodeAccount',
  AliasAccount = 'AliasAccount',
  ChatAccount = 'ChatAccount',
  NetworkAccount = 'NetworkAccount',
  IssueAccount = 'IssueAccount',
  DevIssueAccount = 'DevIssueAccount',
  ProposalAccount = 'ProposalAccount',
  DevProposalAccount = 'DevProposalAccount',
}

export enum AccountSearchParams {
  'all', // All Accounts Type
  // e.g 'UserAndNodeAccounts' for User and Node Accounts
}

export type AccountSearchType = AccountType | AccountSearchParams
