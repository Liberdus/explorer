import React, { useRef, useState, useEffect } from 'react'
import { ContentLayout } from '../../components'
import { OverviewSection } from '../OverviewSection'
import { BlockchainDataSection } from '../BlockchainDataSection'
import { breadcrumbsList } from '../../types'

import styles from './ChartsPage.module.scss'
import { MarketDataSection } from '../MarketDataSection'

export type ChartsSectionType =
  | 'overview'
  | 'market'
  | 'blockchain-data'
  | 'network-stats'
  | 'transaction-stats'
  | 'transaction-charts'
  | 'validator-charts'
  | 'network-charts'

export const ChartsPage: React.FC = () => {
  const [activeSection, setActiveSection] = useState<ChartsSectionType>('overview')
  const [isScrolling, setIsScrolling] = useState(false)

  const overviewRef = useRef<HTMLDivElement>(null)
  const marketRef = useRef<HTMLDivElement>(null)
  const blockchainDataRef = useRef<HTMLDivElement>(null)
  const networkStatsRef = useRef<HTMLDivElement>(null)
  const transactionStatsRef = useRef<HTMLDivElement>(null)
  const transactionChartsRef = useRef<HTMLDivElement>(null)
  const validatorChartsRef = useRef<HTMLDivElement>(null)
  const networkChartsRef = useRef<HTMLDivElement>(null)

  const breadcrumbs = [breadcrumbsList.dashboard]

  const scrollToSection = (sectionId: ChartsSectionType): void => {
    const refs = {
      overview: overviewRef,
      market: marketRef,
      'blockchain-data': blockchainDataRef,
      'network-stats': networkStatsRef,
      'transaction-stats': transactionStatsRef,
      'transaction-charts': transactionChartsRef,
      'validator-charts': validatorChartsRef,
      'network-charts': networkChartsRef,
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
        { id: 'market' as ChartsSectionType, ref: marketRef },
        { id: 'blockchain-data' as ChartsSectionType, ref: blockchainDataRef },
        { id: 'network-stats' as ChartsSectionType, ref: networkStatsRef },
        { id: 'transaction-stats' as ChartsSectionType, ref: transactionStatsRef },
        { id: 'transaction-charts' as ChartsSectionType, ref: transactionChartsRef },
        { id: 'validator-charts' as ChartsSectionType, ref: validatorChartsRef },
        { id: 'network-charts' as ChartsSectionType, ref: networkChartsRef },
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
                className={`${styles.sidebarButton} ${activeSection === 'market' ? styles.active : ''}`}
                onClick={() => handleSectionChange('market')}
                style={{
                  backgroundColor: activeSection === 'market' ? '#e7f3ff' : 'transparent',
                  color: activeSection === 'market' ? '#0066cc' : '#6c757d',
                  fontWeight: activeSection === 'market' ? '600' : '500',
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
                className={`${styles.sidebarButton} ${
                  activeSection === 'network-stats' ? styles.active : ''
                }`}
                onClick={() => handleSectionChange('network-stats')}
                style={{
                  backgroundColor: activeSection === 'network-stats' ? '#e7f3ff' : 'transparent',
                  color: activeSection === 'network-stats' ? '#0066cc' : '#6c757d',
                  fontWeight: activeSection === 'network-stats' ? '600' : '500',
                }}
              >
                Network Statistics
              </button>
            </div>
            <div className={styles.sidebarItem}>
              <button
                className={`${styles.sidebarButton} ${
                  activeSection === 'transaction-stats' ? styles.active : ''
                }`}
                onClick={() => handleSectionChange('transaction-stats')}
                style={{
                  backgroundColor: activeSection === 'transaction-stats' ? '#e7f3ff' : 'transparent',
                  color: activeSection === 'transaction-stats' ? '#0066cc' : '#6c757d',
                  fontWeight: activeSection === 'transaction-stats' ? '600' : '500',
                }}
              >
                Transaction Overview
              </button>
            </div>
            <div className={styles.sidebarItem}>
              <button
                className={`${styles.sidebarButton} ${
                  activeSection === 'transaction-charts' ? styles.active : ''
                }`}
                onClick={() => handleSectionChange('transaction-charts')}
                style={{
                  backgroundColor: activeSection === 'transaction-charts' ? '#e7f3ff' : 'transparent',
                  color: activeSection === 'transaction-charts' ? '#0066cc' : '#6c757d',
                  fontWeight: activeSection === 'transaction-charts' ? '600' : '500',
                }}
              >
                Transaction Charts
              </button>
            </div>
            <div className={styles.sidebarItem}>
              <button
                className={`${styles.sidebarButton} ${
                  activeSection === 'validator-charts' ? styles.active : ''
                }`}
                onClick={() => handleSectionChange('validator-charts')}
                style={{
                  backgroundColor: activeSection === 'validator-charts' ? '#e7f3ff' : 'transparent',
                  color: activeSection === 'validator-charts' ? '#0066cc' : '#6c757d',
                  fontWeight: activeSection === 'validator-charts' ? '600' : '500',
                }}
              >
                Validator Charts
              </button>
            </div>
            <div className={styles.sidebarItem}>
              <button
                className={`${styles.sidebarButton} ${
                  activeSection === 'network-charts' ? styles.active : ''
                }`}
                onClick={() => handleSectionChange('network-charts')}
                style={{
                  backgroundColor: activeSection === 'network-charts' ? '#e7f3ff' : 'transparent',
                  color: activeSection === 'network-charts' ? '#0066cc' : '#6c757d',
                  fontWeight: activeSection === 'network-charts' ? '600' : '500',
                }}
              >
                Network Charts
              </button>
            </div>
          </div>

          {/* Main Scrollable Content */}
          <div className={styles.mainContent}>
            <div ref={overviewRef} className={styles.section} id="overview">
              <OverviewSection />
            </div>

            <div ref={marketRef} className={styles.section} id="market">
              <MarketDataSection />
            </div>

            <div ref={blockchainDataRef} className={styles.section} id="blockchain-data">
              <BlockchainDataSection />
            </div>

            <div ref={networkStatsRef} className={styles.section} id="network-stats">
              <div className={styles.sectionPlaceholder}>
                <h3>Network Statistics</h3>
                <p>Network statistics section will be added here</p>
              </div>
            </div>

            <div ref={transactionStatsRef} className={styles.section} id="transaction-stats">
              <div className={styles.sectionPlaceholder}>
                <h3>Transaction Overview</h3>
                <p>Transaction statistics section will be added here</p>
              </div>
            </div>

            <div ref={transactionChartsRef} className={styles.section} id="transaction-charts">
              <div className={styles.sectionPlaceholder}>
                <h3>Transaction Charts</h3>
                <p>Transaction charts section will be added here</p>
              </div>
            </div>

            <div ref={validatorChartsRef} className={styles.section} id="validator-charts">
              <div className={styles.sectionPlaceholder}>
                <h3>Validator Charts</h3>
                <p>Validator charts section will be added here</p>
              </div>
            </div>

            <div ref={networkChartsRef} className={styles.section} id="network-charts">
              <div className={styles.sectionPlaceholder}>
                <h3>Network Charts</h3>
                <p>Network charts section will be added here</p>
              </div>
            </div>
          </div>
        </div>
      </ContentLayout>
    </div>
  )
}
