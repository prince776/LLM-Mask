import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { SERVER_URL } from '../config'
import { useUser } from './UserContext'

export interface Notification {
  message: string
  createdAt: string
}

type RawNotification = Notification & {
  Message?: string
  CreatedAt?: string
}

interface NotificationContextType {
  globalNotif: Notification | null
  userNotif: Notification | null
  dismissGlobal: () => void
  dismissUser: () => void
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

export const useNotifications = () => {
  const context = useContext(NotificationContext)
  if (!context) throw new Error('useNotifications must be used within a NotificationProvider')
  return context
}

function isDismissed(key: 'global' | 'user', createdAt: string): boolean {
  return localStorage.getItem(`dismissed_${key}_${createdAt}`) === 'true'
}

function markDismissed(key: 'global' | 'user', createdAt: string): void {
  localStorage.setItem(`dismissed_${key}_${createdAt}`, 'true')
}

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useUser()
  const [globalNotif, setGlobalNotif] = useState<Notification | null>(null)
  const [userNotif, setUserNotif] = useState<Notification | null>(null)

  const normalizeNotification = (notif: RawNotification | null | undefined): Notification | null => {
    if (!notif) return null
    const message = notif.message ?? notif.Message ?? ''
    const createdAt = notif.createdAt ?? notif.CreatedAt ?? ''
    if (!message || !createdAt) return null
    return { message, createdAt }
  }

  const fetchNotifications = useCallback(async () => {
    if (!user) return
    try {
      const res = await fetch(`${SERVER_URL}/api/v1/notifications`, {
        credentials: 'include'
      })
      if (!res.ok) return
      const data = await res.json()
      const payload = data.data as { global: RawNotification | null; user: RawNotification | null }
      const global = normalizeNotification(payload.global)
      const userLevel = normalizeNotification(payload.user)

      if (global && !isDismissed('global', global.createdAt)) {
        setGlobalNotif(global)
      } else {
        setGlobalNotif(null)
      }

      if (userLevel && !isDismissed('user', userLevel.createdAt)) {
        setUserNotif(userLevel)
      } else {
        setUserNotif(null)
      }
    } catch {
      // silently ignore network errors
    }
  }, [user])

  useEffect(() => {
    if (!user) {
      setGlobalNotif(null)
      setUserNotif(null)
      return
    }
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [user, fetchNotifications])

  const dismissGlobal = () => {
    if (globalNotif) {
      markDismissed('global', globalNotif.createdAt)
      setGlobalNotif(null)
    }
  }

  const dismissUser = () => {
    if (userNotif) {
      markDismissed('user', userNotif.createdAt)
      setUserNotif(null)
    }
  }

  return (
    <NotificationContext.Provider value={{ globalNotif, userNotif, dismissGlobal, dismissUser }}>
      {children}
    </NotificationContext.Provider>
  )
}
