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
