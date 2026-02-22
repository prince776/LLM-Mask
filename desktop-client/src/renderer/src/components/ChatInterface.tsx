import React, { useState, useRef, useEffect } from 'react'
import { Menu, Shield } from 'lucide-react'
import { ChatMessage } from './ChatMessage'
import { ChatInput } from './ChatInput'
import { ModelSelector } from './ModelSelector'
import { AbuseTokenSetupModal } from './AbuseTokenSetupModal'
import { TransientTokenExpiredModal } from './TransientTokenExpiredModal'
import { Chat, Message } from '../types'
import { useError } from '@renderer/contexts/ErrorContext'
import { LLMProxyReq, LLMProxyResp } from '../../../types/ipc'
import { useSettings } from '../contexts/SettingsContext'
import { useUser } from '../contexts/UserContext'

interface ChatInterfaceProps {
  chat: Chat | undefined
  onSendMessage: (message: string, role: 'user' | 'assistant') => void
  onToggleSidebar: () => void
  onEditChatTitle?: (chatId: string, newTitle: string) => void
  onEditMessage?: (messageId: string, newContent: string) => void
  onDeleteMessage?: (messageId: string) => void
}

interface LoadingState {
  isLoading: boolean
  message: string
}

interface ImageAttachment {
  dataUrl: string
  name: string
  mime: string
  size: number
}

function toOpenAIContentFromMarkdown(md: string): Array<any> | string {
  const regex = /!\[[^\]]*\]\(([^\)]+)\)/g
  const imageUrls: string[] = []
  let match
  while ((match = regex.exec(md)) !== null) {
    const url = match[1]
    if (url.startsWith('data:image/')) imageUrls.push(url)
  }
  const textOnly = md.replace(regex, '').trim()

  if (imageUrls.length === 0) {
    return md
  }

  const parts: any[] = []
  if (textOnly) parts.push({ type: 'text', text: textOnly })
  for (const url of imageUrls) {
    parts.push({ type: 'image_url', image_url: { url } })
  }
  return parts
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  chat,
  onSendMessage,
  onToggleSidebar,
  onEditChatTitle,
  onEditMessage,
  onDeleteMessage
}) => {
  const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash')
  const [loadingState, setLoadingState] = useState<LoadingState>({ isLoading: false, message: '' })
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { systemPrompt } = useSettings()
  const { showError } = useError()
  const { user, decrementToken } = useUser()
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [editedTitle, setEditedTitle] = useState(chat?.title || '')

  // Abuse token modal state
  const [showAbuseSetup, setShowAbuseSetup] = useState(false)
  const [showTransientExpired, setShowTransientExpired] = useState(false)
  // Pending message to send after token setup
  const pendingMessageRef = useRef<Parameters<typeof handleSendMessage>[0] | null>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [chat?.messages])

  useEffect(() => {
    setEditedTitle(chat?.title || '')
  }, [chat?.title])

  const resumePending = async () => {
    if (pendingMessageRef.current) {
      const msg = pendingMessageRef.current
      pendingMessageRef.current = null
      await handleSendMessage(msg)
    }
  }

  const handleAbuseSetup = async (password: string, uploadToServer: boolean) => {
    const resp = await window.api.setupAbuseTokens({ password, uploadToServer })
    if (resp.error) throw new Error(resp.error)
    setShowAbuseSetup(false)
    await resumePending()
  }

  const handleAbuseRestoreFromFile = async (password: string) => {
    const resp = await window.api.restoreAbuseTokenBackup({ password, source: 'file' })
    if (resp.error) throw new Error(resp.error)
    setShowAbuseSetup(false)
    await resumePending()
  }

  const handleAbuseRestoreFromServer = async (password: string) => {
    const resp = await window.api.restoreAbuseTokenBackup({ password, source: 'server' })
    if (resp.error) throw new Error(resp.error)
    setShowAbuseSetup(false)
    await resumePending()
  }

  const handleTransientRefresh = async (password: string, uploadToServer: boolean) => {
    const resp = await window.api.refreshTransientAbuseToken({ password, uploadToServer })
    if (resp.error) throw new Error(resp.error)
    setShowTransientExpired(false)
    await resumePending()
  }

  const handleSendMessage = async (payload: {
    text: string
    images?: ImageAttachment[]
    displayText?: string
  }) => {
    try {
      // Check abuse token status before proceeding
      const abuseStatus = await window.api.getAbuseTokenStatus()
      if (!abuseStatus.hasTokens) {
        pendingMessageRef.current = payload
        setShowAbuseSetup(true)
        return
      }
      if (abuseStatus.transientExpired) {
        pendingMessageRef.current = payload
        setShowTransientExpired(true)
        return
      }

      const displayText = payload.displayText ?? payload.text
      onSendMessage(displayText, 'user')

      setLoadingState({ isLoading: true, message: 'Generating anonymous token...' })
      const blindedToken = await window.api.generateToken({
        modelName: selectedModel
      })
      if (blindedToken.error) {
        throw blindedToken.error
      }

      decrementToken(selectedModel)

      setLoadingState({ isLoading: true, message: 'Routing through Tor...' })

      const historyMessages = [
        ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
        ...((chat?.messages ?? []) as Message[])
      ]

      const mappedHistory = historyMessages.map((m: any) => {
        const role = m.role
        const content =
          typeof m.content === 'string' ? toOpenAIContentFromMarkdown(m.content) : m.content
        return { role, content }
      })

      const currentUserContentParts: any[] = []
      if (payload.text && payload.text.trim()) {
        currentUserContentParts.push({ type: 'text', text: payload.text.trim() })
      }
      if (payload.images && payload.images.length) {
        for (const img of payload.images) {
          currentUserContentParts.push({ type: 'image_url', image_url: { url: img.dataUrl } })
        }
      }

      const allMessages = [
        ...mappedHistory,
        {
          role: 'user',
          content: currentUserContentParts.length ? currentUserContentParts : payload.text
        }
      ]

      const llmsProxyReq: LLMProxyReq = {
        token: blindedToken.token || '',
        signedToken: blindedToken.signedToken || '',
        modelName: selectedModel,
        messages: allMessages as any
      }

      const llmResp: LLMProxyResp = await window.api.llmProxy(llmsProxyReq)
      if (llmResp.abuseTokenExpired) {
        pendingMessageRef.current = payload
        setShowTransientExpired(true)
        return
      }
      if (llmResp.abuseTokenInvalid || llmResp.abuseTokenBlacklisted) {
        showError(
          llmResp.abuseTokenBlacklisted
            ? 'Your anonymous access has been suspended. Please contact support.'
            : 'Anonymous access token invalid. Please contact support.'
        )
        return
      }
      if (llmResp.blocked) {
        showError(`Request Blocked: ${llmResp.blockReason ?? 'Unknown reason'}`)
        return
      }
      if (llmResp.sizeLimitExceeded) {
        console.log('GOT SIZE LIMIT EXCEEDED')
        let err = llmResp.sizeLimitReason
        if (!err) {
          err = `Chat size limit exceeded: Please start a new conversation to continue`
        }
        throw err
      }
      if (llmResp.error || !llmResp.data) {
        throw llmResp.error
      }

      const aiMsg = llmResp.data.choices[0].message.content as unknown as string
      onSendMessage(aiMsg, 'assistant')
    } catch (e) {
      console.log('Catching err e', e)
      showError(`Error generating chat response, err: ${JSON.stringify(e)}`, e)
    } finally {
      setLoadingState({ isLoading: false, message: '' })
    }
  }

  const handleRegenerateResponse = async () => {
    if (!chat || chat.messages.length === 0) return
    const lastUserMsgIdx = [...chat.messages].map((m) => m.role).lastIndexOf('user')
    if (lastUserMsgIdx === -1) return
    const lastUserMsg = chat.messages[lastUserMsgIdx]
    const newMessages = chat.messages.slice(0, lastUserMsgIdx)
    if (chat) {
      chat.messages = newMessages
    }

    const regex = /!\[[^\]]*\]\(([^\)]+)\)/g
    const images: ImageAttachment[] = []
    let match
    while ((match = regex.exec(lastUserMsg.content)) !== null) {
      const url = match[1]
      if (url.startsWith('data:image/')) {
        images.push({ dataUrl: url, name: 'image', mime: 'image/*', size: 0 })
      }
    }
    const textOnly = lastUserMsg.content.replace(regex, '').trim()

    await handleSendMessage({ text: textOnly, images, displayText: lastUserMsg.content })
  }

  const handleTitleSave = () => {
    if (chat && editedTitle.trim() && editedTitle !== chat.title) {
      if (onEditChatTitle) {
        onEditChatTitle(chat.id, editedTitle.trim())
      }
      setIsEditingTitle(false)
    } else {
      setIsEditingTitle(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#161b27]">
      {showAbuseSetup && (
        <AbuseTokenSetupModal
          onSetup={handleAbuseSetup}
          onRestoreFromFile={handleAbuseRestoreFromFile}
          onRestoreFromServer={handleAbuseRestoreFromServer}
        />
      )}
      {showTransientExpired && (
        <TransientTokenExpiredModal onRefresh={handleTransientRefresh} />
      )}
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-white/[0.06] bg-white dark:bg-[#161b27]">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onToggleSidebar}
            className="lg:hidden p-1.5 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors"
          >
            <Menu size={18} className="text-gray-500 dark:text-gray-400" />
          </button>
          <div className="min-w-0">
            {isEditingTitle ? (
              <div className="flex items-center gap-2">
                <input
                  className="text-sm font-semibold px-2 py-1 rounded-lg bg-gray-100 dark:bg-white/5 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 border border-transparent focus:border-blue-500/30"
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  autoFocus
                />
                <button
                  className="px-2.5 py-1 text-xs rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors font-medium"
                  onClick={handleTitleSave}
                >
                  Save
                </button>
                <button
                  className="px-2.5 py-1 text-xs rounded-lg bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors font-medium"
                  onClick={() => {
                    setIsEditingTitle(false)
                    setEditedTitle(chat?.title || '')
                  }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">
                  {chat?.title || 'New Conversation'}
                </h1>
                {chat && (
                  <button
                    className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-white/5 transition-colors opacity-0 group-hover:opacity-100"
                    onClick={() => setIsEditingTitle(true)}
                    title="Edit chat title"
                  >
                    <svg
                      width="13"
                      height="13"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-gray-400 dark:text-gray-500"
                    >
                      <path d="M12 2l2 2-8 8-2 2H2v-2l2-2 8-8z" />
                    </svg>
                  </button>
                )}
              </div>
            )}
            {chat && (
              <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                {chat.messages.length} {chat.messages.length === 1 ? 'message' : 'messages'}
              </p>
            )}
          </div>
        </div>

        <ModelSelector
          selectedModel={selectedModel}
          onModelSelect={setSelectedModel}
          numActiveToken={user?.numActiveToken}
        />
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {!chat || chat.messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-xs px-6">
              <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-blue-600/20">
                <Shield size={24} className="text-white" />
              </div>
              <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-2">
                Start an anonymous conversation
              </h2>
              <p className="text-sm text-gray-400 dark:text-gray-500 leading-relaxed">
                Your messages are routed through Tor. No tracking. No logs. Cryptographically
                private.
              </p>
            </div>
          </div>
        ) : (
          <div>
            {chat?.messages.map((message, idx) => {
              const isLastAssistant =
                message.role === 'assistant' &&
                idx === chat.messages.length - 1 &&
                !loadingState.isLoading
              return (
                <ChatMessage
                  key={message.id}
                  message={message}
                  isLastAssistant={isLastAssistant}
                  onRegenerate={isLastAssistant ? handleRegenerateResponse : undefined}
                  onEdit={
                    message.role === 'user'
                      ? (newContent) => onEditMessage?.(message.id, newContent)
                      : undefined
                  }
                  onDelete={() => onDeleteMessage?.(message.id)}
                />
              )
            })}
            {loadingState.isLoading && (
              <div className="flex gap-4 px-6 py-5">
                <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0 shadow shadow-blue-600/20">
                  <Shield size={13} className="text-white" />
                </div>
                <div className="flex items-center gap-3 pt-0.5">
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  {loadingState.message && (
                    <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">
                      {loadingState.message}
                    </span>
                  )}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <ChatInput
        onSendMessage={handleSendMessage}
        disabled={!chat || !user}
        isLoading={loadingState.isLoading}
        disabledText={!user ? 'Sign in to start chatting anonymously' : undefined}
      />
    </div>
  )
}
