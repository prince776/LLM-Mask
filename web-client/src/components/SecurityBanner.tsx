import { AlertTriangle, Monitor } from 'lucide-react'
import { DESKTOP_DOWNLOAD_URL } from '../config'

export function SecurityBanner() {
  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-700/50 text-amber-900 dark:text-amber-200 text-xs">
      <AlertTriangle size={13} className="shrink-0 text-amber-600 dark:text-amber-400" />
      <span className="flex-1">
        <strong className="font-semibold">Web client:</strong> Requests are sent over a regular internet connection — your IP is visible to the proxy. For full Tor-based privacy, use the{' '}
        <a
          href={DESKTOP_DOWNLOAD_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-semibold underline underline-offset-2 hover:text-amber-700 dark:hover:text-amber-100 transition-colors"
        >
          <Monitor size={11} />
          desktop app
        </a>
        .
      </span>
    </div>
  )
}
