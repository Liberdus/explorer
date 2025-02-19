
import web3 from 'web3'
export const calculateValue = (value: string | bigint): string => {
  console.log('calculateValue', value)
  try {
    return round(web3.utils.fromWei(value, 'ether'))
  } catch (e) {
    return 'error in calculating Value'
  }
}

export const calculateFullValue = (value: string | bigint): string => {
  try {
    return web3.utils.fromWei(value, 'ether')
  } catch (e) {
    return 'error in calculating Value'
  }
}

export const short = (str: string): string => (str ? str.slice(0, 20) + '...' : '')

export const shortTokenValue = (str: string): string => {
  if (!str) return ''
  if (str.length < 10) return str
  else return str.slice(0, 10) + '...'
}

const countDecimals = (value: string | bigint): number => {
  if (value instanceof BigInt) {
    value = value.toString()
  }
  const splitValue = value.split('.')
  if (splitValue.length > 1) return splitValue[1].length
  return 0
}

export const round = (value: string): string => {
  const decimals = countDecimals(value)
  if (decimals === 0) {
    return value
  }
  if (decimals < 10) return value
  return Number(value).toFixed(10)
}

export const roundTokenValue = (value: string): string => {
  const decimals = countDecimals(value)
  if (decimals === 0) {
    return value
  }
  if (decimals < 18) return value
  return Number(value).toFixed(18)
}
