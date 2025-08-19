import useSWR from 'swr'
import { PATHS } from './paths'
import { fetcher } from './fetcher'
import { Account } from '../../types'

interface AccountDetailResult {
  account: Account | null
  error?: Error
}

interface AccountData {
  accounts: Account[]
}

const useAccountDetail = (accountId: string): AccountDetailResult => {
  const url = `${PATHS.ACCOUNT}?accountId=${accountId}`
  const { data, error } = useSWR<AccountData>(url, fetcher, { revalidateOnFocus: false })

  return {
    account: data?.accounts?.[0] || null,
    error,
  }
}

export default useAccountDetail
