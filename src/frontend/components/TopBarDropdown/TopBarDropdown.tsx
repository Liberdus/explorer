'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import cx from 'classnames'

import styles from './TopBarDropdown.module.scss'
import { Icon } from '../Icon'

type Option = {
  key: string | number
  value: string
}

interface TopBarDropdownProps {
  label?: string
  selected?: string
  options?: Option[]
  className?: string
  buttonClassName?: string
  menuClassName?: string
  onSelect?: (item: Option) => void
}

export const TopBarDropdown: React.FC<TopBarDropdownProps> = (props) => {
  const { label, selected, options, className, buttonClassName, menuClassName } = props

  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false)

  const menuRef = useRef<HTMLDivElement>(null)

  const open = useCallback(() => {
    setIsMenuOpen(true)
  }, [])

  const close = useCallback(() => {
    setIsMenuOpen(false)
  }, [])

  const toggle = useCallback(() => {
    if (isMenuOpen) close()
    else open()
  }, [isMenuOpen, close, open])

  const handleClick = useCallback(
    (e: MouseEvent) => {
      if (!menuRef.current?.contains(e?.target as Node)) {
        close()
      }
    },
    [close]
  )

  useEffect(() => {
    document?.addEventListener('click', handleClick, true)

    return () => document?.removeEventListener('click', handleClick, true)
  }, [handleClick])

  return (
    <div className={cx(styles.TopBarDropdown, className)}>
      <button data-active={isMenuOpen} className={cx(styles.button, buttonClassName)} onClick={toggle}>
        <>
          {label || selected || options?.[0].value}
          {isMenuOpen ? (
            <Icon name="arrow_up" color="black" className={styles.icon} />
          ) : (
            <Icon name="arrow_down" color="black" className={styles.icon} />
          )}
        </>
      </button>
      {isMenuOpen && (
        <div ref={menuRef} className={cx(styles.menu, menuClassName)}>
          {options?.map((item) => (
            <a
              key={item.key}
              target="_blank"
              rel="noreferrer"
              href={item.key.toString()}
              className={cx(styles.menuItem)}
            >
              {item.value}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
