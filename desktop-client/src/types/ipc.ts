// Shared IPC types for generateToken

import {
  ChatCompletion,
  ChatCompletionMessageParam
} from 'openai/src/resources/chat/completions/completions'

export interface GenerateTokenReq {
  modelName: string
}

export interface GenerateTokenResp {
  token?: string
  signedToken?: string
  isNew?: boolean
  error?: any
}

export interface LLMProxyReq {
  token: string
  signedToken: string
  modelName: string

  messages: Array<ChatCompletionMessageParam>
}

export interface LLMProxyResp {
  data?: ChatCompletion
  blocked?: boolean
  blockReason?: string
  sizeLimitExceeded?: boolean
  sizeLimitReason?: string
  abuseTokenExpired?: boolean
  abuseTokenInvalid?: boolean
  abuseTokenBlacklisted?: boolean
  error?: any
}

// ---- Abuse token IPC types ----

export interface StoredAbuseTokens {
  permanentToken: string
  permanentSig: string
  transientToken: string
  transientSig: string
  transientEpoch: number
}

export interface SetupAbuseTokensReq {
  password: string
  uploadToServer: boolean
}

export interface SetupAbuseTokensResp {
  /** true if the save dialog completed; false if user cancelled */
  fileSaved: boolean
  error?: string
}

export interface RefreshTransientAbuseTokenReq {
  password: string
  uploadToServer: boolean
}

export interface RefreshTransientAbuseTokenResp {
  fileSaved: boolean
  error?: string
}

export interface RestoreAbuseTokenBackupReq {
  password: string
  /** 'file' opens a file-picker dialog; 'server' downloads from the server */
  source: 'file' | 'server'
}

export interface RestoreAbuseTokenBackupResp {
  error?: string
}

export interface GetAbuseTokenStatusResp {
  hasTokens: boolean
  transientExpired: boolean
}
