import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { SearchBar } from '../SearchBar'
import Image from 'next/image'

import { Icon } from '../index'

import styles from './Header.module.scss'
import { TransactionType } from '../../../types'

interface SubMenuItem {
  name: string
  href: string
  external?: boolean
}

interface MenuItem {
  name: string
  href: string
  current?: boolean
  hasSubmenu?: boolean
  submenu?: SubMenuItem[]
}

export const Header: React.FC<Record<string, never>> = () => {
  const router = useRouter()
  const basePath = router.basePath || ''

  const isHomePage = router.pathname === '/'

  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false)
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null)

  const menuItems: MenuItem[] = [
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
        // { name: 'Stats Dashboard', href: '/stats_dashboard' },
        // { name: 'Daily Transactions', href: '/daily_transactions' },
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
            <Image src={`${basePath}/favicon.ico`} alt="Image" width={32} height={32} className={styles.logo} unoptimized />

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
                <Link
                  href={item.href}
                  className={item.current ? 'active' : ''}
                  onClick={(e) => {
                    if (item.href === '#') {
                      e.preventDefault()
                    }
                  }}
                >
                  {item.name}
                  {item.hasSubmenu && <Icon name="arrow_down" size="medium" color="black" />}
                </Link>
                {item.hasSubmenu && activeSubmenu === item.name && (
                  <div className={styles.submenu}>
                    {item.submenu?.map((subItem) => (
                      <React.Fragment key={subItem.name}>
                        {subItem.external ? (
                          <a
                            href={subItem.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.submenu_item}
                          >
                            {subItem.name}
                          </a>
                        ) : (
                          <Link href={subItem.href} className={styles.submenu_item}>
                            {subItem.name}
                          </Link>
                        )}
                        <div className={styles.divider}></div>
                      </React.Fragment>
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
                <Link
                  href={item.hasSubmenu ? '#' : item.href}
                  className={item.current ? 'active' : ''}
                  onClick={(e) => {
                    if (item.hasSubmenu) {
                      e.preventDefault()
                      handleMobileSubmenuClick(item.name)
                    } else {
                      setIsMenuOpen(false)
                    }
                  }}
                >
                  <div className={styles.menuitem_content}>
                    {item.name}
                    {item.hasSubmenu && <Icon name="arrow_down" color="black" />}
                  </div>
                </Link>
                {item.hasSubmenu && activeSubmenu === item.name && (
                  <div className={styles.mobile_submenu}>
                    {item.submenu?.map((subItem) =>
                      subItem.external ? (
                        <a
                          key={subItem.name}
                          href={subItem.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.submenu_item}
                          onClick={() => setIsMenuOpen(false)}
                        >
                          {subItem.name}
                        </a>
                      ) : (
                        <Link
                          key={subItem.name}
                          href={subItem.href}
                          className={styles.submenu_item}
                          onClick={() => setIsMenuOpen(false)}
                        >
                          {subItem.name}
                        </Link>
                      )
                    )}
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
