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

export interface TokenPackage {
  ID: string
  ModelID: string
  Tokens: number
  Price: string
  Popular: boolean
  DodoProductID: string
}

export interface StoredAbuseTokens {
  permanentToken: string
  permanentSig: string
  transientToken: string
  transientSig: string
  transientEpoch: number
}

export interface ThreadEntry {
  Role: 'user' | 'admin'
  Content: string
  CreatedAt: string
}
