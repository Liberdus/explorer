import * as db from '../storage/sqlite3storage'
import { nodeStatsDatabase } from '.'

export interface NodeStats {
  nodeAddress: string
  nominator: string
  nodeId: string
  currentState: string
  totalStandbyTime: number
  totalActiveTime: number
  totalSyncTime: number
  timestamp: number
}

const NODE_STATS_COLUMNS: readonly (keyof NodeStats)[] = [
  'nodeAddress',
  'nominator',
  'nodeId',
  'currentState',
  'totalStandbyTime',
  'totalActiveTime',
  'totalSyncTime',
  'timestamp',
] as const

export function isNodeStats(obj: NodeStats): obj is NodeStats {
  return obj.nodeAddress &&
    obj.nominator &&
    obj.nodeId &&
    obj.currentState &&
    obj.totalStandbyTime &&
    obj.totalActiveTime &&
    obj.timestamp
    ? true
    : false
}

export async function getNodeStatsByAddress(nodeAddress: string): Promise<NodeStats | null> {
  try {
    const sql = 'SELECT * FROM node_stats WHERE nodeAddress=? LIMIT 1'
    const nodeStats: NodeStats = await db.get(nodeStatsDatabase, sql, [nodeAddress])
    if (nodeStats) {
      return nodeStats
    }
  } catch (e) {
    console.error(e)
  }
  return null
}

export async function getNodeStatsById(nodeId: string): Promise<NodeStats | null> {
  try {
    const sql = 'SELECT * FROM node_stats WHERE nodeId=? LIMIT 1'
    const nodeStats: NodeStats = await db.get(nodeStatsDatabase, sql, [nodeId])
    if (nodeStats) {
      return nodeStats
    }
  } catch (e) {
    console.error(e)
  }
  return null
}

export async function insertOrUpdateNodeStats(nodeStats: NodeStats): Promise<void> {
  try {
    const fields = `(${NODE_STATS_COLUMNS.join(', ')})`
    // Create placeholders for one row
    const placeholders = `(${NODE_STATS_COLUMNS.map(() => '?').join(', ')})`
    // Map the `nodeStats` object to match the columns
    const values = NODE_STATS_COLUMNS.map((column) => nodeStats[column])

    const sql = `INSERT OR REPLACE INTO node_stats ${fields} VALUES ${placeholders}`
    await db.run(nodeStatsDatabase, sql, values)
  } catch (e) {
    console.error(e)
    console.error('Unable to insert nodeStats in to database', nodeStats)
  }
}

export async function queryLatestNodeStats(
  limit = 100,
  select: keyof NodeStats | (keyof NodeStats)[] | 'all' = 'all'
): Promise<NodeStats[]> {
  try {
    // Build SELECT clause
    let selectClause = '*'
    if (select !== 'all') {
      const fields = Array.isArray(select) ? select : [select]
      selectClause = fields.join(', ')
    }
    const sql = `SELECT ${selectClause} FROM node_stats ORDER BY timestamp DESC LIMIT ?`
    const nodeStats: NodeStats[] = await db.all(nodeStatsDatabase, sql, [limit])
    return nodeStats
  } catch (e) {
    console.error(e)
    console.error(`queryLatestNodeStats: failed to fetch latest node statistics`)
  }
  return []
}

export async function updateAllNodeStates(currCycleTimestamp: number): Promise<void> {
  try {
    const sql = `UPDATE node_stats
        SET currentState = 'removed',
            totalStandbyTime = CASE 
                                WHEN currentState IN ('standbyAdd', 'standbyRefresh') THEN totalStandbyTime + ${currCycleTimestamp} - timestamp
                                ELSE totalStandbyTime
                               END,
            totalSyncTime = CASE 
                               WHEN currentState = 'joinedConsensors' THEN totalSyncTime + ${currCycleTimestamp} - timestamp
                               ELSE totalSyncTime
                            END,
            totalActiveTime = CASE 
                               WHEN currentState = 'activated' THEN totalActiveTime + ${currCycleTimestamp} - timestamp
                               ELSE totalActiveTime
                            END,
            timestamp = ${currCycleTimestamp}
        WHERE currentState IN ('activated', 'standbyAdd', 'startedSyncing', 'standbyRefresh');`
    await db.all(nodeStatsDatabase, sql)
  } catch (e) {
    console.error(e)
    console.error(`queryLatestNodeStats: failed to fetch latest node statistics`)
  }
}
