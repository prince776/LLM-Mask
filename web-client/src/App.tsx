import { useState } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import { ThemeProvider } from './contexts/ThemeContext'
import { SettingsProvider } from './contexts/SettingsContext'
import { ErrorProvider } from './contexts/ErrorContext'
import { UserProvider } from './contexts/UserContext'
import { NotificationProvider } from './contexts/NotificationContext'
import { Sidebar } from './components/Sidebar'
import { ChatInterface } from './components/ChatInterface'
import { ProfilePage } from './components/ProfilePage'
import { SettingsPage } from './components/SettingsPage'
import { PurchaseTokensPage } from './components/PurchaseTokensPage'
import { NotificationBanner } from './components/NotificationBanner'
import { SecurityBanner } from './components/SecurityBanner'
import { FeedbackWidget } from './components/FeedbackWidget'
import { AuthCallback } from './pages/AuthCallback'
import { PaymentCallback } from './pages/PaymentCallback'
import { useChats } from './hooks/useChats'
import { useUser } from './contexts/UserContext'
import { useNotifications } from './contexts/NotificationContext'

type Page = 'chat' | 'profile' | 'settings' | 'purchase-tokens'

function MainApp() {
  const [currentPage, setCurrentPage] = useState<Page>('chat')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const {
    chats,
    activeChat,
    setActiveChat,
    createNewChat,
    deleteChat,
    addMessage,
    getCurrentChat,
    updateChatTitle,
    updateMessage,
    deleteMessage
  } = useChats()

  const { user } = useUser()
  const { globalNotif, userNotif, dismissGlobal, dismissUser } = useNotifications()

  const handleSendMessage = (content: string, role: 'user' | 'assistant') => {
    if (!activeChat) {
      const newChatId = createNewChat()
      addMessage(newChatId, { content, role })
    } else {
      addMessage(activeChat, { content, role })
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
            onEditChatTitle={updateChatTitle}
            onEditMessage={(messageId, newContent) => {
              if (activeChat) updateMessage(activeChat, messageId, newContent)
            }}
            onDeleteMessage={(messageId) => {
              if (activeChat) deleteMessage(activeChat, messageId)
            }}
          />
        )
    }
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-[#161b27]">
      <SecurityBanner />

      {globalNotif && (
        <NotificationBanner
          message={globalNotif.message}
          label="Notice"
          variant="global"
          onDismiss={dismissGlobal}
        />
      )}
      {userNotif && (
        <NotificationBanner
          message={userNotif.message}
          label="Your Account"
          variant="user"
          onDismiss={dismissUser}
        />
      )}

      <div className="flex flex-1 min-h-0">
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
            setCurrentPage('profile')
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

        <div className="flex-1 flex flex-col min-w-0">{renderCurrentPage()}</div>
      </div>

      <FeedbackWidget />
    </div>
  )
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/payment/callback" element={<PaymentCallback />} />
      <Route path="*" element={<MainApp />} />
    </Routes>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <ErrorProvider>
        <UserProvider>
          <NotificationProvider>
            <SettingsProvider>
              <AppRoutes />
            </SettingsProvider>
          </NotificationProvider>
        </UserProvider>
      </ErrorProvider>
    </ThemeProvider>
  )
}
