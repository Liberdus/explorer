import React, { useRef, useState, useEffect } from 'react'
import { ContentLayout } from '../../components'
import { OverviewSection } from '../OverviewSection'
import { breadcrumbsList } from '../../types'

import styles from './ChartsPage.module.scss'

export type ChartsSectionType =
  | 'overview'
  | 'charts'
  | 'network-stats'
  | 'validator-stats'
  | 'transaction-stats'
  | 'transaction-charts'
  | 'validator-charts'
  | 'network-charts'

export const ChartsPage: React.FC = () => {
  const [activeSection, setActiveSection] = useState<ChartsSectionType>('overview')
  const [isScrolling, setIsScrolling] = useState(false)

  const mainContentRef = useRef<HTMLDivElement>(null)
  const overviewRef = useRef<HTMLDivElement>(null)
  const chartsRef = useRef<HTMLDivElement>(null)
  const networkStatsRef = useRef<HTMLDivElement>(null)
  const validatorStatsRef = useRef<HTMLDivElement>(null)
  const transactionStatsRef = useRef<HTMLDivElement>(null)
  const transactionChartsRef = useRef<HTMLDivElement>(null)
  const validatorChartsRef = useRef<HTMLDivElement>(null)
  const networkChartsRef = useRef<HTMLDivElement>(null)

  const breadcrumbs = [breadcrumbsList.dashboard]

  const scrollToSection = (sectionId: ChartsSectionType): void => {
    const refs = {
      overview: overviewRef,
      charts: chartsRef,
      'network-stats': networkStatsRef,
      'validator-stats': validatorStatsRef,
      'transaction-stats': transactionStatsRef,
      'transaction-charts': transactionChartsRef,
      'validator-charts': validatorChartsRef,
      'network-charts': networkChartsRef,
    }

    const ref = refs[sectionId] as React.RefObject<HTMLDivElement> | undefined
    const mainContent = mainContentRef.current

    if (ref?.current && mainContent) {
      setIsScrolling(true)
      setActiveSection(sectionId) // Set immediately to prevent flicker

      const elementTop = ref.current.offsetTop
      mainContent.scrollTo({
        top: elementTop,
        behavior: 'smooth',
      })

      // Reset scrolling flag after animation completes
      setTimeout(() => {
        setIsScrolling(false)
      }, 800) // Slightly longer than typical smooth scroll duration
    }
  }

  const handleSectionChange = (section: ChartsSectionType): void => {
    scrollToSection(section)
  }

  useEffect(() => {
    const mainContent = mainContentRef.current
    if (!mainContent) return

    const handleScroll = (): void => {
      // Don't update active section during programmatic scrolling
      if (isScrolling) return

      const sections = [
        { id: 'overview' as ChartsSectionType, ref: overviewRef },
        { id: 'charts' as ChartsSectionType, ref: chartsRef },
        { id: 'network-stats' as ChartsSectionType, ref: networkStatsRef },
        { id: 'validator-stats' as ChartsSectionType, ref: validatorStatsRef },
        { id: 'transaction-stats' as ChartsSectionType, ref: transactionStatsRef },
        { id: 'transaction-charts' as ChartsSectionType, ref: transactionChartsRef },
        { id: 'validator-charts' as ChartsSectionType, ref: validatorChartsRef },
        { id: 'network-charts' as ChartsSectionType, ref: networkChartsRef },
      ]

      // Use the scroll position of the mainContent container
      const scrollPosition = mainContent.scrollTop + 150
      let activeId: ChartsSectionType = 'overview'

      for (let i = sections.length - 1; i >= 0; i--) {
        const section = sections[i]
        if (section.ref.current) {
          const element = section.ref.current
          // Get position relative to the mainContent container
          const elementTop = element.offsetTop - mainContent.offsetTop

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

    // Listen to scroll events on the mainContent container, not window
    mainContent.addEventListener('scroll', throttledHandleScroll, { passive: true })
    handleScroll() // Call once on mount

    return () => mainContent.removeEventListener('scroll', throttledHandleScroll)
  }, [isScrolling]) // Add isScrolling to dependency array

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
                className={`${styles.sidebarButton} ${activeSection === 'charts' ? styles.active : ''}`}
                onClick={() => handleSectionChange('charts')}
                style={{
                  backgroundColor: activeSection === 'charts' ? '#e7f3ff' : 'transparent',
                  color: activeSection === 'charts' ? '#0066cc' : '#6c757d',
                  fontWeight: activeSection === 'charts' ? '600' : '500',
                }}
              >
                Charts & Stats
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
                  activeSection === 'validator-stats' ? styles.active : ''
                }`}
                onClick={() => handleSectionChange('validator-stats')}
                style={{
                  backgroundColor: activeSection === 'validator-stats' ? '#e7f3ff' : 'transparent',
                  color: activeSection === 'validator-stats' ? '#0066cc' : '#6c757d',
                  fontWeight: activeSection === 'validator-stats' ? '600' : '500',
                }}
              >
                Validator Overview
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
          <div ref={mainContentRef} className={styles.mainContent}>
            <div ref={overviewRef} className={styles.section} id="overview">
              <OverviewSection />
            </div>

            <div ref={chartsRef} className={styles.section} id="charts">
              <div className={styles.sectionPlaceholder}>
                <h3>Charts & Stats</h3>
                <p>Charts & Stats section will be added here</p>
              </div>
            </div>

            <div ref={networkStatsRef} className={styles.section} id="network-stats">
              <div className={styles.sectionPlaceholder}>
                <h3>Network Statistics</h3>
                <p>Network statistics section will be added here</p>
              </div>
            </div>

            <div ref={validatorStatsRef} className={styles.section} id="validator-stats">
              <div className={styles.sectionPlaceholder}>
                <h3>Validator Overview</h3>
                <p>Validator statistics section will be added here</p>
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
