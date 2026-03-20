import React, { useState } from 'react'
import { ArrowLeft, Moon, Sun, Download, Trash2, Upload, RefreshCw, Monitor } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'
import { useSettings } from '../contexts/SettingsContext'
import { TransientTokenExpiredModal } from './TransientTokenExpiredModal'
import { Chat } from '../types'
import { refreshTransientToken } from '../api/abuse-token'
import { DESKTOP_DOWNLOAD_URL } from '../config'

interface SettingsPageProps {
  onBack: () => void
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ onBack }) => {
  const { theme, toggleTheme } = useTheme()
  const { systemPrompt, setSystemPrompt } = useSettings()
  const [showRotateModal, setShowRotateModal] = useState(false)

  const handleRotateToken = async (password: string, uploadToServer: boolean) => {
    await refreshTransientToken(password, uploadToServer)
    setShowRotateModal(false)
  }

  const handleExportChats = () => {
    const chats = localStorage.getItem('chats')
    if (chats) {
      const blob = new Blob([chats], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'chat-history.json'
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  const handleClearAllChats = () => {
    if (confirm('Are you sure you want to delete all chats? This action cannot be undone.')) {
      localStorage.removeItem('chats')
      window.location.reload()
    }
  }

  const handleImportChats = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const importedChats: Chat[] = JSON.parse(text)
      importedChats.forEach((chat) => { chat.id = Date.now().toString() + chat.id })
      const existing = JSON.parse(localStorage.getItem('chats') || '[]')
      localStorage.setItem('chats', JSON.stringify([...existing, ...importedChats]))
      alert('Chats imported successfully!')
      window.location.reload()
    } catch {
      alert('Failed to import chats: Invalid file or format.')
    }
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-[#161b27]">
      {showRotateModal && (
        <TransientTokenExpiredModal onRefresh={handleRotateToken} onClose={() => setShowRotateModal(false)} />
      )}
      <div className="max-w-2xl mx-auto p-6">
        <div className="flex items-center gap-3 mb-7">
          <button onClick={onBack} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors">
            <ArrowLeft size={18} className="text-gray-500 dark:text-gray-400" />
          </button>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Settings</h1>
        </div>

        {/* Privacy notice */}
        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-2xl p-5 mb-4 border border-amber-200 dark:border-amber-700/40">
          <div className="flex items-start gap-3">
            <Monitor size={16} className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-xs font-semibold text-amber-800 dark:text-amber-300 uppercase tracking-wide">Web Client Limitation</h3>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-1 leading-relaxed">
                This web client sends requests over a regular internet connection. Your IP address is visible to the proxy. For full Tor-based anonymity, use the{' '}
                <a href={DESKTOP_DOWNLOAD_URL} target="_blank" rel="noopener noreferrer" className="font-semibold underline hover:text-amber-900 dark:hover:text-amber-200">
                  desktop app
                </a>.
              </p>
            </div>
          </div>
        </div>

        {/* Appearance */}
        <div className="bg-white dark:bg-white/[0.04] rounded-2xl p-5 mb-4 border border-gray-100 dark:border-white/[0.06]">
          <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4">Appearance</h3>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-white/5 flex items-center justify-center">
                {theme === 'dark' ? <Moon size={15} className="text-gray-500 dark:text-gray-400" /> : <Sun size={15} className="text-gray-500 dark:text-gray-400" />}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-100">Theme</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{theme === 'dark' ? 'Dark mode' : 'Light mode'}</p>
              </div>
            </div>
            <button
              onClick={toggleTheme}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 ${theme === 'dark' ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'}`}
            >
              <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-200 ${theme === 'dark' ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </button>
          </div>
        </div>

        {/* System Prompt */}
        <div className="bg-white dark:bg-white/[0.04] rounded-2xl p-5 mb-4 border border-gray-100 dark:border-white/[0.06]">
          <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4">System Prompt</h3>
          <textarea
            className="w-full p-3 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.03] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50 text-sm leading-relaxed min-h-[90px] resize-none transition-all"
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            placeholder="Enter a system prompt to guide the assistant's behavior..."
          />
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">Prepended to every conversation as a system message.</p>
        </div>

        {/* Security */}
        <div className="bg-white dark:bg-white/[0.04] rounded-2xl p-5 mb-4 border border-gray-100 dark:border-white/[0.06]">
          <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4">Security</h3>
          <button
            onClick={() => setShowRotateModal(true)}
            className="w-full flex items-center gap-3 px-3 py-3 text-left hover:bg-gray-50 dark:hover:bg-white/[0.04] rounded-xl transition-colors group"
          >
            <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center flex-shrink-0">
              <RefreshCw size={14} className="text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-800 dark:text-gray-100">Rotate Monthly Token</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Issue a new anonymous token if you suspect your current one was compromised</p>
            </div>
          </button>
        </div>

        {/* Data Management */}
        <div className="bg-white dark:bg-white/[0.04] rounded-2xl p-5 border border-gray-100 dark:border-white/[0.06]">
          <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4">Data Management</h3>
          <div className="space-y-1">
            <button
              onClick={handleExportChats}
              className="w-full flex items-center gap-3 px-3 py-3 text-left hover:bg-gray-50 dark:hover:bg-white/[0.04] rounded-xl transition-colors group"
            >
              <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                <Download size={14} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-100">Export Chat History</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Download all chats as JSON</p>
              </div>
            </button>

            <label className="w-full flex items-center gap-3 px-3 py-3 text-left hover:bg-gray-50 dark:hover:bg-white/[0.04] rounded-xl transition-colors cursor-pointer">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                <Upload size={14} className="text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Import Chats</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Append chats from a JSON file</p>
              </div>
              <input type="file" accept="application/json" className="hidden" onChange={handleImportChats} />
            </label>

            <button
              onClick={handleClearAllChats}
              className="w-full flex items-center gap-3 px-3 py-3 text-left hover:bg-red-50 dark:hover:bg-red-500/[0.08] rounded-xl transition-colors group"
            >
              <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-500/10 flex items-center justify-center flex-shrink-0">
                <Trash2 size={14} className="text-red-500 dark:text-red-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-red-600 dark:text-red-400">Clear All Chats</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Permanently delete all chat history</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
