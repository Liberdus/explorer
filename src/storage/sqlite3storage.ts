import { Utils as StringUtils } from '@shardus/types'
import { Database } from 'sqlite3'

const enableWritingQueue = false

// Simple write queue using Promise chain - serializes all database writes
// This prevents write contention while allowing parallel reads (SELECTs)
// Only INSERT/UPDATE/DELETE operations should use this queue
let writeQueueTail: Promise<unknown> = Promise.resolve()

// Control whether to use manual WAL checkpoints
export const useManualCheckPoint = false

interface QueryTiming {
  id: number
  sql: string
  startMs: number
  engineMs?: number
}

const SQL_LOG_MAX_LENGTH = 200
const SQL_ENGINE_WARN_THRESHOLD_MS = 500
const SQL_QUEUE_WARN_THRESHOLD_MS = 250
const SQL_TOTAL_WARN_THRESHOLD_MS = 1000

let queryIdSequence = 0
const pendingQueries = new Map<number, QueryTiming>()
const queuedBySql = new Map<string, number[]>()

export const createDB = async (dbPath: string, dbName: string): Promise<Database> => {
  console.log('dbName', dbName, 'dbPath', dbPath)
  const db = new Database(dbPath, (err) => {
    if (err) {
      console.log('Error opening database:', err)
      throw err
    }
  })
  await run(db, 'PRAGMA journal_mode=WAL')
  await run(db, 'PRAGMA synchronous = NORMAL')
  await run(db, 'PRAGMA temp_store = MEMORY')
  await run(db, 'PRAGMA cache_size = -256000') // Increased to ~256MB cache for better performance
  let checkPointPageCount = 10000
  if (useManualCheckPoint) {
    checkPointPageCount = 0 // Disable automatic checkpoints
  }
  await run(db, `PRAGMA wal_autocheckpoint = ${checkPointPageCount}`) // Checkpoint every 10000 pages (less frequent = less lock contention)
  await run(db, 'PRAGMA mmap_size = 536870912') // 512MB memory-mapped I/O for faster reads (reduced disk I/O)
  await run(db, 'PRAGMA busy_timeout = 30000') // Wait up to 30s if database is locked
  await run(db, 'PRAGMA threads = 4') // Use up to 4 threads for parallel operations
  db.on('profile', (sql, time) => {
    const engineMs = typeof time === 'number' ? time : Number(time)
    const queue = queuedBySql.get(sql)
    const id = queue && queue.length > 0 ? queue[0] : undefined
    if (id === undefined) {
      printQueryTimingLog('profile event without pending query', {
        engineMs,
        sql: formatSqlForLog(sql),
      })
      return
    }
    const entry = pendingQueries.get(id)
    if (!entry) {
      printQueryTimingLog('profile missing pending entry', {
        engineMs,
        sql: formatSqlForLog(sql),
      })
      return
    }
    entry.engineMs = engineMs
    if (engineMs > SQL_ENGINE_WARN_THRESHOLD_MS) {
      console.warn(`[DB Engine] Slow Query: ${engineMs} ms for SQL: ${formatSqlForLog(sql)}`)
    }
  })
  console.log(`Database ${dbName} Initialized!`)
  return db
}

/**
 * Create read-only database connection optimized for SELECT queries
 * - Shorter busy_timeout (reads shouldn't block in WAL mode)
 * - No synchronous writes (read-only)
 * - Large cache and mmap for fast reads
 */
export const createReadDB = async (dbPath: string, dbName: string): Promise<Database> => {
  console.log('dbName (Read)', dbName, 'dbPath', dbPath)
  const db = new Database(dbPath, (err) => {
    if (err) {
      console.log('Error opening read database:', err)
      throw err
    }
  })
  await run(db, 'PRAGMA journal_mode=WAL') // WAL mode allows concurrent reads with writes
  await run(db, 'PRAGMA synchronous = OFF') // Read-only connection doesn't need sync
  await run(db, 'PRAGMA temp_store = MEMORY')
  await run(db, 'PRAGMA cache_size = -128000') // 128MB cache (smaller than write connection)
  await run(db, 'PRAGMA mmap_size = 536870912') // 512MB memory-mapped I/O for faster reads
  await run(db, 'PRAGMA busy_timeout = 5000') // Shorter timeout - reads shouldn't block in WAL mode
  await run(db, 'PRAGMA threads = 4') // Use up to 4 threads for parallel operations
  await run(db, 'PRAGMA query_only = ON') // Enforce read-only mode at SQLite level
  db.on('profile', (sql, time) => {
    const engineMs = typeof time === 'number' ? time : Number(time)
    const queue = queuedBySql.get(sql)
    const id = queue && queue.length > 0 ? queue[0] : undefined
    if (id === undefined) {
      printQueryTimingLog('profile event without pending query (read)', {
        engineMs,
        sql: formatSqlForLog(sql),
      })
      return
    }
    const entry = pendingQueries.get(id)
    if (!entry) {
      printQueryTimingLog('profile missing pending entry (read)', {
        engineMs,
        sql: formatSqlForLog(sql),
      })
      return
    }
    entry.engineMs = engineMs
    if (engineMs > SQL_ENGINE_WARN_THRESHOLD_MS) {
      console.warn(`[DB Engine Read] Slow Query: ${engineMs} ms for SQL: ${formatSqlForLog(sql)}`)
    }
  })
  console.log(`Read Database ${dbName} Initialized!`)
  return db
}

/**
 * Manually checkpoint the WAL file to prevent it from growing too large
 * Uses PASSIVE mode which won't block readers
 * Call this periodically during long-running sync operations
 */
export async function checkpointWAL(
  db: Database,
  mode: 'PASSIVE' | 'FULL' | 'RESTART' = 'PASSIVE'
): Promise<void> {
  try {
    await run(db, `PRAGMA wal_checkpoint(${mode})`)
    console.log(`[WAL Checkpoint] Executed ${mode} checkpoint`)
  } catch (error) {
    console.error('[WAL Checkpoint] Failed to checkpoint WAL:', error)
  }
}

/**
 * Close Database Connections Gracefully
 */
export async function close(db: Database, dbName: string): Promise<void> {
  try {
    console.log(`Terminating ${dbName} Database/Indexer Connections...`)
    await new Promise<void>((resolve, reject) => {
      db.close((err) => {
        if (err) {
          console.error(`Error closing ${dbName} 0Database Connection.`)
          reject(err)
        } else {
          console.log(`${dbName} Database connection closed.`)
          resolve()
        }
      })
    })
  } catch (err) {
    console.error(`Error thrown in ${dbName} db close() function: `)
    console.error(err)
  }
}

export async function runCreate(db: Database, createStatement: string): Promise<void> {
  await run(db, createStatement)
}

export async function run(
  db: Database,
  sql: string,
  params: unknown[] | object = []
): Promise<{ id: number }> {
  const entry = registerQuery(sql)
  return new Promise((resolve, reject) => {
    const finalize = (): void => {
      setImmediate(() => {
        logTiming('run', entry)
        cleanupQuery(entry)
      })
    }
    db.run(sql, params, function (err: Error) {
      if (err) {
        console.log('Error running sql ' + sql)
        console.log(err)
        finalize()
        reject(err)
      } else {
        finalize()
        resolve({ id: this.lastID })
      }
    })
  })
}

export async function get<T>(db: Database, sql: string, params = []): Promise<T> {
  const entry = registerQuery(sql)
  return new Promise((resolve, reject) => {
    const finalize = (rows?: number): void => {
      setImmediate(() => {
        logTiming('get', entry, rows)
        cleanupQuery(entry)
      })
    }
    db.get(sql, params, (err: Error, result: T) => {
      if (err) {
        console.log('Error running sql: ' + sql)
        console.log(err)
        finalize()
        reject(err)
      } else {
        finalize(result ? 1 : 0)
        resolve(result)
      }
    })
  })
}

export async function all<T>(db: Database, sql: string, params = []): Promise<T[]> {
  const entry = registerQuery(sql)
  return new Promise((resolve, reject) => {
    const finalize = (rowsCount?: number): void => {
      setImmediate(() => {
        logTiming('all', entry, rowsCount)
        cleanupQuery(entry)
      })
    }
    db.all(sql, params, (err: Error, rows: T[]) => {
      if (err) {
        console.log('Error running sql: ' + sql)
        console.log(err)
        finalize()
        reject(err)
      } else {
        finalize(rows ? rows.length : 0)
        resolve(rows)
      }
    })
  })
}

/**
 * Executes a database write operation through the shared write queue
 * Use this for INSERT/UPDATE/DELETE operations to prevent write contention
 * Do NOT use for SELECT queries - they can run in parallel
 */
export async function executeDbWrite<T>(writeOperation: () => Promise<T>): Promise<T> {
  const enqueuedAt = Date.now()

  // Wait for previous write to finish, ignoring errors to prevent propagation
  const myTurn = writeQueueTail.catch(() => undefined)

  // Create and chain the new write operation
  const currentWrite = myTurn.then(async () => {
    const startedAt = Date.now()
    const promiseQueueMs = startedAt - enqueuedAt

    // Log if we waited a long time in the Promise queue
    if (promiseQueueMs > 100) {
      console.log(`[Promise Queue] Waited ${promiseQueueMs}ms in Promise queue before starting DB operation`)
    }

    const value = await writeOperation()
    const completedAt = Date.now()
    const executionMs = completedAt - startedAt

    // Log slow DB operations (includes transaction + SQLite busy_timeout)
    if (executionMs > 500) {
      console.log(
        `[DB Operation] Total: ${executionMs}ms (Promise queue: ${promiseQueueMs}ms, DB execution+waiting: ${executionMs}ms)`
      )
    }

    return value
  })

  // Update queue tail to current write (for next operation to wait on)
  writeQueueTail = currentWrite.catch(() => undefined)

  // Return the actual operation result
  return currentWrite
}

/**
 * Execute work within a database transaction
 * Uses BEGIN (deferred) since our write queue already serializes writes
 * This reduces lock contention compared to BEGIN IMMEDIATE
 * @param db Database instance
 * @param work Async function containing the work to execute within the transaction
 * @returns Result of the work function
 */
export async function executeInTransaction<T>(db: Database, work: () => Promise<T>): Promise<T> {
  await run(db, 'BEGIN') // Deferred transaction - acquires RESERVED lock on first write, not at BEGIN
  try {
    const result = await work()
    await run(db, 'COMMIT')
    return result
  } catch (error) {
    await run(db, 'ROLLBACK')
    throw error
  }
}

export async function executeDbWriteWithTransaction(
  db: Database,
  sql: string,
  params: unknown[] | object = []
): Promise<void> {
  // Use write queue if enabled
  if (enableWritingQueue) {
    // Serialize write throuh promise queue
    await executeDbWrite(() =>
      executeInTransaction(db, async () => {
        await run(db, sql, params)
      })
    )
    return
  }

  // Use transaction directly
  await executeInTransaction(db, async () => {
    await run(db, sql, params)
  })
}

export function extractValues(object: object): string[] {
  try {
    const inputs: string[] = []
    for (let value of Object.values(object)) {
      if (typeof value === 'object') value = StringUtils.safeStringify(value)
      inputs.push(value)
    }
    return inputs
  } catch (e) {
    console.log(e)
  }

  return []
}

export function extractValuesFromArray(arr: object[]): string[] {
  try {
    const inputs: string[] = []
    for (const object of arr) {
      for (let value of Object.values(object)) {
        if (typeof value === 'object') value = StringUtils.safeStringify(value)
        inputs.push(value)
      }
    }
    return inputs
  } catch (e) {
    console.log(e)
    return []
  }
}

export function updateSqlStatementClause(sql: string, inputs: any[]): string {
  if (inputs.length > 0) sql += ' AND '
  else sql += ' WHERE '
  return sql
}

function registerQuery(sql: string): QueryTiming {
  const entry: QueryTiming = {
    id: ++queryIdSequence,
    sql,
    startMs: Date.now(),
  }
  pendingQueries.set(entry.id, entry)
  let queue = queuedBySql.get(sql)
  if (!queue) {
    queue = []
    queuedBySql.set(sql, queue)
  }
  queue.push(entry.id)
  return entry
}

function cleanupQuery(entry: QueryTiming): void {
  pendingQueries.delete(entry.id)
  const queue = queuedBySql.get(entry.sql)
  if (!queue) return
  const index = queue.indexOf(entry.id)
  if (index !== -1) queue.splice(index, 1)
  if (queue.length === 0) queuedBySql.delete(entry.sql)
}

function printQueryTimingLog(message: string, payload: object): void {
  console.warn(`[DB Timing] ${message}`, JSON.stringify(payload))
}

function logTiming(operation: string, entry: QueryTiming, rows?: number): void {
  const totalMs = Date.now() - entry.startMs
  const engineMs = entry.engineMs ?? 0
  const queueMs = Math.max(0, totalMs - engineMs)
  const payload = {
    operation,
    totalMs: Number(totalMs.toFixed(2)),
    queueMs: Number(queueMs.toFixed(2)),
    engineMs: Number(engineMs.toFixed(2)),
    sql: formatSqlForLog(entry.sql),
    rows,
  }

  if (totalMs > SQL_TOTAL_WARN_THRESHOLD_MS || queueMs > SQL_QUEUE_WARN_THRESHOLD_MS) {
    printQueryTimingLog('', payload)
  }
}

function formatSqlForLog(sql: string): string {
  const normalized = sql.replace(/\s+/g, ' ').trim()
  if (normalized.length <= SQL_LOG_MAX_LENGTH) return normalized
  return `${normalized.slice(0, SQL_LOG_MAX_LENGTH - 3)}...`
}
