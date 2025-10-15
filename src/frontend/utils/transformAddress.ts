export const isEthereumAddress = (address: string): boolean => {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

export const isShardusAddress = (address: string): boolean => {
  if (address.length !== 64) return false
  return true
}

export const toShardusAddress = (address: string): string => {
  if (address.length === 64) return address
  if (isEthereumAddress(address)) {
    address = address.slice(2)
    return address + '0'.repeat(24)
  }
  return address // return original address even if it's not a valid address
}

export const toEthereumAddress = (address: string): string => {
  if (isEthereumAddress(address)) return address
  if (isShardusAddress(address)) {
    // Check if the last 24 characters are 0s
    if (address.endsWith('0'.repeat(24))) {
      address = address.slice(0, -24)
      return '0x' + address
    }
  }
  return address // return original address even if it's not a valid address
}

/**
 * Truncates an address to only show the first 10 characters and the last 10 characters.
 * If the address is 14 characters or less, it is returned as is.
 * @param address the address to truncate
 * @returns the truncated address
 */
export const truncateAddress = (address: string): string => {
  if (address.length <= 14) {
    return address
  }
  const start = address.slice(0, 10)
  const end = address.slice(-10)
  return `${start}...${end}`
}
