import React, { useState } from 'react'
import { RefreshCw, Lock } from 'lucide-react'

interface TransientTokenExpiredModalProps {
  onRefresh: (password: string, uploadToServer: boolean) => Promise<void>
}

export const TransientTokenExpiredModal: React.FC<TransientTokenExpiredModalProps> = ({
  onRefresh
}) => {
  const [password, setPassword] = useState('')
  const [uploadToServer, setUploadToServer] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await onRefresh(password, uploadToServer)
    } catch (err: any) {
      setError(err?.message ?? String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#1c2333] rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <RefreshCw size={18} className="text-white" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              Monthly Token Renewal
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Your session token has expired
            </p>
          </div>
        </div>

        <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed mb-5">
          Your transient access token expires each month. Enter your backup password to renew
          it and save an updated backup file.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              <Lock size={11} className="inline mr-1" />
              Backup password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40"
              required
              autoFocus
            />
          </div>

          {/* Server sync checkbox */}
          <label className="flex items-start gap-2.5 cursor-pointer select-none">
            <div className="relative flex-shrink-0 mt-0.5">
              <input
                type="checkbox"
                checked={uploadToServer}
                onChange={(e) => setUploadToServer(e.target.checked)}
                className="sr-only"
              />
              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                uploadToServer
                  ? 'bg-blue-600 border-blue-600'
                  : 'border-gray-300 dark:border-white/20'
              }`}>
                {uploadToServer && (
                  <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 12 12">
                    <path d="M10 3L5 8.5 2 5.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Also sync updated backup to server
            </p>
          </label>

          {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 text-sm font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white transition-colors shadow-lg shadow-blue-600/20"
          >
            {loading ? 'Refreshing & saving…' : 'Refresh & Save Backup'}
          </button>
        </form>
      </div>
    </div>
  )
}
