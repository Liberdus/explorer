import { Utils as StringUtils } from '@shardus/types'
import { Database } from 'sqlite3'

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
  await run(db, 'PRAGMA wal_autocheckpoint = 5000') // Checkpoint every 5000 pages (less frequent = less lock contention)
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
