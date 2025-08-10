import React, { createContext, useContext, useState, ReactNode } from 'react'

interface SettingsContextType {
  systemPrompt: string
  setSystemPrompt: (prompt: string) => void
  // Add more settings here as needed
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined)

export const useSettings = () => {
  const context = useContext(SettingsContext)
  if (!context) throw new Error('useSettings must be used within a SettingsProvider')
  return context
}

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const [systemPrompt, setSystemPromptState] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('systemPrompt') || ''
    }
    return ''
  })

  const setSystemPrompt = (prompt: string) => {
    setSystemPromptState(prompt)
    if (typeof window !== 'undefined') {
      localStorage.setItem('systemPrompt', prompt)
    }
  }

  // Add more settings state here as needed
  return (
    <SettingsContext.Provider value={{ systemPrompt, setSystemPrompt }}>
      {children}
    </SettingsContext.Provider>
  )
}
