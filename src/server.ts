// require("dotenv").config();
import path from 'path'
import fs from 'fs'
import fastifyCors from '@fastify/cors'
import fastifyNextjs from '@fastify/nextjs'
import fastifyRateLimit from '@fastify/rate-limit'
import * as crypto from '@shardus/crypto-utils'
import Fastify, { FastifyRequest } from 'fastify'
import * as usage from './middleware/usage'
import * as Storage from './storage'
import { AccountDB, CycleDB, ReceiptDB, TransactionDB, OriginalTxDataDB } from './storage'
import * as StatsStorage from './stats'
import {
  ValidatorStatsDB,
  TransactionStatsDB,
  DailyTransactionStatsDB,
  CoinStatsDB,
  NodeStatsDB,
} from './stats'
import {
  Account,
  AccountSearchType,
  AccountType,
  OriginalTxResponse,
  Transaction,
  TransactionSearchType,
  TransactionSearchParams,
  TransactionType,
  AccountSearchParams,
} from './types'
import {
  coinStatsCacheRecord,
  isCacheRecordValid,
  transactionStatsCacheRecord,
  validatorStatsCacheRecord,
} from './class/cache_per_cycle'
import { AccountResponse, CoinResponse, ErrorResponse, ReceiptResponse, TransactionResponse } from './types'
import * as utils from './utils'
// config variables
import { config, envEnum } from './config'
import { Utils as StringUtils } from '@shardus/types'
import { healthCheckRouter } from './routes/healthCheck'
import { ValidatorStats } from './stats/validatorStats'
import { TransactionStats } from './stats/transactionStats'
import { DailyTransactionStats } from './stats/dailyTransactionStats'

if (config.env == envEnum.DEV) {
  //default debug mode
  //  pragma: allowlist nextline secret
  config.USAGE_ENDPOINTS_KEY = 'ceba96f6eafd2ea59e68a0b0d754a939'
} else {
  // Pull in secrets
  const secretsPath = path.join(__dirname, '../.secrets')
  const secrets = {}

  if (fs.existsSync(secretsPath)) {
    const lines = fs.readFileSync(secretsPath, 'utf-8').split('\n').filter(Boolean)

    lines.forEach((line) => {
      const [key, value] = line.split('=')
      secrets[key.trim()] = value.trim()
    })
  }

  if (secrets['USAGE_ENDPOINTS_KEY'] === undefined) config.USAGE_ENDPOINTS_KEY = ''
  else config.USAGE_ENDPOINTS_KEY = secrets['USAGE_ENDPOINTS_KEY']
}

crypto.init(config.hashKey)
crypto.setCustomStringifier(StringUtils.safeStringify, 'shardus_safeStringify')

if (process.env.PORT) {
  config.port.server = process.env.PORT
}

console.log(process.argv)
const port = process.argv[2]
if (port) {
  config.port.server = port
}
console.log('Port', config.port.server)

export const addExitListeners = (): void => {
  process.on('SIGINT', async () => {
    console.log('Exiting on SIGINT')
    await Storage.closeDatabase()
    await StatsStorage.closeStatsDatabase()
    process.exit(0)
  })
  process.on('SIGTERM', async () => {
    console.log('Exiting on SIGTERM')
    await Storage.closeDatabase()
    await StatsStorage.closeStatsDatabase()
    process.exit(0)
  })
}

let txIdQueryCache = new Map()
const txIdQueryCacheSize = 1000

// Setup Log Directory
const start = async (): Promise<void> => {
  await Storage.initializeDB()
  await StatsStorage.initializeStatsDB()
  addExitListeners()

  const server = Fastify({
    logger: config.fastifyDebugLog,
    pluginTimeout: 120_000,
  })

  await server.register(fastifyCors)
  await server.register(fastifyRateLimit, {
    max: config.rateLimit,
    timeWindow: '1 minute',
    allowList: ['127.0.0.1', 'localhost'],
  })
  await server.register(healthCheckRouter)
  server.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    try {
      const jsonString = typeof body === 'string' ? body : body.toString('utf8')
      done(null, StringUtils.safeJsonParse(jsonString))
    } catch (err) {
      err.statusCode = 400
      done(err, undefined)
    }
  })

  server.setReplySerializer((payload) => {
    return StringUtils.safeStringify(payload)
  })

  server
    .register(fastifyNextjs, {
      dev: config.env !== 'production',
      logLevel: 'debug',
      noServeAssets: false,
    })

    .after(() => {
      server.next('/*')
    })

  // await server.register(fastifyMiddie)
  server.addHook('preHandler', usage.usageMiddleware)
  server.addHook('onError', usage.usageErrorMiddleware)
  server.post('/usage/enable', usage.usageEnableHandler)
  server.post('/usage/disable', usage.usageDisableHandler)
  server.get('/usage/metrics', usage.usageMetricsHandler)

  server.get('/port', (req, reply) => {
    reply.send({ port: config.port.server })
  })

  type CycleDataRequest = FastifyRequest<{
    Querystring: {
      count: string
      cycleNumber: string
      start: string
      end: string
      marker: string
    }
  }>

  server.get('/api/cycleinfo', async (_request: CycleDataRequest, reply) => {
    const err = utils.validateTypes(_request.query, {
      count: 's?',
      cycleNumber: 's?',
      start: 's?',
      end: 's?',
      marker: 's?',
    })
    if (err) {
      reply.send({ success: false, error: err })
      return
    }
    const query = _request.query
    // Check at least one of the query parameters is present
    if (!query.count && !query.cycleNumber && !query.start && !query.end && !query.marker) {
      reply.send({
        success: false,
        error: 'not specified which cycleinfo to query',
      })
    }
    let cycles = []
    if (query.count) {
      const count: number = parseInt(query.count)
      if (count <= 0 || Number.isNaN(count)) {
        reply.send({ success: false, error: 'Invalid count' })
        return
      }
      if (count > config.requestLimits.MAX_CYCLES_PER_REQUEST) {
        reply.send({
          success: false,
          error: `Maximum count is ${config.requestLimits.MAX_CYCLES_PER_REQUEST}`,
        })
        return
      }
      cycles = await CycleDB.queryLatestCycleRecords(count)
    } else if (query.cycleNumber) {
      const cycleNumber: number = parseInt(query.cycleNumber)
      if (cycleNumber < 0 || Number.isNaN(cycleNumber)) {
        reply.send({ success: false, error: 'Invalid cycleNumber' })
        return
      }
      const cycle = await CycleDB.queryCycleByCounter(cycleNumber)
      if (cycle) cycles = [cycle]
    } else if (query.start && query.end) {
      const from = parseInt(query.start)
      const to = parseInt(query.end)
      if (!(from >= 0 && to >= from) || Number.isNaN(from) || Number.isNaN(to)) {
        console.log('Invalid start and end counters for cycleinfo')
        reply.send({
          success: false,
          error: 'Invalid from and to counter for cycleinfo',
        })
        return
      }
      cycles = await CycleDB.queryCycleRecordsBetween(from, to)
      /* prettier-ignore */ if (config.verbose) console.log('cycles', cycles);
    } else if (query.marker) {
      const cycle = await CycleDB.queryCycleByMarker(query.marker)
      if (cycle) {
        cycles.push(cycle)
      }
    }
    const res = {
      success: true,
      cycles,
    }
    reply.send(res)
  })

  type AccountDataRequest = FastifyRequest<{
    Querystring: {
      count: string
      page: string
      accountSearchType: AccountSearchType
      startCycle: string
      endCycle: string
      accountId: string
    }
  }>

  server.get('/api/account', async (_request: AccountDataRequest, reply) => {
    const err = utils.validateTypes(_request.query, {
      count: 's?',
      page: 's?',
      accountSearchType: 's?',
      startCycle: 's?',
      endCycle: 's?',
      accountId: 's?',
    })
    if (err) {
      reply.send({ success: false, error: err })
      return
    }
    const query = _request.query
    // Check at least one of the query parameters is present
    if (
      !query.count &&
      !query.page &&
      !query.accountSearchType &&
      !query.startCycle &&
      !query.endCycle &&
      !query.accountId
    ) {
      reply.send({
        success: false,
        error: 'not specified which account to query',
      })
      return
    }
    const itemsPerPage = 10
    let totalPages = 0
    let totalAccounts = 0
    let accountSearchType: AccountSearchType
    let startCycle = 0
    let endCycle = 0
    let page = 1
    const res: AccountResponse = {
      success: true,
      accounts: [] as Account[],
    }
    if (query.accountSearchType) {
      if (
        typeof AccountType[query.accountSearchType] === 'undefined' &&
        typeof AccountSearchParams[query.accountSearchType] === 'undefined'
      ) {
        reply.send({ success: false, error: 'Invalid account search type' })
        return
      }
    }
    if (query.count) {
      const count: number = parseInt(query.count)
      if (count <= 0 || Number.isNaN(count)) {
        reply.send({ success: false, error: 'Invalid count' })
        return
      }
      if (count > config.requestLimits.MAX_ACCOUNTS_PER_REQUEST) {
        reply.send({
          success: false,
          error: `Maximum count is ${config.requestLimits.MAX_ACCOUNTS_PER_REQUEST}`,
        })
        return
      }
      res.accounts = await AccountDB.queryAccounts(0, count, null, null, accountSearchType)
      res.totalAccounts = await AccountDB.queryAccountCount(null, null, accountSearchType)
      reply.send(res)
      return
    } else if (query.accountId) {
      if (query.accountId.length !== 64) {
        reply.send({ success: false, error: 'Invalid account id' })
        return
      }
      const accountId = query.accountId.toLowerCase()
      const account = await AccountDB.queryAccountByAccountId(accountId)
      if (account) res.accounts = [account]
      reply.send(res)
      return
    }
    if (query.startCycle) {
      startCycle = parseInt(query.startCycle)
      if (startCycle < 0 || Number.isNaN(startCycle)) {
        reply.send({ success: false, error: 'Invalid start cycle number' })
        return
      }
      endCycle = startCycle
      if (query.endCycle) {
        endCycle = parseInt(query.endCycle)
        if (endCycle < 0 || Number.isNaN(endCycle) || endCycle < startCycle) {
          reply.send({ success: false, error: 'Invalid end cycle number' })
          return
        }
        if (endCycle - startCycle > config.requestLimits.MAX_BETWEEN_CYCLES_PER_REQUEST) {
          reply.send({
            success: false,
            error: `The cycle range is too big. Max cycle range is ${config.requestLimits.MAX_BETWEEN_CYCLES_PER_REQUEST} cycles.`,
          })
          return
        }
      }
    }
    if (query.page) {
      page = parseInt(query.page)
      if (page < 1 || Number.isNaN(page)) {
        reply.send({ success: false, error: 'Invalid page number' })
        return
      }
    }
    if (startCycle > 0 || endCycle > 0 || page > 0) {
      totalAccounts = await AccountDB.queryAccountCount(startCycle, endCycle, accountSearchType)
      res.totalAccounts = totalAccounts
    }
    totalPages = Math.ceil(totalAccounts / itemsPerPage)
    if (page > 1 && page > totalPages) {
      reply.send({
        success: false,
        error: 'Page no is greater than the totalPage',
      })
    }
    res.totalPages = totalPages
    if (totalAccounts > 0) {
      res.accounts = await AccountDB.queryAccounts(
        (page - 1) * itemsPerPage,
        itemsPerPage,
        null,
        null,
        accountSearchType
      )
    }
    reply.send(res)
  })

  type TransactionDataRequest = FastifyRequest<{
    Querystring: {
      count: string
      page: string
      txSearchType: string
      startCycle: string
      endCycle: string
      accountId: string
      txId: string
      startTimestamp: string
      endTimestamp: string
      requery: string
      totalTxsDetail: string
    }
  }>

  server.get('/api/transaction', async (_request: TransactionDataRequest, reply) => {
    const err = utils.validateTypes(_request.query, {
      count: 's?',
      page: 's?',
      accountId: 's?',
      txSearchType: 's?',
      startCycle: 's?',
      endCycle: 's?',
      txId: 's?',
      startTimestamp: 's?',
      endTimestamp: 's?',
      requery: 's?',
      totalTxsDetail: 's?',
    })
    if (err) {
      reply.send({ success: false, error: err })
      return
    }
    /* prettier-ignore */ if (config.verbose) console.log('Request', _request.query);
    const query = _request.query
    // Check at least one of the query parameters is present
    if (
      !query.count &&
      !query.page &&
      !query.accountId &&
      !query.txSearchType &&
      !query.startCycle &&
      !query.endCycle &&
      !query.txId &&
      !query.startTimestamp &&
      !query.endTimestamp &&
      !query.requery &&
      !query.totalTxsDetail
    ) {
      reply.send({
        success: false,
        reason: 'Not specified which transaction to query',
      })
      return
    }
    const itemsPerPage = 10
    let totalPages = 0
    let totalTransactions = 0
    let txSearchType: TransactionSearchType
    let startCycle = 0
    let endCycle = 0
    let page = 1
    let accountId = ''
    const res: TransactionResponse = {
      success: true,
      transactions: [] as Transaction[],
    }
    if (query.txSearchType) {
      txSearchType = query.txSearchType as TransactionSearchType
      // Check if the parsed value is a valid enum value
      if (
        typeof TransactionType[txSearchType] === 'undefined' &&
        typeof TransactionSearchParams[txSearchType] === 'undefined'
      ) {
        reply.send({ success: false, error: 'Invalid transaction search type' })
        return
      }
    }
    if (query.count) {
      const count: number = parseInt(query.count)
      if (count <= 0 || Number.isNaN(count)) {
        reply.send({ success: false, error: 'Invalid count' })
        return
      }
      if (count > config.requestLimits.MAX_TRANSACTIONS_PER_REQUEST) {
        reply.send({
          success: false,
          error: `Maximum count is ${config.requestLimits.MAX_TRANSACTIONS_PER_REQUEST}`,
        })
        return
      }
      res.transactions = await TransactionDB.queryTransactions(0, count, txSearchType)
      res.totalTransactions = await TransactionDB.queryTransactionCount(txSearchType)
      reply.send(res)
      return
    } else if (query.txId) {
      const txId = query.txId.toLowerCase()
      if (txId.length !== 64) {
        reply.send({ success: false, error: 'Invalid transaction id' })
        return
      }
      if (config.enableTxIdCache && (!query.requery || query.requery !== 'true')) {
        const found = txIdQueryCache.get(txId)
        if (found && found.success) return reply.send(found)
      }
      const transaction = await TransactionDB.queryTransactionByTxId(txId)
      if (transaction) {
        res.transactions = [transaction]
      } else if (config.findTxIdInOriginalTx) {
        const originalTx = await OriginalTxDataDB.queryOriginalTxDataByTxId(txId)
        if (originalTx) {
          // Assume the tx is expired if the original tx is more than 15 seconds old
          const ExpiredTxTimestamp_MS = 15000
          const txStatus = Date.now() - originalTx.timestamp > ExpiredTxTimestamp_MS ? 'Expired' : 'Pending'
          const transaction = [{ ...originalTx, txStatus }]
          res.transactions = [transaction]
        }
      }
      if (res.transactions.length === 0) {
        const res = {
          success: false,
          error: 'The transaction is not found!',
        }
        if (config.enableTxIdCache) txIdQueryCache.set(txId, res)
        return reply.send(res)
      }
      reply.send(res)
      if (config.enableTxIdCache) {
        txIdQueryCache.set(txId, { success: true, transactions: res.transactions })
        if (txIdQueryCache.size > txIdQueryCacheSize + 10) {
          // Remove old data
          const extra = txIdQueryCache.size - txIdQueryCacheSize
          const arrayTemp = Array.from(txIdQueryCache)
          arrayTemp.splice(0, extra)
          txIdQueryCache = new Map(arrayTemp)
        }
      }
      return
    } else if (query.totalTxsDetail === 'true') {
      const totalTransactions = await TransactionDB.queryTransactionCount()
      const totalTransferTxs = await TransactionDB.queryTransactionCount(TransactionType.transfer)
      const totalMessageTxs = await TransactionDB.queryTransactionCount(TransactionType.message)
      const totalDepositStakeTxs = await TransactionDB.queryTransactionCount(TransactionType.deposit_stake)
      const totalWithdrawStakeTxs = await TransactionDB.queryTransactionCount(TransactionType.withdraw_stake)
      const totalTxsDetail = {
        totalTransactions,
        totalTransferTxs,
        totalMessageTxs,
        totalDepositStakeTxs,
        totalWithdrawStakeTxs,
      }
      reply.send({ success: true, ...totalTxsDetail })
      return
    }
    if (query.accountId) {
      accountId = query.accountId.toLowerCase()
      if (accountId.length !== 64) {
        reply.send({ success: false, error: 'Invalid account id' })
        return
      }
    }
    if (query.startCycle) {
      startCycle = parseInt(query.startCycle)
      if (startCycle < 0 || Number.isNaN(startCycle)) {
        reply.send({ success: false, error: 'Invalid start cycle number' })
        return
      }
      endCycle = startCycle
      if (query.endCycle) {
        endCycle = parseInt(query.endCycle)
        if (endCycle < 0 || Number.isNaN(endCycle) || endCycle < startCycle) {
          reply.send({ success: false, error: 'Invalid end cycle number' })
          return
        }
        if (endCycle - startCycle > config.requestLimits.MAX_BETWEEN_CYCLES_PER_REQUEST) {
          reply.send({
            success: false,
            error: `The cycle range is too big. Max cycle range is ${config.requestLimits.MAX_BETWEEN_CYCLES_PER_REQUEST} cycles.`,
          })
          return
        }
      }
    }
    if (query.page) {
      page = parseInt(query.page)
      if (page < 1 || Number.isNaN(page)) {
        reply.send({ success: false, error: 'Invalid page number' })
        return
      }
    }
    if (accountId || startCycle > 0 || endCycle > 0 || page > 0 || txSearchType) {
      totalTransactions = await TransactionDB.queryTransactionCount(
        txSearchType,
        accountId,
        startCycle,
        endCycle
      )
      res.totalTransactions = totalTransactions
    }
    totalPages = Math.ceil(totalTransactions / itemsPerPage)
    if (page > 1 && page > totalPages) {
      reply.send({
        success: false,
        error: 'Page no is greater than the totalPage',
      })
    }
    res.totalPages = totalPages
    if (totalTransactions > 0) {
      res.transactions = await TransactionDB.queryTransactions(
        (page - 1) * itemsPerPage,
        itemsPerPage,
        txSearchType,
        accountId,
        startCycle,
        endCycle
      )
    }
    reply.send(res)
  })

  type ReceiptDataRequest = FastifyRequest<{
    Querystring: {
      count: string
      page: string
      txId: string
      startCycle: string
      endCycle: string
      tally: string
    }
  }>

  server.get('/api/receipt', async (_request: ReceiptDataRequest, reply) => {
    const err = utils.validateTypes(_request.query, {
      count: 's?',
      page: 's?',
      txId: 's?',
      startCycle: 's?',
      endCycle: 's?',
      tally: 's?',
    })
    if (err) {
      reply.send({ success: false, error: err })
      return
    }
    /* prettier-ignore */ if (config.verbose) console.log('Request', _request.query);
    const query = _request.query
    // Check at least one of the query parameters is present
    if (!query.count && !query.txId && !query.startCycle && !query.endCycle && !query.tally) {
      reply.send({
        success: false,
        reason: 'Not specified which receipt to query',
      })
      return
    }
    const itemsPerPage = 10
    let totalPages = 0
    let totalReceipts = 0
    let page = 1
    let startCycle = 0
    let endCycle = 0
    const res: ReceiptResponse = {
      success: true,
      receipts: [],
    }
    if (query.count) {
      const count: number = parseInt(query.count)
      if (count <= 0 || Number.isNaN(count)) {
        reply.send({ success: false, error: 'Invalid count' })
        return
      }
      if (count > config.requestLimits.MAX_RECEIPTS_PER_REQUEST) {
        reply.send({
          success: false,
          error: `Maximum count is ${config.requestLimits.MAX_RECEIPTS_PER_REQUEST}`,
        })
        return
      }
      res.receipts = await ReceiptDB.queryReceipts(0, count)
      res.totalReceipts = await ReceiptDB.queryReceiptCount()
      reply.send(res)
      return
    } else if (query.txId) {
      const txId: string = query.txId.toLowerCase()
      if (txId.length !== 64) {
        reply.send({ success: false, error: 'Invalid txId' })
        return
      }
      const receipts = await ReceiptDB.queryReceiptByReceiptId(txId)
      if (receipts) res.receipts = [receipts]
      reply.send(res)
      return
    }
    if (query.startCycle) {
      startCycle = parseInt(query.startCycle)
      if (startCycle < 0 || Number.isNaN(startCycle)) {
        reply.send({ success: false, error: 'Invalid start cycle number' })
        return
      }
      endCycle = startCycle
      if (query.endCycle) {
        endCycle = parseInt(query.endCycle)
        if (endCycle < 0 || Number.isNaN(endCycle) || endCycle < startCycle) {
          reply.send({ success: false, error: 'Invalid end cycle number' })
          return
        }
        if (endCycle - startCycle > config.requestLimits.MAX_BETWEEN_CYCLES_PER_REQUEST) {
          reply.send({
            success: false,
            error: `The cycle range is too big. Max cycle range is ${config.requestLimits.MAX_BETWEEN_CYCLES_PER_REQUEST} cycles.`,
          })
          return
        }
      }
    }
    if (query.tally === 'true') {
      const totalReceipts = await ReceiptDB.queryReceiptCountByCycles(startCycle, endCycle)
      reply.send({ success: true, totalReceipts })
      return
    }
    if (query.page) {
      page = parseInt(query.page)
      if (page < 1 || Number.isNaN(page)) {
        reply.send({ success: false, error: 'Invalid page number' })
        return
      }
    }
    if (startCycle > 0 || endCycle > 0 || page > 0) {
      totalReceipts = await ReceiptDB.queryReceiptCount(startCycle, endCycle)
      res.totalReceipts = totalReceipts
    }
    totalPages = Math.ceil(totalReceipts / itemsPerPage)
    if (page > 1 && page > totalPages) {
      reply.send({
        success: false,
        error: 'Page no is greater than the totalPage',
      })
    }
    res.totalPages = totalPages
    if (totalReceipts > 0) {
      res.receipts = await ReceiptDB.queryReceipts(
        (page - 1) * itemsPerPage,
        itemsPerPage,
        startCycle,
        endCycle
      )
    }
    reply.send(res)
  })

  type OriginalTxDataRequest = FastifyRequest<{
    Querystring: {
      count: string
      page: string
      txId: string
      accountId: string
      startCycle: string
      endCycle: string
      tally: string
    }
  }>

  server.get('/api/originalTx', async (_request: OriginalTxDataRequest, reply) => {
    const err = utils.validateTypes(_request.query, {
      count: 's?',
      page: 's?',
      txId: 's?',
      accountId: 's?',
      startCycle: 's?',
      endCycle: 's?',
      tally: 's?',
    })
    if (err) {
      reply.send({ success: false, error: err })
      return
    }
    /* prettier-ignore */ if (config.verbose) console.log('Request', _request.query);
    const query = _request.query
    // Check at least one of the query parameters is present
    if (
      !query.count &&
      !query.page &&
      !query.txId &&
      !query.accountId &&
      !query.startCycle &&
      !query.endCycle &&
      !query.tally
    ) {
      reply.send({
        success: false,
        reason: 'Not specified which original tx to query',
      })
      return
    }
    const itemsPerPage = 10
    let totalPages = 0
    let totalOriginalTxs = 0
    let page = 1
    let startCycle = 0
    let endCycle = 0
    let accountId = ''
    const res: OriginalTxResponse = {
      success: true,
      originalTxs: [],
    }
    if (query.count) {
      const count: number = parseInt(query.count)
      if (count <= 0 || Number.isNaN(count)) {
        reply.send({ success: false, error: 'Invalid count' })
        return
      }
      if (count > config.requestLimits.MAX_ORIGINAL_TXS_PER_REQUEST) {
        reply.send({
          success: false,
          error: `Maximum count is ${config.requestLimits.MAX_ORIGINAL_TXS_PER_REQUEST}`,
        })
        return
      }
      res.originalTxs = await OriginalTxDataDB.queryOriginalTxsData(0, count)
      res.totalOriginalTxs = await OriginalTxDataDB.queryOriginalTxDataCount()
      reply.send(res)
      return
    } else if (query.txId) {
      const txId: string = query.txId.toLowerCase()
      if (txId.length !== 64) {
        reply.send({ success: false, error: 'Invalid txId' })
        return
      }
      const originalTxs = await OriginalTxDataDB.queryOriginalTxDataByTxId(txId)
      if (originalTxs) res.originalTxs = [originalTxs]
      reply.send(res)
      return
    }
    if (query.accountId) {
      accountId = query.accountId.toLowerCase()
      if (accountId.length !== 64) {
        reply.send({ success: false, error: 'Invalid account id' })
        return
      }
    }
    if (query.startCycle) {
      startCycle = parseInt(query.startCycle)
      if (startCycle < 0 || Number.isNaN(startCycle)) {
        reply.send({ success: false, error: 'Invalid start cycle number' })
        return
      }
      endCycle = startCycle
      if (query.endCycle) {
        endCycle = parseInt(query.endCycle)
        if (endCycle < 0 || Number.isNaN(endCycle) || endCycle < startCycle) {
          reply.send({ success: false, error: 'Invalid end cycle number' })
          return
        }
        if (endCycle - startCycle > config.requestLimits.MAX_BETWEEN_CYCLES_PER_REQUEST) {
          reply.send({
            success: false,
            error: `The cycle range is too big. Max cycle range is ${config.requestLimits.MAX_BETWEEN_CYCLES_PER_REQUEST} cycles.`,
          })
          return
        }
      }
    }
    if (query.tally === 'true') {
      const totalOriginalTxs = await OriginalTxDataDB.queryOriginalTxDataCountByCycles(startCycle, endCycle)
      reply.send({ success: true, totalOriginalTxs })
      return
    }
    if (query.page) {
      page = parseInt(query.page)
      if (page < 1 || Number.isNaN(page)) {
        reply.send({ success: false, error: 'Invalid page number' })
        return
      }
    }
    if (accountId || startCycle > 0 || endCycle > 0 || page > 0) {
      totalOriginalTxs = await OriginalTxDataDB.queryOriginalTxDataCount(accountId, startCycle, endCycle)
      res.totalOriginalTxs = totalOriginalTxs
    }
    totalPages = Math.ceil(totalOriginalTxs / itemsPerPage)
    if (page > 1 && page > totalPages) {
      reply.send({
        success: false,
        error: 'Page no is greater than the totalPage',
      })
    }
    res.totalPages = totalPages
    if (totalOriginalTxs > 0) {
      res.originalTxs = await OriginalTxDataDB.queryOriginalTxsData(
        (page - 1) * itemsPerPage,
        itemsPerPage,
        accountId,
        startCycle,
        endCycle
      )
    }
    reply.send(res)
  })

  type ValidatorStatsRequest = FastifyRequest<{
    Querystring: {
      count: string
      startCycle: string
      endCycle: string
      responseType: string
    }
  }>

  server.get('/api/stats/validator', async (_request: ValidatorStatsRequest, reply) => {
    const err = utils.validateTypes(_request.query, {
      count: 's?',
      startCycle: 's?',
      endCycle: 's?',
      responseType: 's?',
    })
    if (err) {
      reply.send({ success: false, error: err })
      return
    }
    const query = _request.query
    // Check at least one of the query parameters is present
    if (!query.count && !query.startCycle && !query.endCycle && !query.responseType) {
      reply.send({
        success: false,
        reason: 'Not specified which validator stats to query',
      })
      return
    }
    let validatorStats: ValidatorStats[] = []
    if (query.count) {
      let count: number = parseInt(query.count)
      if (count <= 0 || Number.isNaN(count)) {
        reply.send({ success: false, error: 'Invalid count' })
        return
      }
      if (count > 100000) count = 100000 // set to show max 100000 cycles for TEMP

      // Cache enabled only for query string => ?count=1000&responseType=array
      if (query.responseType === 'array' && count === 1000) {
        const latestCycleNumber = await CycleDB.queryLatestCycleNumber()
        if (isCacheRecordValid(latestCycleNumber, validatorStatsCacheRecord)) {
          validatorStats = validatorStatsCacheRecord.data
        } else {
          validatorStats = await ValidatorStatsDB.queryLatestValidatorStats(count)
          validatorStatsCacheRecord.setData(latestCycleNumber, validatorStats)
        }
      } else {
        validatorStats = await ValidatorStatsDB.queryLatestValidatorStats(count)
      }
    } else if (query.startCycle) {
      const startCycle = parseInt(query.startCycle)
      if (startCycle < 0 || Number.isNaN(startCycle)) {
        reply.send({ success: false, error: 'Invalid start cycle number' })
        return
      }
      let endCycle = startCycle
      if (query.endCycle) {
        endCycle = parseInt(query.endCycle)
        if (endCycle < 0 || Number.isNaN(endCycle) || endCycle < startCycle) {
          reply.send({ success: false, error: 'Invalid end cycle number' })
          return
        }
        if (endCycle - startCycle > config.requestLimits.MAX_BETWEEN_CYCLES_PER_REQUEST) {
          reply.send({
            success: false,
            error: `The cycle range is too big. Max cycle range is ${config.requestLimits.MAX_BETWEEN_CYCLES_PER_REQUEST} cycles.`,
          })
          return
        }
      }
      validatorStats = await ValidatorStatsDB.queryValidatorStatsBetween(startCycle, endCycle)
    }
    if (query.responseType && query.responseType === 'array') {
      const temp_array = []
      validatorStats.forEach((item) =>
        temp_array.push([
          item.timestamp * 1000,
          item.active,
          item.activated,
          item.syncing,
          item.joined,
          item.removed,
          item.apoped,
          item.cycle,
        ])
      )
      validatorStats = temp_array
    }
    const res = {
      success: true,
      validatorStats,
    }
    reply.send(res)
  })

  type TransactionStatsRequest = FastifyRequest<{
    Querystring: {
      count: string
      startCycle: string
      endCycle: string
      responseType: string
      last14DaysTxsReport: string
      startTimestamp: string
      endTimestamp: string
    }
  }>

  server.get('/api/stats/transaction', async (_request: TransactionStatsRequest, reply) => {
    const err = utils.validateTypes(_request.query, {
      count: 's?',
      startCycle: 's?',
      endCycle: 's?',
      responseType: 's?',
      last14DaysTxsReport: 's?',
      startTimestamp: 's?',
      endTimestamp: 's?',
    })
    if (err) {
      reply.send({ success: false, error: err })
      return
    }
    const query = _request.query
    // Check at least one of the query parameters is present
    if (
      !query.count &&
      !query.startCycle &&
      !query.endCycle &&
      !query.responseType &&
      !query.last14DaysTxsReport &&
      !query.startTimestamp &&
      !query.endTimestamp
    ) {
      reply.send({
        success: false,
        reason: 'Not specified which transaction stats to query',
      })
      return
    }
    let transactionStats: TransactionStats[] | DailyTransactionStats[] = []
    if (query.count) {
      let count: number = parseInt(query.count)
      if (count <= 0 || Number.isNaN(count)) {
        reply.send({ success: false, error: 'Invalid count' })
        return
      }
      if (count > 100000) count = 100000 // set to show max 100000 cycles for TEMP

      // Cache enabled only for query string => ?count=1000&responseType=array
      if (query.responseType === 'array' && count === 1000) {
        const latestCycleNumber = await CycleDB.queryLatestCycleNumber()
        if (isCacheRecordValid(latestCycleNumber, transactionStatsCacheRecord)) {
          transactionStats = transactionStatsCacheRecord.data
        } else {
          transactionStats = await TransactionStatsDB.queryLatestTransactionStats(count)
          transactionStatsCacheRecord.setData(latestCycleNumber, transactionStats)
        }
      } else {
        transactionStats = await TransactionStatsDB.queryLatestTransactionStats(count)
      }
    } else if (query.startCycle) {
      const startCycle = parseInt(query.startCycle)
      if (startCycle < 0 || Number.isNaN(startCycle)) {
        reply.send({ success: false, error: 'Invalid start cycle number' })
        return
      }
      let endCycle = startCycle
      if (query.endCycle) {
        endCycle = parseInt(query.endCycle)
        if (endCycle < 0 || Number.isNaN(endCycle) || endCycle < startCycle) {
          reply.send({ success: false, error: 'Invalid end cycle number' })
          return
        }
        if (endCycle - startCycle > config.requestLimits.MAX_BETWEEN_CYCLES_PER_REQUEST) {
          reply.send({
            success: false,
            error: `The cycle range is too big. Max cycle range is ${config.requestLimits.MAX_BETWEEN_CYCLES_PER_REQUEST} cycles.`,
          })
          return
        }
      }
      transactionStats = await TransactionStatsDB.queryTransactionStatsBetween(startCycle, endCycle)
    } else if (query.last14DaysTxsReport) {
      if (query.last14DaysTxsReport !== 'true') {
        reply.send({
          success: false,
          error: 'Invalid last14DaysTxsReport',
        })
        return
      }
      transactionStats = await DailyTransactionStatsDB.queryLatestDailyTransactionStats(14)
    }
    console.log(query.responseType)
    if (query.responseType && query.responseType === 'array') {
      const temp_array = []

      if (query.last14DaysTxsReport) {
        ;(transactionStats as DailyTransactionStats[]).forEach((item: DailyTransactionStats) =>
          temp_array.push([
            item.dateStartTime,
            item.totalTxs,
            item.totalTransferTxs,
            item.totalMessageTxs,
            item.totalDepositStakeTxs,
            item.totalWithdrawStakeTxs,
          ])
        )
      } else {
        ;(transactionStats as TransactionStats[]).forEach((item) =>
          temp_array.push([
            item.timestamp * 1000,
            item.totalTxs,
            item.totalInternalTxs,
            item.totalStakeTxs,
            item.totalUnstakeTxs,
            item.cycle,
          ])
        )
      }
      console.log('temp_array', temp_array)
      transactionStats = temp_array
    }
    const res = {
      success: true,
      transactionStats,
    }
    reply.send(res)
  })

  server.get('/api/stats/coin', async (_request, reply) => {
    let coinStats
    const latestCycleNumber = await CycleDB.queryLatestCycleNumber()
    if (isCacheRecordValid(latestCycleNumber, coinStatsCacheRecord)) {
      coinStats = coinStatsCacheRecord.data
    } else {
      coinStats = await CoinStatsDB.queryAggregatedCoinStats()
      coinStatsCacheRecord.setData(latestCycleNumber, coinStats)
    }

    let res: CoinResponse | ErrorResponse
    if (coinStats) {
      res = {
        success: true,
        lastUpdatedCycle: coinStatsCacheRecord.lastUpdatedCycle,
        totalSupply: coinStats.totalSupplyChange + config.genesisLIBSupply,
        totalStaked: coinStats.totalStakeChange,
      }
    } else {
      res = {
        success: false,
        error: 'No coin stats found',
      }
    }
    reply.send(res)
  })

  server.get<{ Params: { nodePubKey: string } }>('/api/nodeStats/:nodePubKey', async (_request, reply) => {
    try {
      const res: NodeStatsDB.NodeStats = await NodeStatsDB.getNodeStatsByAddress(_request.params.nodePubKey)
      if (res) {
        reply.send(res)
      }
      reply.status(404).send({
        success: false,
        error: 'Node stats not found for provided node address',
      })
    } catch (e) {
      reply.status(500).send({
        success: false,
        error: e.message,
      })
    }
  })

  server.get('/totalData', async (_request, reply) => {
    interface TotalDataResponse {
      totalCycles: number
      totalAccounts?: number
      totalTransactions?: number
      totalReceipts: number
      totalOriginalTxs: number
    }

    const res: TotalDataResponse = {
      totalCycles: 0,
      totalReceipts: 0,
      totalOriginalTxs: 0,
    } // Initialize 'res' with an empty object

    res.totalCycles = await CycleDB.queryCycleCount()
    if (config.processData.indexReceipt) {
      res.totalAccounts = await AccountDB.queryAccountCount()
      res.totalTransactions = await TransactionDB.queryTransactionCount()
    }
    res.totalReceipts = await ReceiptDB.queryReceiptCount()
    res.totalOriginalTxs = await OriginalTxDataDB.queryOriginalTxDataCount()
    reply.send(res)
  })

  server.listen(
    {
      port: Number(config.port.server),
      host: '0.0.0.0',
    },
    async (err) => {
      if (err) {
        server.log.error(err)
        console.log(err)
        throw err
      }
      console.log('Explorer Server is listening on port:', config.port.server)
    }
  )
}

start()
