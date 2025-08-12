import { useState, useEffect } from 'react'
import { Chat, Message } from '../types'

const sampleChat = (): Chat => {
  return {
    id: '1',
    title: 'Welcome Chat',
    messages: [
      {
        id: '1',
        content: 'Hello! How can I help you today?',
        role: 'assistant',
        timestamp: new Date()
      }
    ],
    createdAt: new Date(),
    updatedAt: new Date()
  }
}

export const useChats = () => {
  const [chats, setChats] = useState<Chat[]>([])
  const [activeChat, setActiveChat] = useState<string | null>(null)

  useEffect(() => {
    // Load chats from localStorage or initialize with sample data
    const savedChats = localStorage.getItem('chats')
    let allChats: Chat[] = []
    if (savedChats) {
      const parsedChats = JSON.parse(savedChats)
      if (parsedChats.length === 0) {
        allChats = [sampleChat()]
      } else {
        allChats = parsedChats
      }
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
    // Save chats to localStorage
    if (chats.length > 0) {
      localStorage.setItem('chats', JSON.stringify(chats))
      console.log('Saved chats')
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
    setChats((prev) => prev.filter((chat) => chat.id !== chatId))
    if (activeChat === chatId) {
      setActiveChat(chats[0]?.id || null)
    }
  }

  const addMessage = (chatId: string, message: Omit<Message, 'id' | 'timestamp'>) => {
    const newMessage: Message = {
      ...message,
      id: Date.now().toString(),
      timestamp: new Date()
    }

    setChats((prev) =>
      prev.map((chat) => {
        if (chat.id === chatId) {
          const updatedChat = {
            ...chat,
            messages: [...chat.messages, newMessage],
            updatedAt: new Date(),
            title:
              chat.messages.length === 0
                ? message.content.slice(0, 50) + (message.content.length > 50 ? '...' : '')
                : chat.title
          }
          return updatedChat
        }
        return chat
      })
    )
  }

  const getCurrentChat = () => {
    return chats.find((chat) => chat.id === activeChat)
  }

  return {
    chats,
    activeChat,
    setActiveChat,
    createNewChat,
    deleteChat,
    addMessage,
    getCurrentChat
  }
}
