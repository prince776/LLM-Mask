import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react'
import { AlertTriangle, X } from 'lucide-react'

interface ErrorContextType {
  showError: (message: string, consoleMsg?: any) => void
}

const ErrorContext = createContext<ErrorContextType | undefined>(undefined)

export const useError = () => {
  const context = useContext(ErrorContext)
  if (!context) throw new Error('useError must be used within an ErrorProvider')
  return context
}

export const ErrorProvider = ({ children }: { children: ReactNode }) => {
  const [error, setError] = useState<string | null>(null)
  const timerRef = useRef<number | null>(null)

  const showError = useCallback((message: string, consoleMsg?: any) => {
    setError(message)
    console.error(message, 'extra:', consoleMsg)
    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      setError(null)
      timerRef.current = null
    }, 4000)
  }, [])

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
    }
  }, [])

  const dismiss = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setError(null)
  }

  return (
    <ErrorContext.Provider value={{ showError }}>
      {children}
      {error && <ErrorCard message={error} onDismiss={dismiss} />}
    </ErrorContext.Provider>
  )
}

const ErrorCard = ({ message, onDismiss }: { message: string; onDismiss: () => void }) => (
  <div
    className="fixed bottom-6 right-6 z-[9999] w-[min(30rem,calc(100vw-3rem))] rounded-xl border border-red-200 bg-red-50/95 p-3 shadow-lg backdrop-blur dark:border-red-500/30 dark:bg-red-500/10"
    role="alert"
    aria-live="assertive"
  >
    <div className="flex items-start gap-2">
      <div className="mt-0.5 rounded-md bg-red-100 p-1 text-red-700 dark:bg-red-500/20 dark:text-red-300">
        <AlertTriangle size={14} />
      </div>
      <p className="flex-1 text-sm font-medium text-red-800 dark:text-red-200">{message}</p>
      <button
        onClick={onDismiss}
        className="rounded-md p-1 text-red-700 transition-colors hover:bg-red-100 dark:text-red-300 dark:hover:bg-red-500/20"
        aria-label="Close error"
      >
        <X size={14} />
      </button>
    </div>
  </div>
)
