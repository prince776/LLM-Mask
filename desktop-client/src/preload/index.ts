import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type {
  GenerateTokenReq,
  GenerateTokenResp,
  LLMProxyReq,
  LLMProxyResp,
  SetupAbuseTokensReq,
  SetupAbuseTokensResp,
  RefreshTransientAbuseTokenReq,
  RefreshTransientAbuseTokenResp,
  RestoreAbuseTokenBackupReq,
  RestoreAbuseTokenBackupResp,
  GetAbuseTokenStatusResp,
  GetFeedbackResp,
  SendFeedbackReq,
  SendFeedbackResp
} from '../types/ipc'

// Custom APIs for renderer
const api = {
  generateToken: async (requestData: GenerateTokenReq): Promise<GenerateTokenResp> => {
    // Calls the main process via IPC and returns the result
    return await ipcRenderer.invoke('generate-token', requestData)
  },
  llmProxy: async (requestData: LLMProxyReq): Promise<LLMProxyResp> => {
    return await ipcRenderer.invoke('llm-proxy', requestData)
  },
  startAuth: async (): Promise<void> => {
    return await ipcRenderer.invoke('start-auth')
  },
  startPurchase: async (payload: {
    transientToken: string
    dodoProductID: string
    userID: string
  }): Promise<void> => {
    return await ipcRenderer.invoke('start-purchase', payload)
  },
  onTorSetupBegin: (callback: () => void) => {
    ipcRenderer.on('tor-setup-begin', callback)
  },
  onTorReady: (callback: () => void) => {
    ipcRenderer.on('tor-ready', callback)
  },
  getTorStatus: async (): Promise<boolean> => {
    return await ipcRenderer.invoke('get-tor-status')
  },
  onAuthWindowClosed: (callback: () => void) => {
    ipcRenderer.on('auth-window-closed', callback)
  },
  setupAbuseTokens: async (req: SetupAbuseTokensReq): Promise<SetupAbuseTokensResp> => {
    return await ipcRenderer.invoke('setup-abuse-tokens', req)
  },
  refreshTransientAbuseToken: async (
    req: RefreshTransientAbuseTokenReq
  ): Promise<RefreshTransientAbuseTokenResp> => {
    return await ipcRenderer.invoke('refresh-transient-abuse-token', req)
  },
  restoreAbuseTokenBackup: async (
    req: RestoreAbuseTokenBackupReq
  ): Promise<RestoreAbuseTokenBackupResp> => {
    return await ipcRenderer.invoke('restore-abuse-token-backup', req)
  },
  getAbuseTokenStatus: async (): Promise<GetAbuseTokenStatusResp> => {
    return await ipcRenderer.invoke('get-abuse-token-status')
  },
  getFeedback: async (): Promise<GetFeedbackResp> => {
    return await ipcRenderer.invoke('feedback-get')
  },
  sendFeedback: async (req: SendFeedbackReq): Promise<SendFeedbackResp> => {
    return await ipcRenderer.invoke('feedback-send', req)
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
