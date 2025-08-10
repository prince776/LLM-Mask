import React, { useState, useRef, useEffect } from 'react'
import { Menu } from 'lucide-react'
import { ChatMessage } from './ChatMessage'
import { ChatInput } from './ChatInput'
import { ModelSelector } from './ModelSelector'
import { Chat, Message } from '../types'

interface ChatInterfaceProps {
  chat: Chat | undefined
  onSendMessage: (message: string, role: 'user' | 'assistant') => void
  onToggleSidebar: () => void
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  chat,
  onSendMessage,
  onToggleSidebar
}) => {
  const [selectedModel, setSelectedModel] = useState('gpt-4-turbo')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [chat?.messages])

  const handleSendMessage = async (message: string) => {
    setIsLoading(true)
    onSendMessage(message, 'user')

    // Simulate AI response
    setTimeout(
      () => {
        const responses = [
          "That's an interesting question! Let me think about that...",
          "I'd be happy to help you with that. Here's what I think...",
          'Great point! From my understanding...',
          'Let me provide you with a detailed response to that...',
          "That's a complex topic. Let me break it down for you..."
        ]

        const randomResponse = responses[Math.floor(Math.random() * responses.length)]
        onSendMessage(randomResponse, 'assistant')
        setIsLoading(false)
      },
      1000 + Math.random() * 2000
    )
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
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="w-8 h-8 text-blue-600 dark:text-blue-400"
                >
                  <path
                    d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3a3 3 0 110 6 3 3 0 010-6zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"
                    fill="currentColor"
                  />
                </svg>
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
            {isLoading && (
              <div className="flex gap-4 p-6 bg-gray-50 dark:bg-gray-800/50">
                <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
                  <div className="w-4 h-4 bg-gray-400 rounded-full animate-pulse" />
                </div>
                <div className="flex-1">
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
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <ChatInput onSendMessage={handleSendMessage} disabled={!chat} isLoading={isLoading} />
    </div>
  )
}
