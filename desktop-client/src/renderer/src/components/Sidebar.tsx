import React from 'react'
import { Plus, Trash2, Settings, User, X, CreditCard, MessageSquare } from 'lucide-react'
import { Chat } from '../types'
import logo from '../assets/logo-llmtor.svg'

interface SidebarProps {
  chats: Chat[]
  activeChat: string | null
  onChatSelect: (chatId: string) => void
  onNewChat: () => void
  onDeleteChat: (chatId: string) => void
  onSettingsClick: () => void
  onProfileClick: () => void
  onPurchaseTokensClick: () => void
  onSignInClick: () => void
  user: any
  isOpen: boolean
  onToggle: () => void
}

export const Sidebar: React.FC<SidebarProps> = ({
  chats,
  activeChat,
  onChatSelect,
  onNewChat,
  onDeleteChat,
  onSettingsClick,
  onProfileClick,
  onPurchaseTokensClick,
  onSignInClick,
  user,
  isOpen,
  onToggle
}) => {
  const formatDate = (date: Date) => {
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - date.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays === 1) return 'Today'
    if (diffDays === 2) return 'Yesterday'
    if (diffDays <= 7) return `${diffDays - 1}d ago`
    return date.toLocaleDateString()
  }

  const userInitial = user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || '?'

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm"
          onClick={onToggle}
        />
      )}

      {/* Sidebar — always dark */}
      <div
        className={`
          fixed lg:relative top-0 left-0 h-full w-64 bg-[#0f1117]
          flex flex-col z-50 border-r border-white/[0.06]
          transform transition-transform duration-300 ease-in-out lg:translate-x-0
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Header */}
        <div className="flex-shrink-0 px-3 pt-4 pb-3 border-b border-white/[0.06]">
          {/* Brand row */}
          <div className="flex items-center gap-2 px-1 mb-3">
            <div className="w-6 h-6 rounded-md overflow-hidden flex-shrink-0">
              <img src={logo} alt="LLMTor" className="w-full h-full" />
            </div>
            <span className="text-sm font-semibold text-white tracking-tight">LLMTor</span>
            <div className="ml-auto flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-widest">
                TOR
              </span>
            </div>
            <button
              onClick={onToggle}
              className="lg:hidden ml-1 p-0.5 rounded text-gray-500 hover:text-gray-300 transition-colors"
            >
              <X size={15} />
            </button>
          </div>

          {/* New Chat button */}
          <button
            onClick={onNewChat}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-gray-200 text-sm font-medium transition-all duration-150 border border-white/[0.06] hover:border-white/[0.1] group"
          >
            <Plus size={15} className="text-blue-400 group-hover:text-blue-300 transition-colors" />
            New Chat
          </button>
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto py-2 px-2 scrollbar-hide">
          {chats.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-28 text-gray-600 text-xs text-center px-6 mt-4">
              <MessageSquare size={18} className="mb-2 opacity-40" />
              <p className="leading-relaxed">No chats yet. Start a new conversation above.</p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {chats.map((chat) => (
                <div
                  key={chat.id}
                  className={`
                    group relative flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-150
                    ${
                      activeChat === chat.id
                        ? 'bg-white/10 text-white'
                        : 'text-gray-500 hover:bg-white/[0.05] hover:text-gray-300'
                    }
                  `}
                  onClick={() => onChatSelect(chat.id)}
                >
                  <div className="flex-1 min-w-0 pr-1">
                    <p
                      className={`text-[13px] font-medium truncate leading-snug ${activeChat === chat.id ? 'text-gray-100' : ''}`}
                    >
                      {chat.title}
                    </p>
                    <p className="text-[11px] mt-0.5 text-gray-600">{formatDate(chat.updatedAt)}</p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onDeleteChat(chat.id)
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/20 transition-all flex-shrink-0"
                  >
                    <Trash2 size={12} className="text-red-400" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Nav */}
        <div className="flex-shrink-0 px-2 py-3 border-t border-white/[0.06] space-y-0.5">
          {user ? (
            <button
              onClick={onProfileClick}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-gray-500 hover:bg-white/[0.05] hover:text-gray-300 transition-colors text-left group"
            >
              <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-white">
                {userInitial}
              </div>
              <span className="text-[13px] truncate">{user.name || user.email || 'Profile'}</span>
            </button>
          ) : (
            <button
              onClick={onSignInClick}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-gray-500 hover:bg-white/[0.05] hover:text-gray-300 transition-colors text-left"
            >
              <User size={15} className="flex-shrink-0" />
              <span className="text-[13px]">Sign In</span>
            </button>
          )}
          <button
            onClick={onPurchaseTokensClick}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-gray-500 hover:bg-white/[0.05] hover:text-gray-300 transition-colors text-left"
          >
            <CreditCard size={15} className="flex-shrink-0" />
            <span className="text-[13px]">Purchase Credits</span>
          </button>
          <button
            onClick={onSettingsClick}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-gray-500 hover:bg-white/[0.05] hover:text-gray-300 transition-colors text-left"
          >
            <Settings size={15} className="flex-shrink-0" />
            <span className="text-[13px]">Settings</span>
          </button>
        </div>
      </div>
    </>
  )
}
