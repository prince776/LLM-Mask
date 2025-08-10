import React, { useState } from 'react'
import { ArrowLeft, Moon, Sun, Bell, Shield, Download, Trash2 } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'
import { useSettings } from '../contexts/SettingsContext'

interface SettingsPageProps {
  onBack: () => void
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ onBack }) => {
  const { theme, toggleTheme } = useTheme()
  const { systemPrompt, setSystemPrompt } = useSettings()
  const [notifications, setNotifications] = useState(true)
  const [dataCollection, setDataCollection] = useState(false)
  const [autoSave, setAutoSave] = useState(true)

  const handleExportChats = () => {
    // Export chat logic
    const chats = localStorage.getItem('chats')
    if (chats) {
      const blob = new Blob([chats], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'chat-history.json'
      a.click()
    }
  }

  const handleClearAllChats = () => {
    if (confirm('Are you sure you want to delete all chats? This action cannot be undone.')) {
      localStorage.removeItem('chats')
      window.location.reload()
    }
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
        </div>

        {/* Appearance */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 mb-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Appearance</h3>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {theme === 'dark' ? (
                <Moon size={20} className="text-gray-600 dark:text-gray-400" />
              ) : (
                <Sun size={20} className="text-gray-600 dark:text-gray-400" />
              )}
              <div>
                <p className="text-gray-900 dark:text-gray-100 font-medium">Theme</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Choose your preferred theme
                </p>
              </div>
            </div>
            <button
              onClick={toggleTheme}
              className={`
                relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                ${theme === 'dark' ? 'bg-blue-600' : 'bg-gray-200'}
              `}
            >
              <span
                className={`
                  inline-block h-4 w-4 rounded-full bg-white transition-transform
                  ${theme === 'dark' ? 'translate-x-6' : 'translate-x-1'}
                `}
              />
            </button>
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 mb-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Notifications
          </h3>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bell size={20} className="text-gray-600 dark:text-gray-400" />
                <div>
                  <p className="text-gray-900 dark:text-gray-100 font-medium">Push Notifications</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Receive notifications for new messages
                  </p>
                </div>
              </div>
              <button
                onClick={() => setNotifications(!notifications)}
                className={`
                  relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                  ${notifications ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'}
                `}
              >
                <span
                  className={`
                    inline-block h-4 w-4 rounded-full bg-white transition-transform
                    ${notifications ? 'translate-x-6' : 'translate-x-1'}
                  `}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Privacy & Security */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 mb-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Privacy & Security
          </h3>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Shield size={20} className="text-gray-600 dark:text-gray-400" />
                <div>
                  <p className="text-gray-900 dark:text-gray-100 font-medium">Data Collection</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Allow anonymous usage analytics
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDataCollection(!dataCollection)}
                className={`
                  relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                  ${dataCollection ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'}
                `}
              >
                <span
                  className={`
                    inline-block h-4 w-4 rounded-full bg-white transition-transform
                    ${dataCollection ? 'translate-x-6' : 'translate-x-1'}
                  `}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Download size={20} className="text-gray-600 dark:text-gray-400" />
                <div>
                  <p className="text-gray-900 dark:text-gray-100 font-medium">Auto-save Chats</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Automatically save chat history
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAutoSave(!autoSave)}
                className={`
                  relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                  ${autoSave ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'}
                `}
              >
                <span
                  className={`
                    inline-block h-4 w-4 rounded-full bg-white transition-transform
                    ${autoSave ? 'translate-x-6' : 'translate-x-1'}
                  `}
                />
              </button>
            </div>
          </div>
        </div>

        {/* System Prompt */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 mb-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            System Prompt
          </h3>
          <textarea
            className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[80px]"
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            placeholder="Enter a system prompt to guide the assistant's behavior..."
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            This prompt will be prepended to every conversation with the assistant.
          </p>
        </div>

        {/* Data Management */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Data Management
          </h3>

          <div className="space-y-3">
            <button
              onClick={handleExportChats}
              className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <Download size={18} className="text-blue-600" />
              <div>
                <p className="text-gray-900 dark:text-gray-100 font-medium">Export Chat History</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Download all your chats as JSON
                </p>
              </div>
            </button>

            <button
              onClick={handleClearAllChats}
              className="w-full flex items-center gap-3 p-3 text-left hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            >
              <Trash2 size={18} className="text-red-600" />
              <div>
                <p className="text-red-600 font-medium">Clear All Chats</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Permanently delete all chat history
                </p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
