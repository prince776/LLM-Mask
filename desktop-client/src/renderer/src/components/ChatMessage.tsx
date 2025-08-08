import React from 'react';
import { Bot, User } from 'lucide-react';
import { Message } from '../types';

interface ChatMessageProps {
  message: Message;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-4 p-6 ${isUser ? 'bg-transparent' : 'bg-gray-50 dark:bg-gray-800/50'}`}>
      {/* Avatar */}
      <div className={`
        flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center
        ${isUser 
          ? 'bg-blue-600' 
          : 'bg-gray-200 dark:bg-gray-700'
        }
      `}>
        {isUser ? (
          <User size={16} className="text-white" />
        ) : (
          <Bot size={16} className="text-gray-600 dark:text-gray-400" />
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
  );
};