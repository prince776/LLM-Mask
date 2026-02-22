// src/renderer/src/config.ts
const DEV_SERVER_URL = 'https://api.llmtor.com' // 'http://localhost:8080'
const PROD_SERVER_URL = 'https://api.llmtor.com'

export const SERVER_URL =
  import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? PROD_SERVER_URL : DEV_SERVER_URL)
