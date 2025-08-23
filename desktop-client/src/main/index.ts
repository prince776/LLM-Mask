import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'path'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import icon from '../../prod-deps/icon.png?asset'
import type { GenerateTokenReq, GenerateTokenResp, LLMProxyReq, LLMProxyResp } from '../types/ipc'

import log from 'electron-log/main'
import { GenerateToken } from './rsa'
import { LLMProxy } from './llmproxy'
import { doTorProxiedRequest, startTorProxy, stopTorProxy, waitForTor } from './torproxy'
// Initialize the logger to be available in renderer process
log.initialize()

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
    mainWindow.maximize()
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
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
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

  startTorProxy()
  waitForTor().then(() => {
    doTorProxiedRequest('https://check.torproject.org/api/ip').then((result) => {
      result.json().then((result) => {
        log.info('Tor proxy health check:', result)
      })
    })
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
