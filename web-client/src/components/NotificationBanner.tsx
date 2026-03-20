import { X } from 'lucide-react'

interface NotificationBannerProps {
  message: string
  onDismiss: () => void
  label?: string
  variant?: 'global' | 'user'
}

export function NotificationBanner({ message, onDismiss, label, variant = 'global' }: NotificationBannerProps) {
  const isUser = variant === 'user'
  return (
    <div
      className={`flex items-center gap-3 px-4 py-2.5 text-sm ${
        isUser
          ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-900 dark:text-amber-200 border-b border-amber-200 dark:border-amber-700/50'
          : 'bg-blue-50 dark:bg-blue-900/30 text-blue-900 dark:text-blue-200 border-b border-blue-200 dark:border-blue-700/50'
      }`}
    >
      {label && (
        <span
          className={`shrink-0 font-semibold text-xs uppercase tracking-wide px-1.5 py-0.5 rounded ${
            isUser
              ? 'bg-amber-200 dark:bg-amber-700 text-amber-800 dark:text-amber-100'
              : 'bg-blue-200 dark:bg-blue-700 text-blue-800 dark:text-blue-100'
          }`}
        >
          {label}
        </span>
      )}
      <span className="flex-1">{message}</span>
      <button
        onClick={onDismiss}
        className={`shrink-0 p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors ${
          isUser ? 'text-amber-700 dark:text-amber-300' : 'text-blue-700 dark:text-blue-300'
        }`}
        aria-label="Dismiss notification"
      >
        <X size={14} />
      </button>
    </div>
  )
}
