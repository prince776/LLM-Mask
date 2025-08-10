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
  error?: any
}
