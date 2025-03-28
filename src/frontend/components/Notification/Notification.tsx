import React, { useState, useEffect } from 'react'
import styles from './Notification.module.scss'

interface NotificationProps {
  message: string
  type?: 'error' | 'success' | 'warning' | 'info'
  duration?: number
  onClose?: () => void
}

export const Notification: React.FC<NotificationProps> = ({
  message,
  type = 'error',
  duration = 3000,
  onClose,
}) => {
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false)
      onClose?.()
    }, duration)

    return () => clearTimeout(timer)
  }, [duration, onClose])

  if (!isVisible) return null

  const notificationClass = `${styles.notification} ${styles[type]}`

  return <div className={notificationClass}>{message}</div>
}
