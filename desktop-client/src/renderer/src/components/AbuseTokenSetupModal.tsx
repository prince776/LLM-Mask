import React, { useState } from 'react'
import { Shield, Lock, AlertTriangle, Server, FolderOpen } from 'lucide-react'

interface AbuseTokenSetupModalProps {
  onSetup: (password: string, uploadToServer: boolean) => Promise<void>
  onRestoreFromFile: (password: string) => Promise<void>
  onRestoreFromServer: (password: string) => Promise<void>
}

type Mode = 'setup' | 'restore-file' | 'restore-server'

export const AbuseTokenSetupModal: React.FC<AbuseTokenSetupModalProps> = ({
  onSetup,
  onRestoreFromFile,
  onRestoreFromServer
}) => {
  const [mode, setMode] = useState<Mode>('setup')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [uploadToServer, setUploadToServer] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = (newMode: Mode) => {
    setMode(newMode)
    setPassword('')
    setConfirm('')
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (mode === 'setup') {
      if (password !== confirm) { setError('Passwords do not match.'); return }
      if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    }
    if (!password) { setError('Password is required.'); return }

    setLoading(true)
    try {
      if (mode === 'setup') {
        await onSetup(password, uploadToServer)
      } else if (mode === 'restore-file') {
        await onRestoreFromFile(password)
      } else {
        await onRestoreFromServer(password)
      }
    } catch (err: any) {
      setError(err?.message ?? String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#1c2333] rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/20">
            <Shield size={18} className="text-white" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              Anonymous Access Setup
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">One-time setup required</p>
          </div>
        </div>

        {/* Warning (setup only) */}
        {mode === 'setup' && (
          <div className="flex gap-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 rounded-xl p-3.5 mb-5">
            <AlertTriangle size={15} className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
              Your backup file will be saved to your device. Store it safely — you'll need it
              to restore access on a new device or after reinstalling.
            </p>
          </div>
        )}

        {/* Mode tabs */}
        <div className="flex gap-1 p-1 bg-gray-100 dark:bg-white/5 rounded-xl mb-5">
          {([
            { id: 'setup', label: 'New Setup' },
            { id: 'restore-file', label: 'From File', icon: <FolderOpen size={11} className="inline mr-1" /> },
            { id: 'restore-server', label: 'From Server', icon: <Server size={11} className="inline mr-1" /> }
          ] as { id: Mode; label: string; icon?: React.ReactNode }[]).map(({ id, label, icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => reset(id)}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                mode === id
                  ? 'bg-white dark:bg-white/10 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {icon}{label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Password */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              <Lock size={11} className="inline mr-1" />
              {mode === 'setup' ? 'Create backup password' : 'Enter your backup password'}
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

          {/* Confirm (setup only) */}
          {mode === 'setup' && (
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Confirm password
              </label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40"
                required
              />
            </div>
          )}

          {/* Server sync checkbox (setup only) */}
          {mode === 'setup' && (
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
              <div>
                <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  Also sync encrypted backup to server
                </p>
                <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                  Encrypted with your password before upload. Enables "Restore from Server" on new devices.
                </p>
              </div>
            </label>
          )}

          {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 text-sm font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white transition-colors shadow-lg shadow-blue-600/20"
          >
            {loading ? (
              mode === 'setup' ? 'Generating & saving…' : 'Restoring…'
            ) : (
              mode === 'setup' ? 'Generate & Save Backup' :
              mode === 'restore-file' ? 'Open Backup File…' :
              'Restore from Server'
            )}
          </button>
        </form>

        {mode === 'setup' && (
          <p className="text-[11px] text-gray-400 dark:text-gray-500 text-center mt-4 leading-relaxed">
            Your backup file will be saved locally. The server never sees your unblinded tokens.
          </p>
        )}
        {mode === 'restore-server' && (
          <p className="text-[11px] text-gray-400 dark:text-gray-500 text-center mt-4 leading-relaxed">
            Only works if you previously enabled "sync to server" during setup.
          </p>
        )}
      </div>
    </div>
  )
}
