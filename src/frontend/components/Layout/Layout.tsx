import React, { ReactNode, useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { Header } from '../Header'
import { Footer } from '../Footer'

import styles from './Layout.module.scss'
import { Button } from '../Button'
import { Icon } from '../Icon'

export interface LayoutProps {
  children: ReactNode
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const router = useRouter()
  const [showUpButton, setShowUpButton] = useState<boolean>(false)
  const isChartsPage = router.pathname.startsWith('/charts')

  useEffect(() => {
    const handleScrollButtonVisibility = (): void => {
      setShowUpButton(window.pageYOffset > 300 ? true : false)
    }
    window.addEventListener('scroll', handleScrollButtonVisibility)

    return () => {
      window.removeEventListener('scroll', handleScrollButtonVisibility)
    }
  }, [])

  const scrollToTop = (): void => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
  }

  return (
    <div className={`${styles.Layout} ${!isChartsPage ? styles.overflowHidden : ''}`}>
      <Header />
      <main>{children}</main>
      <Footer />
      {showUpButton && (
        <Button apperance="outlined" className={styles.button} onClick={scrollToTop}>
          <Icon name="up_arrow" size="large" color="black" />
        </Button>
      )}
    </div>
  )
}
