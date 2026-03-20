import { createContext, useContext, useState, ReactNode, useEffect } from 'react'
import { SERVER_URL, WEB_APP_URL } from '../config'
import { useError } from './ErrorContext'

export interface User {
  id: string
  name: string
  email: string
  picture: string
  numActiveToken: Record<string, number>
  TransientToken: string
}

interface UserContextType {
  user: User | null
  signIn: () => void
  signOut: () => Promise<void>
  decrementToken: (model: string) => void
  refetchUser: () => Promise<void>
  isLoading: boolean
}

const UserContext = createContext<UserContextType | undefined>(undefined)

export const useUser = () => {
  const context = useContext(UserContext)
  if (!context) throw new Error('useUser must be used within a UserProvider')
  return context
}

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const { showError } = useError()

  const decrementToken = (model: string) => {
    setUser((prev) => {
      if (!prev) return prev
      const current = prev.numActiveToken[model] || 0
      return {
        ...prev,
        numActiveToken: { ...prev.numActiveToken, [model]: current > 0 ? current - 1 : 0 }
      }
    })
  }

  const fetchUser = async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`${SERVER_URL}/api/v1/me`, {
        method: 'GET',
        credentials: 'include'
      })
      if (res.ok) {
        const data = await res.json()
        setUser({
          id: data.data.id,
          name: data.data.Name,
          email: data.data.Email,
          picture: data.data.ProfileImage,
          numActiveToken: { ...data.data.SubscriptionInfo?.ActiveAuthTokens },
          TransientToken: data.data.TransientToken
        })
      } else if (res.status === 401) {
        setUser(null)
      } else {
        showError('Failed to load profile, status: ' + res.status)
      }
    } catch (e) {
      showError('Failed to load profile: ' + e)
    } finally {
      setIsLoading(false)
    }
  }

  const refetchUser = async () => fetchUser()

  useEffect(() => {
    fetchUser()
  }, [])

  const signIn = () => {
    const callbackUrl = `${WEB_APP_URL}/auth/callback`
    window.location.href = `${SERVER_URL}/api/v1/users/signin?redirect=${encodeURIComponent(callbackUrl)}`
  }

  const signOut = async () => {
    await fetch(`${SERVER_URL}/api/v1/users/signout`, {
      method: 'POST',
      credentials: 'include'
    })
    setUser(null)
  }

  return (
    <UserContext.Provider value={{ user, signIn, signOut, decrementToken, refetchUser, isLoading }}>
      {children}
    </UserContext.Provider>
  )
}
