import { config } from '../config/index'
import * as db from '../storage/sqlite3storage'
import { validatorStatsDatabase } from '.'

export interface ValidatorStats {
  cycle: number
  active: number
  activated: number
  syncing: number
  joined: number
  removed: number
  apoped: number
  timestamp: number
}

const VALIDATOR_STATS_COLUMNS: readonly (keyof ValidatorStats)[] = [
  'cycle',
  'active',
  'activated',
  'syncing',
  'joined',
  'removed',
  'apoped',
  'timestamp',
] as const

export function isValidatorStats(obj: ValidatorStats): obj is ValidatorStats {
  return obj.cycle &&
    obj.active &&
    obj.activated &&
    obj.timestamp &&
    obj.syncing &&
    obj.joined &&
    obj.removed &&
    obj.apoped
    ? true
    : false
}

export async function insertValidatorStats(validator: ValidatorStats): Promise<void> {
  try {
    const fields = `(${VALIDATOR_STATS_COLUMNS.join(', ')})`
    // Create placeholders for one row
    const placeholders = `(${VALIDATOR_STATS_COLUMNS.map(() => '?').join(', ')})`
    // Map the `validator` object to match the columns
    const values = VALIDATOR_STATS_COLUMNS.map((column) => validator[column])

    const sql = `INSERT OR REPLACE INTO validators ${fields} VALUES ${placeholders}`
    await db.run(validatorStatsDatabase, sql, values)
    console.log('Successfully inserted ValidatorStats', validator.cycle)
  } catch (e) {
    console.log(e)
    console.log('Unable to insert validatorStats or it is already stored in to database', validator.cycle)
  }
}

export async function bulkInsertValidatorsStats(validators: ValidatorStats[]): Promise<void> {
  try {
    const fields = `(${VALIDATOR_STATS_COLUMNS.join(', ')})`
    // Create placeholders for one row
    const placeholders = `(${VALIDATOR_STATS_COLUMNS.map(() => '?').join(', ')})`
    // Create multiple placeholder groups for bulk insert
    const allPlaceholders = Array(validators.length).fill(placeholders).join(', ')

    // Flatten the `validators` array into a single list of values
    const values = validators.flatMap((validator) =>
      VALIDATOR_STATS_COLUMNS.map((column) => validator[column])
    )

    const sql = `INSERT OR REPLACE INTO validators ${fields} VALUES ${allPlaceholders}`
    await db.run(validatorStatsDatabase, sql, values)
    const addedCycles = validators.map((v) => v.cycle)
    console.log('Successfully bulk inserted ValidatorStats', validators.length, 'for cycles', addedCycles)
  } catch (e) {
    console.log(e)
    console.log('Unable to bulk insert ValidatorStats', validators.length)
  }
}

export async function queryLatestValidatorStats(count: number): Promise<ValidatorStats[]> {
  try {
    const sql = `SELECT * FROM validators ORDER BY cycle DESC LIMIT ${count ? count : 100}`
    const validatorsStats: ValidatorStats[] = await db.all(validatorStatsDatabase, sql)
    if (config.verbose) console.log('validatorStats count', validatorsStats)
    return validatorsStats
  } catch (e) {
    console.log(e)
  }
}

export async function queryValidatorStatsBetween(
  startCycle: number,
  endCycle: number
): Promise<ValidatorStats[]> {
  try {
    const sql = `SELECT * FROM validators WHERE cycle BETWEEN ? AND ? ORDER BY cycle ASC`
    const validatorsStats: ValidatorStats[] = await db.all(validatorStatsDatabase, sql, [
      startCycle,
      endCycle,
    ])
    if (config.verbose) console.log('validator between', validatorsStats)
    return validatorsStats
  } catch (e) {
    console.log(e)
  }
}
