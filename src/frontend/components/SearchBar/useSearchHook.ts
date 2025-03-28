import { useRouter } from 'next/router'
import { useCallback, useState } from 'react'
import { isTransactionHash, isAccount, isAliasAccount } from '../../utils/getSearchRoute'
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

    const regex = /[a-z]/i

    try {
      if (isEthereumAddress(searchText)) {
        router.push(`/account/${searchText}`)
      }
      if (isShardusAddress(searchText)) {
        if (await isTransactionHash(searchText)) router.push(`/transaction/${searchText}`)
        else if (await isAccount(searchText)) router.push(`/account/${searchText}`)
        else router.push(`/cycle/${searchText}`)
      }
      // Regex to check if the search text is a cycle number
      if (!regex.test(searchText)) {
        router.push(`/cycle/${searchText}`)
      }
      if (searchText.length >= 3) {
        const usernameHash = hash(searchText) as string
        const { success, accountId } = await isAliasAccount(usernameHash)
        if (success) router.push(`/account/${accountId}`)
        // Set error for no account found
        else setSearchError(`No account found for username: ${searchText}`)
      }
      // Set error for no data found
      else setSearchError('No data found for search: ' + searchText)
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
