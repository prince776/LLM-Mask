import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { SERVER_URL } from '../config'
import { useUser } from './UserContext'

export interface Notification {
  message: string
  createdAt: string
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

function normalize(n: any): Notification | null {
  if (!n) return null
  const message = n.message ?? n.Message ?? ''
  const createdAt = n.createdAt ?? n.CreatedAt ?? ''
  if (!message || !createdAt) return null
  return { message, createdAt }
}

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useUser()
  const [globalNotif, setGlobalNotif] = useState<Notification | null>(null)
  const [userNotif, setUserNotif] = useState<Notification | null>(null)

  const fetchNotifications = useCallback(async () => {
    if (!user) return
    try {
      const res = await fetch(`${SERVER_URL}/api/v1/notifications`, { credentials: 'include' })
      if (!res.ok) return
      const data = await res.json()
      const payload = data.data as { global: any; user: any }

      const global = normalize(payload.global)
      const userLevel = normalize(payload.user)

      setGlobalNotif(global && !isDismissed('global', global.createdAt) ? global : null)
      setUserNotif(userLevel && !isDismissed('user', userLevel.createdAt) ? userLevel : null)
    } catch {
      // silently ignore
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
