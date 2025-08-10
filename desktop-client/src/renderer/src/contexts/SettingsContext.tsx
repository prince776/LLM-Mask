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
  const [systemPrompt, setSystemPrompt] = useState('')
  // Add more settings state here as needed
  return (
    <SettingsContext.Provider value={{ systemPrompt, setSystemPrompt }}>
      {children}
    </SettingsContext.Provider>
  )
}
