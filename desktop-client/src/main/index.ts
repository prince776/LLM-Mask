import { app, BrowserWindow, dialog, ipcMain, nativeImage, shell } from 'electron'
import * as fs from 'fs'
import { join } from 'path'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import icon from '../../prod-deps/icon.png?asset'
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
  ThreadEntry,
  GetFeedbackResp,
  SendFeedbackReq,
  SendFeedbackResp
} from '../types/ipc'

import log from 'electron-log/main'
import { GenerateToken, prefetchTokens } from './rsa'
import { LLMProxy } from './llmproxy'
import {
  generatePermanentAbuseToken,
  generateTransientAbuseToken,
  saveAbuseTokens,
  getStoredAbuseTokens,
  encryptBackup,
  decryptBackup,
  uploadBackup,
  downloadBackup,
  getCurrentEpoch
} from './abuse-token'
import { doTorProxiedRequest, startTorWithRetry, stopTorProxy } from './torproxy'
import { getCookieHeader } from './utils'
import { createServer } from 'http'
import { SERVER_URL } from '../types/config'
import { AVAILABLE_MODEL_IDS } from '../types/models'
// Initialize the logger to be available in renderer process
log.initialize()

let mainWindow: BrowserWindow | null = null
let authWindow: BrowserWindow | null = null
let torIsReady = false
const REDIRECT_PORT = 5139

function createWindow(): void {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      partition: 'persist:app' // ✅ shared partition
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
    mainWindow?.maximize()
    // mainWindow?.webContents.openDevTools()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // Open DevTools only in development mode
  if (is.dev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  if (process.platform === 'darwin') {
    app.dock.setIcon(nativeImage.createFromPath(icon))
  }

  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  if (mainWindow) {
    mainWindow.webContents.send('tor-setup-begin')
  }
  startTorWithRetry()
    .then(() => {
      torIsReady = true
      // Send an IPC message to the renderer process
      if (mainWindow) {
        mainWindow.webContents.send('tor-ready')
      }
      doTorProxiedRequest('https://check.torproject.org/api/ip').then((result) => {
        result.json().then((result) => {
          log.info('Tor proxy health check:', result)
        })
      })

      // Start prefetching tokens for all available models after Tor is ready
      // First, fetch user profile to get available tokens per model
      ;(async () => {
        try {
          const response = await fetch(`${SERVER_URL}/api/v1/me`, {
            method: 'GET',
            headers: {
              ...(await getCookieHeader()),
              'Content-Type': 'application/json'
            }
          })

          if (!response.ok) {
            throw new Error(`Failed to fetch user profile: ${response.status}`)
          }

          const data = await response.json()
          log.info('[Prefetch] User profile response:', JSON.stringify(data, null, 2))

          // Extract available tokens - handle different possible response structures
          const numActiveTokens: Record<string, number> =
            data.data?.SubscriptionInfo?.ActiveAuthTokens ||
            data.data?.numActiveToken ||
            data.SubscriptionInfo?.ActiveAuthTokens ||
            {}

          log.info('[Prefetch] Extracted available tokens:', JSON.stringify(numActiveTokens))

          // Random startup delay before issuing any tokens, to reduce timing
          // correlation between a login event and the first token issuance burst.
          const startupJitterMs = Math.random() * 60000 // 0–60 seconds
          await new Promise((resolve) => setTimeout(resolve, startupJitterMs))

          // Prefetch tokens for each model, respecting available token limits
          AVAILABLE_MODEL_IDS.forEach((modelName) => {
            const availableTokens = numActiveTokens[modelName] ?? 0
            log.info(`[Prefetch] Model: ${modelName}, Available: ${availableTokens}`)
            prefetchTokens(modelName, availableTokens).catch((err) => {
              log.error('Error prefetching tokens for', modelName, 'on startup:', err)
            })
          })
        } catch (err) {
          log.warn(
            'Failed to fetch user profile for token prefetch, prefetching without limits:',
            err
          )
          // Fallback: prefetch without limits if user fetch fails (same startup jitter)
          const fallbackJitterMs = Math.random() * 60000 // 0–60 seconds
          await new Promise((resolve) => setTimeout(resolve, fallbackJitterMs))
          AVAILABLE_MODEL_IDS.forEach((modelName) => {
            prefetchTokens(modelName).catch((err) => {
              log.error('Error prefetching tokens for', modelName, 'on startup:', err)
            })
          })
        }
      })()
    })
    .catch(async (error) => {
      log.error(error)
      await dialog.showErrorBox(
        'Tor Failed to Start',
        `The Tor network connection could not be established.\n\n${error.message}\n\nThe application will now exit.`
      )
      process.exit(1)
    })

  ipcMain.handle('get-tor-status', () => {
    return torIsReady
  })

  ipcMain.handle(
    'generate-token',
    async (_event, requestData: GenerateTokenReq): Promise<GenerateTokenResp> => {
      log.info('[IPC]: Initiated generate-token', requestData)
      try {
        return await GenerateToken(requestData)
      } catch (e) {
        log.info('[IPC]: Errored generate-token:', e)
        return {
          error: e
        }
      }
    }
  )

  ipcMain.handle('llm-proxy', async (_event, requestData: LLMProxyReq): Promise<LLMProxyResp> => {
    log.info('[IPC]: Initiated llm-proxy to', requestData.modelName)
    try {
      return await LLMProxy(requestData)
    } catch (e) {
      log.info('[IPC]: Errored llm-proxy:', e)
      return {
        error: e
      }
    }
  })

  // IPC to start auth from renderer
  ipcMain.handle('start-auth', () => {
    startAuthFlow()
  })

  // IPC to start purchase flow from renderer
  ipcMain.handle(
    'start-purchase',
    (
      _event,
      payload: {
        transientToken: string
        dodoProductID: string
        userID: string
      }
    ) => {
      startPurchaseFlow(payload)
    }
  )

  // Abuse token IPC handlers

  ipcMain.handle(
    'setup-abuse-tokens',
    async (_event, req: SetupAbuseTokensReq): Promise<SetupAbuseTokensResp> => {
      log.info('[IPC]: setup-abuse-tokens')
      try {
        const [permanent, transient] = await Promise.all([
          generatePermanentAbuseToken(),
          generateTransientAbuseToken()
        ])
        const stored = {
          permanentToken: permanent.token,
          permanentSig: permanent.sig,
          transientToken: transient.token,
          transientSig: transient.sig,
          transientEpoch: getCurrentEpoch()
        }
        saveAbuseTokens(stored)
        const blob = await encryptBackup(stored, req.password)

        // Always export to file
        const fileSaved = await saveBackupToFile(blob)

        // Optionally sync to server
        if (req.uploadToServer) {
          await uploadBackup(blob)
        }

        log.info('[IPC]: setup-abuse-tokens complete, fileSaved:', fileSaved)
        return { fileSaved }
      } catch (e: any) {
        log.error('[IPC]: setup-abuse-tokens error:', e)
        return { fileSaved: false, error: e?.message ?? String(e) }
      }
    }
  )

  ipcMain.handle(
    'refresh-transient-abuse-token',
    async (_event, req: RefreshTransientAbuseTokenReq): Promise<RefreshTransientAbuseTokenResp> => {
      log.info('[IPC]: refresh-transient-abuse-token')
      try {
        const existing = getStoredAbuseTokens()
        if (!existing) {
          return { fileSaved: false, error: 'No stored abuse tokens found; please run setup first' }
        }

        const transient = await generateTransientAbuseToken()
        const updated = {
          ...existing,
          transientToken: transient.token,
          transientSig: transient.sig,
          transientEpoch: getCurrentEpoch()
        }
        saveAbuseTokens(updated)
        const blob = await encryptBackup(updated, req.password)

        // Always export to file
        const fileSaved = await saveBackupToFile(blob)

        // Optionally sync to server
        if (req.uploadToServer) {
          await uploadBackup(blob)
        }

        log.info('[IPC]: refresh-transient-abuse-token complete, fileSaved:', fileSaved)
        return { fileSaved }
      } catch (e: any) {
        log.error('[IPC]: refresh-transient-abuse-token error:', e)
        return { fileSaved: false, error: e?.message ?? String(e) }
      }
    }
  )

  ipcMain.handle(
    'restore-abuse-token-backup',
    async (_event, req: RestoreAbuseTokenBackupReq): Promise<RestoreAbuseTokenBackupResp> => {
      log.info('[IPC]: restore-abuse-token-backup from', req.source)
      try {
        let blob: string
        if (req.source === 'file') {
          const result = await dialog.showOpenDialog({
            title: 'Select token backup file',
            filters: [{ name: 'Token Backup', extensions: ['llmmaskbak'] }],
            properties: ['openFile']
          })
          if (result.canceled || result.filePaths.length === 0) {
            return { error: 'No file selected' }
          }
          blob = fs.readFileSync(result.filePaths[0]).toString('base64')
        } else {
          blob = await downloadBackup()
        }
        const payload = await decryptBackup(blob, req.password)
        saveAbuseTokens(payload)
        log.info('[IPC]: restore-abuse-token-backup complete')
        return {}
      } catch (e: any) {
        log.error('[IPC]: restore-abuse-token-backup error:', e)
        return { error: e?.message ?? String(e) }
      }
    }
  )

  ipcMain.handle('feedback-get', async (): Promise<GetFeedbackResp> => {
    try {
      const resp = await fetch(`${SERVER_URL}/api/v1/feedback`, {
        method: 'GET',
        headers: { ...(await getCookieHeader()), 'Content-Type': 'application/json' }
      })
      if (!resp.ok) {
        return { error: `Server error: ${resp.status}` }
      }
      const data = await resp.json()
      return { entries: (data?.data?.entries ?? []) as ThreadEntry[] }
    } catch (e: any) {
      return { error: e?.message ?? String(e) }
    }
  })

  ipcMain.handle('feedback-send', async (_e, req: SendFeedbackReq): Promise<SendFeedbackResp> => {
    try {
      const resp = await fetch(`${SERVER_URL}/api/v1/feedback`, {
        method: 'POST',
        headers: { ...(await getCookieHeader()), 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: req.message })
      })
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}))
        return { error: data?.error ?? `Server error: ${resp.status}` }
      }
      return {}
    } catch (e: any) {
      return { error: e?.message ?? String(e) }
    }
  })

  ipcMain.handle('get-abuse-token-status', async (): Promise<GetAbuseTokenStatusResp> => {
    const tokens = getStoredAbuseTokens()
    if (!tokens) {
      // Check server to see if a permanent abuse token was ever issued for this account.
      // This distinguishes a first-time setup from a reinstall/data-loss scenario.
      let permanentTokenIssued = false
      try {
        const resp = await fetch(`${SERVER_URL}/api/v1/me`, {
          method: 'GET',
          headers: { ...(await getCookieHeader()), 'Content-Type': 'application/json' }
        })
        if (resp.ok) {
          const data = await resp.json()
          const issuedAt = data?.data?.PermanentAbuseTokenIssuedAt ?? data?.PermanentAbuseTokenIssuedAt
          permanentTokenIssued = issuedAt != null
        }
      } catch {
        // If server is unreachable, default to false (show all options)
      }
      return { hasTokens: false, transientExpired: false, permanentTokenIssued }
    }
    const transientExpired = tokens.transientEpoch !== getCurrentEpoch()
    return { hasTokens: true, transientExpired, permanentTokenIssued: true }
  })

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  stopTorProxy()
})

/**
 * Shows a save-file dialog and writes the backup blob (binary) to the chosen path.
 * Returns true if the file was saved, false if the user cancelled.
 */
async function saveBackupToFile(encryptedBlob: string): Promise<boolean> {
  const result = await dialog.showSaveDialog({
    title: 'Save token backup',
    defaultPath: 'llmtor-token-backup.llmtorbak',
    filters: [{ name: 'Token Backup', extensions: ['llmmaskbak'] }]
  })
  if (result.canceled || !result.filePath) {
    return false
  }
  fs.writeFileSync(result.filePath, Buffer.from(encryptedBlob, 'base64'))
  return true
}

function startAuthFlow(): void {
  const redirectUri = `http://127.0.0.1:${REDIRECT_PORT}/callback`
  let serverClosed = false

  // Create local server to capture redirect
  const server = createServer((req, res) => {
    if (req.url?.startsWith('/callback')) {
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end('<h1>Sign in successful. You can close this window.</h1>')

      if (authWindow) {
        authWindow.close()
        authWindow = null
      }

      // Reload main window (cookies are already saved in default session)
      if (mainWindow) {
        // HMR for renderer base on electron-vite cli.
        // Load the remote URL for development or the local html file for production.
        if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
          mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
        } else {
          mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
        }
      }

      if (!serverClosed) {
        serverClosed = true
        server.close()
      }
    } else {
      res.writeHead(404)
      res.end()
    }
  })

  server.listen(REDIRECT_PORT, () => {
    const signInUrl = `${SERVER_URL}/api/v1/users/signin?redirect=${encodeURIComponent(redirectUri)}`

    // Popup window for OAuth
    authWindow = new BrowserWindow({
      width: 500,
      height: 700,
      parent: mainWindow ?? undefined,
      // modal: true,
      webPreferences: {
        nodeIntegration: false,
        partition: 'persist:app', // ✅ shared partition
        enableBlinkFeatures: 'CSSBackdropFilter',
        offscreen: false, // make sure it renders normally
        webSecurity: true,
        contextIsolation: true
      }
    })

    // Close server when window is closed without completing the flow
    authWindow.on('closed', () => {
      if (!serverClosed) {
        serverClosed = true
        server.close()
      }
      // Notify renderer to refetch user after auth window closes
      if (mainWindow) {
        mainWindow.webContents.send('auth-window-closed')
      }
      authWindow = null
    })

    authWindow.loadURL(signInUrl)
  })
}

function startPurchaseFlow(payload: {
  transientToken: string
  dodoProductID: string
  userID: string
}): void {
  // Use the backend's own payment callback page as the return URL so Dodo can
  // reach it (localhost:5139 is not publicly accessible and causes "Failed to
  // confirm session" in Dodo's checkout confirmation step).
  const redirectUri = `${SERVER_URL}/payment/callback`
  const { transientToken, dodoProductID, userID } = payload
  const purchaseUrl = `${SERVER_URL}/api/v1/purchase?transientToken=${encodeURIComponent(
    transientToken
  )}&dodoProductID=${encodeURIComponent(dodoProductID)}&userID=${encodeURIComponent(
    userID
  )}&redirectURL=${encodeURIComponent(redirectUri)}`

  authWindow = new BrowserWindow({
    width: 700,
    height: 800,
    parent: mainWindow ?? undefined,
    webPreferences: {
      nodeIntegration: false,
      partition: 'persist:app',
      enableBlinkFeatures: 'CSSBackdropFilter',
      offscreen: false,
      webSecurity: true,
      contextIsolation: true
    }
  })

  // When the window closes (either the user closes it or window.close() fires
  // from the payment callback page), notify the renderer to refetch the user
  // so the updated token balance is shown.
  authWindow.on('closed', () => {
    if (mainWindow) {
      mainWindow.webContents.send('auth-window-closed')
    }
    authWindow = null
  })

  authWindow.loadURL(purchaseUrl)
}
