const DEV_SERVER_URL = 'http://localhost:8080'
const PROD_SERVER_URL = 'https://api.llmtor.com'

export const SERVER_URL =
  import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? PROD_SERVER_URL : DEV_SERVER_URL)

export const WEB_APP_URL =
  import.meta.env.VITE_WEB_APP_URL || (import.meta.env.PROD ? 'https://chat.llmtor.com' : 'http://localhost:5173')

export const DESKTOP_DOWNLOAD_URL = 'https://llmtor.com'
