import useSWR from 'swr'

import { fetcher } from './fetcher'

import { config } from '../../config'

export type TokenPriceResult = {
  tokenPrice: number
  marketCap: number
  loading: boolean
}

export const useDexTokenPrice = (): TokenPriceResult => {
  const { data } = useSWR<{ pairs: { priceUsd: number; marketCap: number }[] }>(
    config.dexScreenerAPI,
    fetcher
  )

  return {
    tokenPrice: data?.pairs[0]?.priceUsd || 0,
    marketCap: data?.pairs[0]?.marketCap || 0,
    loading: !data,
  }
}
