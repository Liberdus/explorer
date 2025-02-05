import { useRouter } from 'next/router'
import { useCallback, useState } from 'react'
import { isTransactionHash, isAccount } from '../../utils/getSearchRoute'
import { isEthereumAddress, isShardusAddress } from '../../utils/transformAddress'

type SearchHookResult = {
  search: string
  setSearch: (search: string) => void
  onSearch: () => void
}

export const useSearchHook = (): SearchHookResult => {
  const router = useRouter()

  const [search, setSearch] = useState<string>('')

  const onSearch = useCallback(async () => {
    const searchText = search.trim().toLowerCase()

    const regex = /[a-z]/i

    if (isEthereumAddress(searchText)) {
      console.log('42')
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
      console.log('regex')
    }
  }, [router, search])

  return {
    search,
    setSearch,
    onSearch,
  }
}
