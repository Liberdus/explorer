import { useRouter } from 'next/router'
import { useCallback, useState } from 'react'
import {
  isTransactionHash,
  isAccount,
  isAliasAccount,
  isCycleMarker,
  isCycleCounter,
} from '../../utils/getSearchRoute'
import { isEthereumAddress, isShardusAddress } from '../../utils/transformAddress'
import { hash } from '@shardus/crypto-web'

type SearchHookResult = {
  search: string
  setSearch: (search: string) => void
  onSearch: () => void
  searchError: string | null
}

export const useSearchHook = (): SearchHookResult => {
  const router = useRouter()

  const [search, setSearch] = useState<string>('')
  const [searchError, setSearchError] = useState<string | null>(null)

  const onSearch = useCallback(async () => {
    // Clear previous errors
    setSearchError(null)
    const searchText = search.trim().toLowerCase()

    try {
      if (isEthereumAddress(searchText)) {
        router.push(`/account/${searchText}`)
        return
      }
      if (isShardusAddress(searchText)) {
        if (await isTransactionHash(searchText)) {
          router.push(`/transaction/${searchText}`)
          return
        } else if (await isAccount(searchText)) {
          router.push(`/account/${searchText}`)
          return
        } else if (await isCycleMarker(searchText)) {
          router.push(`/cycle/${searchText}`)
          return
        }
      }
      // Regex to check if the search text is a cycle number
      const regex = /[a-z]/i
      if (!regex.test(searchText)) {
        if (await isCycleCounter(searchText)) {
          router.push(`/cycle/${searchText}`)
          return
        }
      }
      if (searchText.length >= 3) {
        const usernameHash = hash(searchText) as string
        const { success, accountId } = await isAliasAccount(usernameHash)
        if (success) {
          router.push(`/account/${accountId}`)
          return
        }
      }
      setSearchError('No data found for search: ' + searchText)
    } catch (error) {
      // Set error for unexpected issues
      setSearchError('An error occurred during search')
      console.error(error)
    }
  }, [router, search])

  return {
    search,
    setSearch,
    onSearch,
    searchError,
  }
}
