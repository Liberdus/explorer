import { AccountType } from '../../types'
import { api } from '../api/axios'
import { PATHS } from '../api/paths'

export const isTransactionHash = async (searchText: string): Promise<boolean> => {
  const {
    data: { success, transactions },
  } = await api.get(`${PATHS.TRANSACTION}?txId=${searchText}`)
  return success && transactions
}

export const isAccount = async (searchText: string): Promise<boolean> => {
  const {
    data: { success, accounts },
  } = await api.get(`${PATHS.ACCOUNT}?accountId=${searchText}`)
  return success && accounts?.[0]?.accountId === searchText
}

export const isCycleMarker = async (searchText: string): Promise<boolean> => {
  const {
    data: { success, cycles },
  } = await api.get(`${PATHS.CYCLE}?cycleMarker=${searchText}`)
  return success && cycles?.[0]?.cycleMarker === searchText
}

export const isCycleCounter = async (searchText: string): Promise<boolean> => {
  const {
    data: { success, cycles },
  } = await api.get(`${PATHS.CYCLE}?cycleNumber=${searchText}`)
  return success && cycles?.[0]?.counter === Number(searchText)
}

export const isAliasAccount = async (
  searchText: string
): Promise<{ success: boolean; accountId?: string }> => {
  const {
    data: { success, accounts },
  } = await api.get(`${PATHS.ACCOUNT}?accountId=${searchText}`)
  console.log(success, accounts)
  if (success && accounts?.[0]?.accountType === AccountType.AliasAccount)
    return { success, accountId: accounts?.[0]?.data?.address }
  else return { success: false }
}
