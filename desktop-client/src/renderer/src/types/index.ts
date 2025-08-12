export interface Message {
  id: string
  content: string
  role: 'user' | 'assistant'
  timestamp: Date
}

export interface Chat {
  id: string
  title: string
  messages: Message[]
  createdAt: Date
  updatedAt: Date
}

export interface LLMModel {
  id: string
  name: string
  provider: string
  description: string
}

export interface UserProfile {
  id: string
  name: string
  email: string
  avatar?: string
  preferences: {
    defaultModel: string
    temperature: number
    maxTokens: number
  }
  tokenBalances: {
    [modelId: string]: number
  }
}

export interface TokenPackage {
  ID: string
  ModelID: string
  Tokens: number
  Price: string
  Popular: boolean
}
