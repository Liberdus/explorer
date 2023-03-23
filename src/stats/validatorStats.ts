/* eslint-disable no-empty */
import * as db from './sqlite3storage'
import { extractValues, extractValuesFromArray } from './sqlite3storage'
import { config } from '../config/index'
import { P2P, StateManager } from '@shardus/types'


export interface ValidatorStats {
    cycle: number
    active: number
    timestamp: number
}

export function isValidatorStats(obj: ValidatorStats): obj is ValidatorStats {
    return (obj.cycle && obj.active && obj.timestamp) ? true : false
}

export async function insertValidatorStats(validator: ValidatorStats) {
    try {
        const fields = Object.keys(validator).join(', ')
        const placeholders = Object.keys(validator).fill('?').join(', ')
        const values = extractValues(validator)
        let sql = 'INSERT OR REPLACE INTO validators (' + fields + ') VALUES (' + placeholders + ')'
        await db.run(sql, values)
        // if (config.verbose)
        console.log('Successfully inserted ValidatorStats', validator.cycle)
    } catch (e) {
        // }
        console.log(e)
        console.log(
            'Unable to insert validatorStats or it is already stored in to database',
            validator.cycle,
        )
    }
}

export async function bulkInsertValidatorsStats(validators: ValidatorStats[]) {
    try {
        const fields = Object.keys(validators[0]).join(', ')
        const placeholders = Object.keys(validators[0]).fill('?').join(', ')
        const values = extractValuesFromArray(validators)
        let sql = 'INSERT OR REPLACE INTO validators (' + fields + ') VALUES (' + placeholders + ')'
        for (let i = 1; i < validators.length; i++) {
            sql = sql + ', (' + placeholders + ')'
        }
        await db.run(sql, values)
        console.log('Successfully inserted ValidatorStats', validators.length)
    } catch (e) {
        console.log(e)
        console.log('Unable to bulk insert ValidatorStats', validators.length)
    }
}

export async function queryLatestValidatorStats(count) {
    try {
        const sql = `SELECT * FROM validators ORDER BY cycle DESC LIMIT ${count ? count : 100}`
        const validatorsStats: any = await db.all(sql)
        if (config.verbose) console.log('validatorStats count', validatorsStats)
        if (validatorsStats.length > 0) {
            validatorsStats.sort((a, b) => (a.timestamp > b.timestamp ? 1 : -1))
        }
        return validatorsStats
    } catch (e) {
        console.log(e)
    }
}

export async function queryValidatorStatsBetween(startCycle: number, endCycle: number) {
    try {
        const sql = `SELECT * FROM validators WHERE cycle BETWEEN ? AND ? ORDER BY cycle DESC LIMIT 100`
        const validatorsStats: any = await db.all(sql, [startCycle, endCycle])
        if (config.verbose) console.log('validator between', validatorsStats)
        if (validatorsStats.length > 0) {
            validatorsStats.sort((a, b) => (a.timestamp > b.timestamp ? 1 : -1))
        }
        return validatorsStats
    } catch (e) {
        console.log(e)
    }
}
