import { ElectronAPI } from '@electron-toolkit/preload'
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
  GetAbuseTokenStatusResp
} from '../types/ipc'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      generateToken: (requestData: GenerateTokenReq) => Promise<GenerateTokenResp>
      llmProxy: (req: LLMProxyReq) => Promise<LLMProxyResp>
      startAuth: () => Promise<void>
      startPurchase: (payload: {
        transientToken: string
        dodoProductID: string
        userID: string
      }) => Promise<void>
      onTorSetupBegin: (callback: () => void) => Promise<void>
      onTorReady: (callback: () => void) => Promise<void>
      getTorStatus: () => Promise<boolean>
      onAuthWindowClosed: (callback: () => void) => void
      setupAbuseTokens: (req: SetupAbuseTokensReq) => Promise<SetupAbuseTokensResp>
      refreshTransientAbuseToken: (req: RefreshTransientAbuseTokenReq) => Promise<RefreshTransientAbuseTokenResp>
      restoreAbuseTokenBackup: (req: RestoreAbuseTokenBackupReq) => Promise<RestoreAbuseTokenBackupResp>
      getAbuseTokenStatus: () => Promise<GetAbuseTokenStatusResp>
    }
  }
}
