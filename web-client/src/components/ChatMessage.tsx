import React, { useEffect, useState } from 'react'
import { useUser } from '../contexts/UserContext'
import { Message } from '../types'
import { Shield } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { fetchPfpWithCache } from '../utils/pfpCache'

interface ChatMessageProps {
  message: Message
  isLastAssistant?: boolean
  onRegenerate?: () => void
  onEdit?: (newContent: string) => void
  onDelete?: () => void
}

export const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  isLastAssistant,
  onRegenerate,
  onEdit,
  onDelete
}) => {
  const isUser = message.role === 'user'
  const { user } = useUser()
  const [pfpUrl, setPfpUrl] = useState<string | undefined>(undefined)
  const [showTooltip, setShowTooltip] = useState(false)
  const [copied, setCopied] = useState(false)
  const [isEditingMessage, setIsEditingMessage] = useState(false)
  const [editedContent, setEditedContent] = useState(message.content)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const userInitial = user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || '?'

  useEffect(() => {
    let isMounted = true
    if (isUser && user?.picture) {
      fetchPfpWithCache(user.picture)
        .then((url) => { if (isMounted) setPfpUrl(url) })
        .catch(() => setPfpUrl(undefined))
    } else {
      setPfpUrl(undefined)
    }
    return () => { isMounted = false }
  }, [isUser, user?.picture])

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }

  const handleSaveEdit = () => {
    if (editedContent.trim() && editedContent !== message.content && onEdit) {
      onEdit(editedContent.trim())
    }
    setIsEditingMessage(false)
  }

  return (
    <div
      className={`group flex gap-3 px-5 py-4 transition-colors ${
        isUser
          ? 'bg-transparent hover:bg-gray-50/50 dark:hover:bg-white/[0.02]'
          : 'bg-gray-50/80 dark:bg-white/[0.03] hover:bg-gray-50 dark:hover:bg-white/[0.04]'
      }`}
    >
      {/* Avatar */}
      <div className="flex-shrink-0 mt-0.5">
        {isUser ? (
          user?.picture && pfpUrl ? (
            <img src={pfpUrl} alt="User avatar" className="w-7 h-7 rounded-full object-cover ring-1 ring-gray-200 dark:ring-white/10" />
          ) : (
            <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-[11px] font-bold text-white">
              {userInitial}
            </div>
          )
        ) : (
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shadow shadow-blue-600/20">
            <Shield size={13} className="text-white" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 mb-1.5 uppercase tracking-wide">
          {isUser ? (user?.name?.split(' ')[0] || 'You') : 'LLMTor'}
        </p>

        {isEditingMessage ? (
          <div className="mb-3">
            <textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              className="w-full p-3 rounded-xl border border-blue-500/50 dark:border-blue-400/30 bg-white dark:bg-white/5 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-sm resize-none"
              rows={4}
              autoFocus
            />
            <div className="flex gap-2 mt-2">
              <button className="px-3 py-1.5 text-xs rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors font-medium" onClick={handleSaveEdit}>Save</button>
              <button
                className="px-3 py-1.5 text-xs rounded-lg bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors font-medium"
                onClick={() => { setIsEditingMessage(false); setEditedContent(message.content) }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="prose prose-sm max-w-full dark:prose-invert break-words">
              <ReactMarkdown
                remarkPlugins={[remarkMath]}
                rehypePlugins={[rehypeKatex]}
                urlTransform={(url) => url}
                components={{
                  pre({ children }) { return <>{children}</> },
                  code({ className, children }) {
                    const match = /language-(\w+)/.exec(className || '')
                    if (match) {
                      return (
                        <div className="not-prose rounded-xl overflow-hidden my-3 border border-gray-200 dark:border-white/[0.08] shadow-sm">
                          <div className="flex items-center px-4 py-1.5 bg-gray-50 dark:bg-[#1e2535] border-b border-gray-200 dark:border-white/[0.06]">
                            <span className="text-[10px] font-mono font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">{match[1]}</span>
                          </div>
                          <SyntaxHighlighter
                            style={oneDark}
                            language={match[1]}
                            PreTag="div"
                            customStyle={{ margin: 0, borderRadius: 0, fontSize: '0.8125rem', lineHeight: '1.6', padding: '1rem 1.25rem' }}
                          >
                            {String(children).replace(/\n$/, '')}
                          </SyntaxHighlighter>
                        </div>
                      )
                    }
                    return <code className={className}>{children}</code>
                  },
                  img({ src, alt }) {
                    if (!src) return null
                    return <img src={src} alt={alt || 'image'} className="rounded-xl border border-gray-200 dark:border-white/10 block my-2 object-contain max-w-sm max-h-64" />
                  }
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="relative">
                <button
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  title="Copy message"
                  onClick={handleCopy}
                  onMouseEnter={() => setShowTooltip(true)}
                  onMouseLeave={() => setShowTooltip(false)}
                >
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="8" height="8" rx="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v1" />
                  </svg>
                </button>
                {(showTooltip || copied) && (
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 px-2 py-1 text-[11px] rounded-lg bg-gray-900 dark:bg-white/90 text-white dark:text-gray-900 whitespace-nowrap z-10 shadow-lg font-medium">
                    {copied ? 'Copied!' : 'Copy'}
                  </div>
                )}
              </div>

              {isUser && onEdit && !isEditingMessage && (
                <button
                  className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-500/10 text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  title="Edit message"
                  onClick={() => setIsEditingMessage(true)}
                >
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2l2 2-8 8-2 2H2v-2l2-2 8-8z" />
                  </svg>
                </button>
              )}

              {onDelete && !isEditingMessage && (
                <button
                  className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                  title="Delete message"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              )}

              {isLastAssistant && onRegenerate && (
                <button
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-500/10 text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors text-[12px] font-medium"
                  title="Regenerate response"
                  onClick={onRegenerate}
                >
                  <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 4v4a4 4 0 0 0 4 4h6" />
                    <polyline points="15 9 15 5 11 5" />
                  </svg>
                  Regenerate
                </button>
              )}

              <span className="ml-auto text-[11px] text-gray-300 dark:text-gray-600">
                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </>
        )}

        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="bg-white dark:bg-[#1e2535] rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4 border border-gray-100 dark:border-white/[0.08]">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">Delete message?</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">This action cannot be undone.</p>
              <div className="flex gap-2 justify-end">
                <button className="px-4 py-2 text-sm rounded-xl bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors font-medium" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
                <button className="px-4 py-2 text-sm rounded-xl bg-red-600 text-white hover:bg-red-700 transition-colors font-medium" onClick={() => { onDelete?.(); setShowDeleteConfirm(false) }}>Delete</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
