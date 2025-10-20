import React, { useRef, useState, useEffect } from 'react'
import { ContentLayout } from '../../components'
import { OverviewSection } from '../OverviewSection'
import { BlockchainDataSection } from '../BlockchainDataSection'
import { breadcrumbsList } from '../../types'

import styles from './ChartsPage.module.scss'
import { MarketDataSection } from '../MarketDataSection'
import { NetworkDataSection } from '../NetworkDataSection'

export type ChartsSectionType = 'overview' | 'market-data' | 'blockchain-data' | 'network-data'

export const ChartsPage: React.FC = () => {
  const [activeSection, setActiveSection] = useState<ChartsSectionType>('overview')
  const [isScrolling, setIsScrolling] = useState(false)

  const overviewRef = useRef<HTMLDivElement>(null)
  const marketDataRef = useRef<HTMLDivElement>(null)
  const blockchainDataRef = useRef<HTMLDivElement>(null)
  const networkDataRef = useRef<HTMLDivElement>(null)

  const breadcrumbs = [breadcrumbsList.dashboard]

  const scrollToSection = (sectionId: ChartsSectionType): void => {
    const refs = {
      overview: overviewRef,
      'market-data': marketDataRef,
      'blockchain-data': blockchainDataRef,
      'network-data': networkDataRef,
    }

    const ref = refs[sectionId] as React.RefObject<HTMLDivElement> | undefined

    if (ref?.current) {
      setIsScrolling(true)
      setActiveSection(sectionId)

      const elementTop = ref.current.getBoundingClientRect().top + window.scrollY - 20 // Subtract 20px for top spacing
      const startPosition = window.scrollY
      const distance = Math.abs(elementTop - startPosition)

      const duration = Math.min(1000, Math.max(300, distance / 2))

      window.scrollTo({
        top: elementTop,
        behavior: 'smooth',
      })

      setTimeout(() => {
        setIsScrolling(false)
      }, duration + 100)
    }
  }

  const handleSectionChange = (section: ChartsSectionType): void => {
    scrollToSection(section)
  }

  useEffect(() => {
    const handleScroll = (): void => {
      // Don't update active section during programmatic scrolling
      if (isScrolling) return

      const sections = [
        { id: 'overview' as ChartsSectionType, ref: overviewRef },
        { id: 'market-data' as ChartsSectionType, ref: marketDataRef },
        { id: 'blockchain-data' as ChartsSectionType, ref: blockchainDataRef },
        { id: 'network-data' as ChartsSectionType, ref: networkDataRef },
      ]

      const scrollPosition = window.scrollY + 150 // Changed to window.scrollY
      let activeId: ChartsSectionType = 'overview'

      for (let i = sections.length - 1; i >= 0; i--) {
        const section = sections[i]
        if (section.ref.current) {
          const element = section.ref.current
          const elementTop = element.getBoundingClientRect().top + window.scrollY // Changed calculation

          if (scrollPosition >= elementTop) {
            activeId = section.id
            break
          }
        }
      }

      setActiveSection(activeId)
    }

    const throttledHandleScroll = (): void => {
      requestAnimationFrame(handleScroll)
    }

    window.addEventListener('scroll', throttledHandleScroll, { passive: true }) // Changed to window
    handleScroll()

    return () => window.removeEventListener('scroll', throttledHandleScroll) // Changed cleanup
  }, [isScrolling])

  return (
    <div className={styles.ChartsPage}>
      <ContentLayout title="Charts & Statistics" breadcrumbItems={breadcrumbs} showBackButton>
        <div className={styles.container}>
          {/* Left Sidebar Navigation */}
          <div className={styles.sidebar}>
            <div className={styles.sidebarItem}>
              <button
                className={`${styles.sidebarButton} ${activeSection === 'overview' ? styles.active : ''}`}
                onClick={() => handleSectionChange('overview')}
                style={{
                  backgroundColor: activeSection === 'overview' ? '#e7f3ff' : 'transparent',
                  color: activeSection === 'overview' ? '#0066cc' : '#6c757d',
                  fontWeight: activeSection === 'overview' ? '600' : '500',
                }}
              >
                Overview
              </button>
            </div>
            <div className={styles.sidebarItem}>
              <button
                className={`${styles.sidebarButton} ${activeSection === 'market-data' ? styles.active : ''}`}
                onClick={() => handleSectionChange('market-data')}
                style={{
                  backgroundColor: activeSection === 'market-data' ? '#e7f3ff' : 'transparent',
                  color: activeSection === 'market-data' ? '#0066cc' : '#6c757d',
                  fontWeight: activeSection === 'market-data' ? '600' : '500',
                }}
              >
                Market Data
              </button>
            </div>
            <div className={styles.sidebarItem}>
              <button
                className={`${styles.sidebarButton} ${
                  activeSection === 'blockchain-data' ? styles.active : ''
                }`}
                onClick={() => handleSectionChange('blockchain-data')}
                style={{
                  backgroundColor: activeSection === 'blockchain-data' ? '#e7f3ff' : 'transparent',
                  color: activeSection === 'blockchain-data' ? '#0066cc' : '#6c757d',
                  fontWeight: activeSection === 'blockchain-data' ? '600' : '500',
                }}
              >
                Blockchain Data
              </button>
            </div>
            <div className={styles.sidebarItem}>
              <button
                className={`${styles.sidebarButton} ${activeSection === 'network-data' ? styles.active : ''}`}
                onClick={() => handleSectionChange('network-data')}
                style={{
                  backgroundColor: activeSection === 'network-data' ? '#e7f3ff' : 'transparent',
                  color: activeSection === 'network-data' ? '#0066cc' : '#6c757d',
                  fontWeight: activeSection === 'network-data' ? '600' : '500',
                }}
              >
                Network Data
              </button>
            </div>
          </div>

          {/* Main Scrollable Content */}
          <div className={styles.mainContent}>
            <div ref={overviewRef} className={styles.section} id="overview">
              <OverviewSection />
            </div>

            <div ref={marketDataRef} className={styles.section} id="market-data">
              <MarketDataSection />
            </div>

            <div ref={blockchainDataRef} className={styles.section} id="blockchain-data">
              <BlockchainDataSection />
            </div>

            <div ref={networkDataRef} className={styles.section} id="network-data">
              <NetworkDataSection />
            </div>
          </div>
        </div>
      </ContentLayout>
    </div>
  )
}
