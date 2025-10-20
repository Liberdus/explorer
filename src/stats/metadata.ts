import * as db from '../storage/sqlite3storage'
import { metadataDatabase } from '.'

export enum MetadataType {
  NodeStats = 'NodeStats',
}

export interface Metadata {
  type: string
  cycleNumber: number
}

const METADATA_COLUMNS: readonly (keyof Metadata)[] = [
  'type',
  'cycleNumber',
] as const

export function isMetadata(obj: Metadata): obj is Metadata {
  return obj.type && obj.cycleNumber ? true : false
}

export async function insertOrUpdateMetadata(metadata: Metadata): Promise<void> {
  try {
    const fields = `(${METADATA_COLUMNS.join(', ')})`
    // Create placeholders for one row
    const placeholders = `(${METADATA_COLUMNS.map(() => '?').join(', ')})`
    // Map the `metadata` object to match the columns
    const values = METADATA_COLUMNS.map((column) => metadata[column])

    const sql = `INSERT OR REPLACE INTO metadata ${fields} VALUES ${placeholders}`
    await db.run(metadataDatabase, sql, values)
  } catch (e) {
    console.error(e)
    console.error(
      `Unable to insert or update metadata into the database for ${metadata.type}, cycleNumber:  ${metadata.cycleNumber}`
    )
  }
}

export async function getMetadata(type: MetadataType): Promise<Metadata | null> {
  try {
    const sql = 'SELECT * FROM metadata WHERE type=? LIMIT 1'
    const metadata: Metadata = await db.get(metadataDatabase, sql, [type])
    if (metadata) {
      return metadata
    }
  } catch (e) {
    console.error(e)
  }
  return null
}

export async function getLastStoredCycleNumber(type: MetadataType): Promise<number> {
  try {
    const metadata = await getMetadata(type)
    if (metadata) {
      return metadata.cycleNumber
    }
  } catch (e) {
    console.error(e)
  }
  return -1
}
