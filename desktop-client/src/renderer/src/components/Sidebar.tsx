import React from 'react';
import { MessageSquare, Plus, Trash2, Settings, User, Menu, X, CreditCard } from 'lucide-react';
import { Chat } from '../types';

interface SidebarProps {
  chats: Chat[];
  activeChat: string | null;
  onChatSelect: (chatId: string) => void;
  onNewChat: () => void;
  onDeleteChat: (chatId: string) => void;
  onSettingsClick: () => void;
  onProfileClick: () => void;
  onPurchaseTokensClick: () => void;
  onSignInClick: () => void;
  user: any;
  isOpen: boolean;
  onToggle: () => void;
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
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) return 'Today';
    if (diffDays === 2) return 'Yesterday';
    if (diffDays <= 7) return `${diffDays - 1} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed lg:relative top-0 left-0 h-full w-80 bg-white dark:bg-gray-900
        border-r border-gray-200 dark:border-gray-700 flex flex-col z-50
        transform transition-transform duration-300 ease-in-out lg:translate-x-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Chat History
            </h2>
            <button
              onClick={onToggle}
              className="lg:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <X size={20} className="text-gray-600 dark:text-gray-400" />
            </button>
          </div>

          <button
            onClick={onNewChat}
            className="w-full flex items-center justify-center gap-2 p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <Plus size={20} />
            New Chat
          </button>
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-2">
            {chats.map((chat) => (
              <div
                key={chat.id}
                className={`
                  group relative p-3 rounded-lg cursor-pointer transition-all duration-200
                  ${activeChat === chat.id
                    ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                  }
                `}
                onClick={() => onChatSelect(chat.id)}
              >
                <div className="flex items-start gap-3">
                  <MessageSquare size={18} className={`
                    flex-shrink-0 mt-0.5
                    ${activeChat === chat.id
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-gray-400 dark:text-gray-500'
                    }
                  `} />
                  <div className="flex-1 min-w-0">
                    <h3 className={`
                      font-medium text-sm truncate
                      ${activeChat === chat.id
                        ? 'text-blue-900 dark:text-blue-100'
                        : 'text-gray-900 dark:text-gray-100'
                      }
                    `}>
                      {chat.title}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {formatDate(chat.updatedAt)}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteChat(chat.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded transition-all"
                  >
                    <Trash2 size={14} className="text-red-500" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="space-y-2">
            {user ? (
              <button
                onClick={onProfileClick}
                className="w-full flex items-center gap-3 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors text-left"
              >
                <User size={18} className="text-gray-600 dark:text-gray-400" />
                <span className="text-gray-900 dark:text-gray-100">Profile</span>
              </button>
            ) : (
              <button
                onClick={onSignInClick}
                className="w-full flex items-center gap-3 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors text-left"
              >
                <User size={18} className="text-gray-600 dark:text-gray-400" />
                <span className="text-gray-900 dark:text-gray-100">Sign In</span>
              </button>
            )}
            <button
              onClick={onPurchaseTokensClick}
              className="w-full flex items-center gap-3 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors text-left"
            >
              <CreditCard size={18} className="text-gray-600 dark:text-gray-400" />
              <span className="text-gray-900 dark:text-gray-100">Purchase Tokens</span>
            </button>
            <button
              onClick={onSettingsClick}
              className="w-full flex items-center gap-3 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors text-left"
            >
              <Settings size={18} className="text-gray-600 dark:text-gray-400" />
              <span className="text-gray-900 dark:text-gray-100">Settings</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
