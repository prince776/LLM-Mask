import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2 } from 'lucide-react';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  disabled?: boolean;
  isLoading?: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({ 
  onSendMessage, 
  disabled = false,
  isLoading = false 
}) => {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !disabled && !isLoading) {
      onSendMessage(message.trim());
      setMessage('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [message]);

  return (
    <form onSubmit={handleSubmit} className="p-4 border-t border-gray-200 dark:border-gray-700">
      <div className="relative max-w-4xl mx-auto">
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message here..."
            disabled={disabled || isLoading}
            rows={1}
            className={`
              w-full px-4 py-3 pr-12 rounded-xl border border-gray-300 dark:border-gray-600
              bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
              placeholder-gray-500 dark:placeholder-gray-400
              focus:ring-2 focus:ring-blue-500 focus:border-transparent
              resize-none max-h-32 transition-all duration-200
              ${(disabled || isLoading) ? 'opacity-50 cursor-not-allowed' : ''}
            `}
            style={{ minHeight: '48px' }}
          />
          <button
            type="submit"
            disabled={!message.trim() || disabled || isLoading}
            className={`
              absolute right-2 top-2 p-2 rounded-lg transition-all duration-200
              ${message.trim() && !disabled && !isLoading
                ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
              }
            `}
          >
            {isLoading ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <Send size={20} />
            )}
          </button>
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
          Press Enter to send, Shift+Enter for new line
        </div>
      </div>
    </form>
  );
};