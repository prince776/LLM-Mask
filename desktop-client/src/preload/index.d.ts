import { ElectronAPI } from '@electron-toolkit/preload'
import type { GenerateTokenReq, GenerateTokenResp } from '../types/ipc'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      generateToken: (requestData: GenerateTokenReq) => Promise<GenerateTokenResp>
    }
  }
}
