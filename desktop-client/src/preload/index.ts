import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { GenerateTokenReq, GenerateTokenResp } from '../types/ipc'

// Custom APIs for renderer
const api = {
  generateToken: async (requestData: GenerateTokenReq): Promise<GenerateTokenResp> => {
    // Calls the main process via IPC and returns the result
    return await ipcRenderer.invoke('generate-token', requestData)
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
