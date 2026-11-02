import { P2P, StateManager } from '@shardus/lib-types'

export interface Cycle {
  cycleMarker: StateManager.StateMetaDataTypes.CycleMarker
  counter: P2P.CycleCreatorTypes.CycleData['counter']
  start: number
  cycleRecord: P2P.CycleCreatorTypes.CycleData
}
