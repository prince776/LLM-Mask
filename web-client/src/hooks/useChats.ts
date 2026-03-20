import { useState, useEffect } from 'react'
import { Chat, Message } from '../types'

const sampleChat = (): Chat => ({
  id: '1',
  title: 'Welcome Chat',
  messages: [],
  createdAt: new Date(),
  updatedAt: new Date()
})

export const useChats = () => {
  const [chats, setChats] = useState<Chat[]>([])
  const [activeChat, setActiveChat] = useState<string | null>(null)

  useEffect(() => {
    const savedChats = localStorage.getItem('chats')
    let allChats: Chat[] = []
    if (savedChats) {
      const parsed = JSON.parse(savedChats)
      allChats = parsed.length === 0 ? [sampleChat()] : parsed
    } else {
      allChats = [sampleChat()]
    }
    setChats(
      allChats.map((chat: any) => ({
        ...chat,
        createdAt: new Date(chat.createdAt),
        updatedAt: new Date(chat.updatedAt),
        messages: chat.messages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }))
      }))
    )
    setActiveChat(allChats[0].id)
  }, [])

  useEffect(() => {
    if (chats.length > 0) {
      localStorage.setItem('chats', JSON.stringify(chats))
    }
  }, [chats])

  const createNewChat = () => {
    const newChat: Chat = {
      id: Date.now().toString(),
      title: 'New Chat',
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date()
    }
    setChats((prev) => [newChat, ...prev])
    setActiveChat(newChat.id)
    return newChat.id
  }

  const deleteChat = (chatId: string) => {
    setChats((prev) => prev.filter((c) => c.id !== chatId))
    if (activeChat === chatId) {
      setActiveChat(chats.find((c) => c.id !== chatId)?.id ?? null)
    }
  }

  const addMessage = (chatId: string, message: Omit<Message, 'id' | 'timestamp'>) => {
    const newMessage: Message = { ...message, id: Date.now().toString(), timestamp: new Date() }
    setChats((prev) =>
      prev.map((chat) => {
        if (chat.id !== chatId) return chat
        return {
          ...chat,
          messages: [...chat.messages, newMessage],
          updatedAt: new Date(),
          title:
            chat.messages.length === 0
              ? message.content.slice(0, 50) + (message.content.length > 50 ? '...' : '')
              : chat.title
        }
      })
    )
  }

  const updateChatTitle = (chatId: string, newTitle: string) => {
    setChats((prev) =>
      prev.map((c) => (c.id === chatId ? { ...c, title: newTitle, updatedAt: new Date() } : c))
    )
  }

  const updateMessage = (chatId: string, messageId: string, newContent: string) => {
    setChats((prev) =>
      prev.map((chat) => {
        if (chat.id !== chatId) return chat
        return {
          ...chat,
          messages: chat.messages.map((msg) =>
            msg.id === messageId ? { ...msg, content: newContent } : msg
          ),
          updatedAt: new Date()
        }
      })
    )
  }

  const deleteMessage = (chatId: string, messageId: string) => {
    setChats((prev) =>
      prev.map((chat) => {
        if (chat.id !== chatId) return chat
        return {
          ...chat,
          messages: chat.messages.filter((msg) => msg.id !== messageId),
          updatedAt: new Date()
        }
      })
    )
  }

  const getCurrentChat = () => chats.find((c) => c.id === activeChat)

  return {
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
  }
}
