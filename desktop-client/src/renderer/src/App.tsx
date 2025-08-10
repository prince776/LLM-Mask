import { useState } from 'react'
import { ThemeProvider } from './contexts/ThemeContext'
import { Sidebar } from './components/Sidebar'
import { ChatInterface } from './components/ChatInterface'
import { ProfilePage } from './components/ProfilePage'
import { SettingsPage } from './components/SettingsPage'
import { PurchaseTokensPage } from './components/PurchaseTokensPage'
import { useChats } from './hooks/useChats'
import { useUser } from './contexts/UserContext'

type Page = 'chat' | 'profile' | 'settings' | 'purchase-tokens'

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('chat')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const {
    chats,
    activeChat,
    setActiveChat,
    createNewChat,
    deleteChat,
    addMessage,
    getCurrentChat
  } = useChats()

  const { user } = useUser()

  const handleSendMessage = (content: string, role: 'user' | 'assistant') => {
    if (!activeChat) {
      const newChatId = createNewChat()
      addMessage(newChatId, { content, role: role })
    } else {
      addMessage(activeChat, { content, role: role })
    }
  }

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'profile':
        return <ProfilePage onBack={() => setCurrentPage('chat')} />
      case 'settings':
        return <SettingsPage onBack={() => setCurrentPage('chat')} />
      case 'purchase-tokens':
        return <PurchaseTokensPage onBack={() => setCurrentPage('chat')} />
      default:
        return (
          <ChatInterface
            chat={getCurrentChat()}
            onSendMessage={handleSendMessage}
            onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          />
        )
    }
  }

  return (
    <ThemeProvider>
      <div className="h-screen flex bg-gray-50 dark:bg-gray-900">
        {/* Sidebar */}
        <Sidebar
          chats={chats}
          activeChat={activeChat}
          onChatSelect={(chatId) => {
            setActiveChat(chatId)
            setCurrentPage('chat')
            setSidebarOpen(false)
          }}
          onNewChat={() => {
            createNewChat()
            setCurrentPage('chat')
            setSidebarOpen(false)
          }}
          onDeleteChat={deleteChat}
          onSettingsClick={() => {
            setCurrentPage('settings')
            setSidebarOpen(false)
          }}
          onProfileClick={() => {
            setCurrentPage('profile')
            setSidebarOpen(false)
          }}
          onSignInClick={() => {
            setCurrentPage('profile') // or a dedicated sign-in page if you have one
            setSidebarOpen(false)
          }}
          onPurchaseTokensClick={() => {
            setCurrentPage('purchase-tokens')
            setSidebarOpen(false)
          }}
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          user={user}
        />

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0">{renderCurrentPage()}</div>
      </div>
    </ThemeProvider>
  )
}

export default App
