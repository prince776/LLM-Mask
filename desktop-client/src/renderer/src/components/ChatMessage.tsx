import React from 'react'
import { useUser } from '../contexts/UserContext'
import { Message } from '../types'
import { Bot, User } from 'lucide-react'

interface ChatMessageProps {
  message: Message
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.role === 'user'
  const { user } = useUser()

  return (
    <div
      className={`flex gap-4 p-6 ${isUser ? 'bg-transparent' : 'bg-gray-50 dark:bg-gray-800/50'}`}
    >
      {/* Avatar */}
      <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center overflow-hidden bg-gray-200 dark:bg-gray-700">
        {isUser ? (
          user?.picture ? (
            <img src={user.picture} alt="User avatar" className="w-8 h-8 object-cover" />
          ) : (
            <div className="w-8 h-8 bg-blue-600 flex items-center justify-center rounded-full">
              <User size={16} className="text-white" />
            </div>
          )
        ) : (
          <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center rounded-full">
            <Bot size={16} className="text-blue-600 dark:text-blue-400" />
          </div>
        )}
      </div>

      {/* Message Content */}
      <div className="flex-1 min-w-0">
        <div className="prose prose-sm max-w-none dark:prose-invert">
          <p className="text-gray-900 dark:text-gray-100 leading-relaxed whitespace-pre-wrap">
            {message.content}
          </p>
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          {message.timestamp.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
          })}
        </div>
      </div>
    </div>
  )
}
