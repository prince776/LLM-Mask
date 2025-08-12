import React, { useState, useRef, useEffect } from 'react'
import { Menu, Bot } from 'lucide-react'
import { ChatMessage } from './ChatMessage'
import { ChatInput } from './ChatInput'
import { ModelSelector } from './ModelSelector'
import { Chat, Message } from '../types'
import { useError } from '@renderer/contexts/ErrorContext'
import { LLMProxyReq, LLMProxyResp } from '../../../types/ipc'
import { useSettings } from '../contexts/SettingsContext'

interface ChatInterfaceProps {
  chat: Chat | undefined
  onSendMessage: (message: string, role: 'user' | 'assistant') => void
  onToggleSidebar: () => void
}

interface LoadingState {
  isLoading: boolean
  message: string
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  chat,
  onSendMessage,
  onToggleSidebar
}) => {
  const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash')
  const [loadingState, setLoadingState] = useState<LoadingState>({ isLoading: false, message: '' })
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { systemPrompt } = useSettings()

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }
  const { showError } = useError()

  useEffect(() => {
    scrollToBottom()
  }, [chat?.messages])

  const handleSendMessage = async (msg: string) => {
    try {
      // 1. Get auth token.
      setLoadingState({ isLoading: true, message: 'Generating Anonymous Token...' })
      onSendMessage(msg, 'user')
      const blindedToken = await window.api.generateToken({
        modelName: selectedModel
      })
      if (blindedToken.error) {
        throw blindedToken.error
      }

      // 2. Get LLM response.
      setLoadingState({ isLoading: true, message: 'Getting LLM Response Anonymously...' })

      const allMessages = [
        ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
        ...chat.messages,
        { role: 'user', content: msg }
      ]
      const llmsProxyReq: LLMProxyReq = {
        token: blindedToken.token || '',
        signedToken: blindedToken.signedToken || '',
        modelName: selectedModel,

        messages: allMessages.map((message: Message) => ({
          role: message.role,
          content: message.content
        }))
      }
      const llmResp: LLMProxyResp = await window.api.llmProxy(llmsProxyReq)
      console.log('Got LLM response', llmResp)
      if (llmResp.error || !llmResp.data) {
        throw llmResp.error
      }

      // 3. Process response and update chat.
      const aiMsg = llmResp.data.choices[0].message.content
      onSendMessage(aiMsg, 'assistant')
    } catch (e) {
      showError('Error generating chat response', e)
    } finally {
      setLoadingState({ isLoading: false, message: '' })
    }
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-4">
          <button
            onClick={onToggleSidebar}
            className="lg:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <Menu size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
          <div>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
              {chat?.title || 'Select a chat'}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {chat?.messages.length || 0} messages
            </p>
          </div>
        </div>

        <ModelSelector selectedModel={selectedModel} onModelSelect={setSelectedModel} />
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {chat?.messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Bot size={32} className="text-blue-600 dark:text-blue-400" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Start a new conversation
              </h2>
              <p className="text-gray-500 dark:text-gray-400 max-w-md">
                Ask me anything! I'm here to help you with information, creative tasks,
                problem-solving, and more.
              </p>
            </div>
          </div>
        ) : (
          <div>
            {chat?.messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
            {loadingState.isLoading && (
              <div className="flex gap-4 p-6 bg-gray-50 dark:bg-gray-800/50">
                <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
                  <div className="w-4 h-4 bg-gray-400 rounded-full animate-pulse" />
                </div>
                <div className="flex-1 flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                    <div
                      className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: '0.1s' }}
                    />
                    <div
                      className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: '0.2s' }}
                    />
                  </div>
                  {loadingState.message && (
                    <div className="text-sm text-gray-700 dark:text-gray-200 font-medium">
                      {loadingState.message}
                    </div>
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
        disabled={!chat}
        isLoading={loadingState.isLoading}
      />
    </div>
  )
}

// TODO: Render markdown response from ai correctly.
