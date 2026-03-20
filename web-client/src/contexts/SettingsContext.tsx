import React, { createContext, useContext, useState, ReactNode } from 'react'

interface SettingsContextType {
  systemPrompt: string
  setSystemPrompt: (prompt: string) => void
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined)

export const useSettings = () => {
  const context = useContext(SettingsContext)
  if (!context) throw new Error('useSettings must be used within a SettingsProvider')
  return context
}

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const [systemPrompt, setSystemPromptState] = useState(
    () => localStorage.getItem('systemPrompt') || ''
  )

  const setSystemPrompt = (prompt: string) => {
    setSystemPromptState(prompt)
    localStorage.setItem('systemPrompt', prompt)
  }

  return (
    <SettingsContext.Provider value={{ systemPrompt, setSystemPrompt }}>
      {children}
    </SettingsContext.Provider>
  )
}
