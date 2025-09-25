import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { SearchBar } from '../SearchBar'
import Image from 'next/image'

import { Icon } from '../index'

import styles from './Header.module.scss'
import { TransactionType } from '../../../types'

export const Header: React.FC<Record<string, never>> = () => {
  const router = useRouter()

  const isHomePage = router.pathname === '/'

  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false)
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null)

  const menuItems = [
    { name: 'Home', href: '/', current: true },
    {
      name: 'Transactions',
      href: '/transaction',
      hasSubmenu: true,
      submenu: [
        { name: 'All Transactions', href: '/transaction' },
        { name: 'Transfer Transactions', href: `/transaction?txType=${TransactionType.transfer}` },
        { name: 'Message Transactions', href: `/transaction?txType=${TransactionType.message}` },
      ],
    },
    {
      name: 'Resources',
      href: '#',
      hasSubmenu: true,
      submenu: [
        { name: 'Charts & Stats', href: '/charts' },
        { name: 'Daily Transactions', href: '/daily_transactions' },
        // { name: 'Validators Stats', href: '/validator_line_chart' },
        // { name: 'Transactions Stats', href: '/transaction_line_chart' },
      ],
    },
    {
      name: 'More',
      href: '#',
      hasSubmenu: true,
      submenu: [
        { name: 'About Liberdus', href: 'https://liberdus.com', external: true },
        { name: 'Liberdus Web Client', href: 'https://liberdus.com/download', external: true },
        {
          name: 'Run a validator node',
          href: 'https://liberdus.com/node',
          external: true,
        },
      ],
    },
  ]

  const handleMouseEnter = (itemName: string): void => {
    setActiveSubmenu(itemName)
  }

  const handleMouseLeave = (): void => {
    setActiveSubmenu(null)
  }

  const handleMobileSubmenuClick = (itemName: string): void => {
    setActiveSubmenu(activeSubmenu === itemName ? null : itemName)
  }

  return (
    <header className={styles.Header}>
      <nav className={styles.nav}>
        <div className={styles.nav_content}>
          <Link href="/" className={styles.logoWrapper}>
            {/* <Icon name="logo" className={styles.logo} size="extraLarge" /> */}
            <Image src="/favicon.ico" alt="Image" width={32} height={32} className={styles.logo} />

            <div className={styles.name}>Liberdus Explorer</div>
          </Link>
          {!isHomePage && <SearchBar />}

          <div className={styles.desktop_menu}>
            {menuItems.map((item) => (
              <div
                key={item.name}
                className={styles.menu_item}
                onMouseEnter={() => item.hasSubmenu && handleMouseEnter(item.name)}
                onMouseLeave={handleMouseLeave}
              >
                <a href={item.href} className={item.current ? 'active' : ''}>
                  {item.name}
                  {item.hasSubmenu && <Icon name="arrow_down" size="medium" color="black" />}
                </a>
                {item.hasSubmenu && activeSubmenu === item.name && (
                  <div className={styles.submenu}>
                    {item.submenu?.map((subItem) => (
                      <>
                        <a
                          key={subItem.name}
                          href={subItem.href}
                          target={subItem.external ? '_blank' : '_self'}
                          className={styles.submenu_item}
                        >
                          {subItem.name}
                        </a>
                        <div className={styles.divider}></div>
                      </>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <button className={styles.mobile_menu_button} onClick={() => setIsMenuOpen(!isMenuOpen)}>
            {isMenuOpen ? (
              // <Icon name="menu" size="medium" color="black" />
              <Icon name="menu" size="medium" color="black" />
            ) : (
              <Icon name="menu" size="medium" color="black" />
            )}
          </button>
        </div>

        {/* {renderMenuButton()} */}
        {isMenuOpen && (
          <div className={styles.mobile_menu}>
            {menuItems.map((item) => (
              <div key={item.name} className={styles.menu_item}>
                <a
                  href={item.hasSubmenu ? '#' : item.href}
                  className={item.current ? 'active' : ''}
                  onClick={(e) => {
                    if (item.hasSubmenu) {
                      e.preventDefault()
                      handleMobileSubmenuClick(item.name)
                    }
                  }}
                >
                  <div className={styles.menuitem_content}>
                    {item.name}
                    {item.hasSubmenu && <Icon name="arrow_down" color="black" />}
                  </div>
                </a>
                {item.hasSubmenu && activeSubmenu === item.name && (
                  <div className={styles.mobile_submenu}>
                    {item.submenu?.map((subItem) => (
                      <a
                        key={subItem.name}
                        href={subItem.href}
                        target={subItem.external ? '_blank' : '_self'}
                        className={styles.submenu_item}
                      >
                        {subItem.name}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </nav>
    </header>
  )
}
