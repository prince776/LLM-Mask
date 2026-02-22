import { useEffect, useState } from 'react'
import { ThemeProvider } from './contexts/ThemeContext'
import { Sidebar } from './components/Sidebar'
import { ChatInterface } from './components/ChatInterface'
import { ProfilePage } from './components/ProfilePage'
import { SettingsPage } from './components/SettingsPage'
import { PurchaseTokensPage } from './components/PurchaseTokensPage'
import { NotificationBanner } from './components/NotificationBanner'
import { useChats } from './hooks/useChats'
import { useUser } from './contexts/UserContext'
import { useNotifications } from './contexts/NotificationContext'
import { SettingsProvider } from './contexts/SettingsContext'
import logo from './assets/logo-llmtor.svg'

type Page = 'chat' | 'profile' | 'settings' | 'purchase-tokens'

function LoadingScreen({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-screen w-screen bg-[#0f1117]">
      <div className="relative mb-5">
        <div
          className="absolute inset-0 rounded-3xl bg-emerald-400/20 animate-ping"
          style={{ animationDuration: '2s' }}
        />
        <div className="relative w-16 h-16 rounded-3xl overflow-hidden shadow-lg shadow-emerald-500/30">
          <img src={logo} alt="LLMTor" className="w-full h-full" />
        </div>
      </div>
      <h1 className="text-white font-semibold text-lg mb-1 tracking-tight">LLMTor</h1>
      <p className="text-gray-500 text-sm mb-5">{message}</p>
      <div className="flex gap-1.5">
        <div
          className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce"
          style={{ animationDelay: '0ms' }}
        />
        <div
          className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce"
          style={{ animationDelay: '150ms' }}
        />
        <div
          className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce"
          style={{ animationDelay: '300ms' }}
        />
      </div>
    </div>
  )
}

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('chat')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [torReady, setTorReady] = useState(false)

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

  const { user, isLoading } = useUser()
  const { globalNotif, userNotif, dismissGlobal, dismissUser } = useNotifications()

  useEffect(() => {
    const initTorStatus = async () => {
      try {
        if (window.api && window.api.getTorStatus) {
          const status = await window.api.getTorStatus()
          setTorReady(Boolean(status))
        }
      } catch (e) {
        // ignore; fall back to event listeners
      }
    }

    initTorStatus()

    if (window.api && window.api.onTorReady) {
      window.api.onTorSetupBegin(() => {
        setTorReady(false)
      })
      window.api.onTorReady(() => {
        setTorReady(true)
      })
    }
  }, [])

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
            onEditChatTitle={updateChatTitle}
            onEditMessage={(messageId, newContent) => {
              if (activeChat) {
                updateMessage(activeChat, messageId, newContent)
              }
            }}
            onDeleteMessage={(messageId) => {
              if (activeChat) {
                deleteMessage(activeChat, messageId)
              }
            }}
          />
        )
    }
  }

  if (!torReady) {
    return <LoadingScreen message="Establishing Tor circuit..." />
  }

  if (isLoading) {
    return <LoadingScreen message="Fetching your profile..." />
  }

  return (
    <ThemeProvider>
      <SettingsProvider>
        <div className="flex flex-col h-screen bg-gray-50 dark:bg-[#161b27]">
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

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0">{renderCurrentPage()}</div>
          </div>
        </div>
      </SettingsProvider>
    </ThemeProvider>
  )
}

export default App
