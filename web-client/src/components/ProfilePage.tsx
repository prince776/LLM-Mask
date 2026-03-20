import React, { useEffect, useState } from 'react'
import { ArrowLeft, Zap, Shield, Monitor } from 'lucide-react'
import { useUser } from '../contexts/UserContext'
import { fetchPfpWithCache } from '../utils/pfpCache'
import { availableModels } from '../data/models'
import { DESKTOP_DOWNLOAD_URL } from '../config'

interface ProfilePageProps {
  onBack: () => void
}

export const ProfilePage: React.FC<ProfilePageProps> = ({ onBack }) => {
  const { user, signIn, signOut } = useUser()
  const [pfpUrl, setPfpUrl] = useState<string | undefined>(undefined)

  useEffect(() => {
    let isMounted = true
    if (user?.picture) {
      fetchPfpWithCache(user.picture)
        .then((url) => { if (isMounted) setPfpUrl(url) })
        .catch(() => setPfpUrl(undefined))
    } else {
      setPfpUrl(undefined)
    }
    return () => { isMounted = false }
  }, [user?.picture])

  const userInitial = user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || '?'

  if (!user) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-gray-50 dark:bg-[#161b27]">
        <div className="max-w-sm w-full">
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-600/20">
              <Shield size={24} className="text-white" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">Sign in to LLMTor</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Purchase and manage your anonymous chat credits</p>
          </div>
          <button
            onClick={signIn}
            className="w-full flex items-center justify-center gap-3 p-3 bg-white dark:bg-white/[0.05] hover:bg-gray-50 dark:hover:bg-white/[0.08] text-gray-800 dark:text-gray-100 rounded-xl transition-colors font-medium text-sm border border-gray-200 dark:border-white/[0.08] shadow-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-5 h-5">
              <g>
                <path fill="#4285F4" d="M24 9.5c3.54 0 6.7 1.22 9.19 3.23l6.85-6.85C35.64 2.39 30.18 0 24 0 14.82 0 6.71 5.82 2.69 14.09l7.98 6.2C12.13 13.09 17.57 9.5 24 9.5z" />
                <path fill="#34A853" d="M46.1 24.55c0-1.64-.15-3.22-.42-4.74H24v9.01h12.42c-.54 2.9-2.18 5.36-4.65 7.01l7.19 5.6C43.98 37.13 46.1 31.3 46.1 24.55z" />
                <path fill="#FBBC05" d="M10.67 28.29c-1.13-3.36-1.13-6.97 0-10.33l-7.98-6.2C.7 15.13 0 19.45 0 24c0 4.55.7 8.87 2.69 12.24l7.98-6.2z" />
                <path fill="#EA4335" d="M24 48c6.18 0 11.64-2.05 15.54-5.57l-7.19-5.6c-2.01 1.35-4.59 2.15-8.35 2.15-6.43 0-11.87-3.59-14.33-8.79l-7.98 6.2C6.71 42.18 14.82 48 24 48z" />
                <path fill="none" d="M0 0h48v48H0z" />
              </g>
            </svg>
            Continue with Google
          </button>

          {/* Desktop app promo */}
          <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 rounded-xl">
            <div className="flex items-start gap-3">
              <Monitor size={16} className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">For maximum privacy</p>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5 leading-relaxed">
                  Download the{' '}
                  <a href={DESKTOP_DOWNLOAD_URL} target="_blank" rel="noopener noreferrer" className="underline font-medium hover:text-amber-900 dark:hover:text-amber-200">
                    desktop app
                  </a>{' '}
                  — it routes all requests through Tor for full IP anonymity.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-[#161b27]">
      <div className="max-w-2xl mx-auto p-6">
        <div className="flex items-center gap-3 mb-7">
          <button onClick={onBack} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors">
            <ArrowLeft size={18} className="text-gray-500 dark:text-gray-400" />
          </button>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Profile</h1>
        </div>

        <div className="bg-white dark:bg-white/[0.04] rounded-2xl p-6 mb-4 border border-gray-100 dark:border-white/[0.06]">
          <div className="flex items-center gap-5">
            <div className="relative flex-shrink-0">
              {user.picture && pfpUrl ? (
                <img src={pfpUrl} alt="Profile" className="w-16 h-16 rounded-2xl object-cover ring-2 ring-blue-600/30" />
              ) : (
                <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-xl font-bold text-white shadow shadow-blue-600/30">
                  {userInitial}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white truncate">{user.name}</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 truncate mt-0.5">{user.email}</p>
            </div>
            <button
              onClick={signOut}
              className="px-4 py-2 text-sm bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 rounded-xl transition-colors border border-red-100 dark:border-red-500/20 font-medium flex-shrink-0"
            >
              Sign Out
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-white/[0.04] rounded-2xl p-6 mb-4 border border-gray-100 dark:border-white/[0.06]">
          <div className="flex items-center gap-2 mb-5">
            <Zap size={16} className="text-yellow-500" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide">Available Credits</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {availableModels.map((model) => (
              <div key={model.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-white/[0.03] rounded-xl border border-gray-100 dark:border-white/[0.05]">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-gray-800 dark:text-gray-100 truncate">{model.name}</p>
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">{model.provider}</p>
                </div>
                <div className="text-right flex-shrink-0 ml-3">
                  <p className="text-xl font-bold text-blue-600 dark:text-blue-400 leading-none">{user.numActiveToken?.[model.id] ?? 0}</p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">credits</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Desktop app promo */}
        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-2xl p-5 border border-amber-200 dark:border-amber-700/40">
          <div className="flex items-start gap-3">
            <Monitor size={18} className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-300">Upgrade to full privacy</h3>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-1 leading-relaxed">
                The web client does not route through Tor. Your IP address is visible to the proxy. For complete anonymity, use the{' '}
                <a href={DESKTOP_DOWNLOAD_URL} target="_blank" rel="noopener noreferrer" className="font-semibold underline hover:text-amber-900 dark:hover:text-amber-200">
                  desktop app
                </a>{' '}
                which bundles Tor natively.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
