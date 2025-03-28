import React from 'react'
import { useSearchHook } from './useSearchHook'
import styles from './SearchBar.module.scss'
import { Icon } from '../Icon'
import { Notification } from '../Notification'

export const SearchBar: React.FC<Record<string, never>> = () => {
  const { search, setSearch, onSearch, searchError } = useSearchHook()

  const handleSearch = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    onSearch()
    setSearch('')
  }

  return (
    <div>
      <form onSubmit={handleSearch} className={styles.SearchBar}>
        <Icon className={styles.iconWrapper} name="search" size="small" color="black"></Icon>
        <input
          className={styles.input}
          type="text"
          placeholder="Search by Username / Account Address / Transaction ID / Cycle Number / Cycle Marker / Node ID"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </form>
      {searchError && <Notification message={searchError} type="error" />}
    </div>
  )
}
