import { app, session, net } from 'electron'
import { spawn, ChildProcess } from 'child_process'
import * as path from 'path'
import * as fs from 'fs'
import log from 'electron-log/main'
import { execSync } from 'node:child_process'

// let mainWindow: BrowserWindow | null
let torProcess: ChildProcess | null = null
const TOR_SOCKS_PORT = 9050

const torSessionPartition = 'persist:tor-session'

/**
 * Starts the Tor proxy as a child process.
 */
export function startTorProxy(): void {
  const torPath = getTorPath()
  if (!torPath) {
    return
  }

  // Define the path to the dynamic library
  const torDir = path.dirname(torPath)
  const libeventPath = path.join(torDir, 'libevent-2.1.7.dylib')

  // Self-sign the binaries before starting the process
  if (process.platform === 'darwin') {
    log.info('signing tor binaries for macOS...')
    selfSignBinary(torPath)
    selfSignBinary(libeventPath)
  }

  log.info('Starting Tor proxy...')
  const torArgs = ['--SocksPort', `${TOR_SOCKS_PORT}`]

  torProcess = spawn(torPath, torArgs)

  torProcess.stdout?.on('data', (data: Buffer) => {
    log.info(`Tor: ${data.toString()}`)
  })

  // Add a listener for the stderr stream to capture error messages from Tor
  torProcess.stderr?.on('data', (data: Buffer) => {
    log.error(`Tor stderr: ${data.toString()}`)
  })

  torProcess.on('error', (err: Error) => {
    log.error('Failed to start Tor process:', err)
  })

  torProcess.on('close', (code: number | null) => {
    log.info(`Tor process exited with code ${code}`)
  })
}

/**
 * Gracefully stops the Tor proxy process.
 */
export function stopTorProxy(): void {
  if (torProcess) {
    log.info('Stopping Tor proxy...')
    torProcess.kill('SIGINT')
  }
}

export function doTorProxiedRequest(input: string, init?: RequestInit): Promise<Response> {
  if (!torProcess) {
    log.error('Tor process is not running. Cannot make proxied request.')
    return Promise.reject(new Error('Tor process is not running.'))
  }
  return doTorProxiedRequestInternal(input, init)
}

function doTorProxiedRequestInternal(input: string, init?: RequestInit): Promise<Response> {
  const torSession = session.fromPartition(torSessionPartition)

  return new Promise((resolve, reject) => {
    if (!torSession) {
      return reject(new Error('Failed to get torSession.'))
    }

    torSession
      .setProxy({
        proxyRules: `socks5://127.0.0.1:${TOR_SOCKS_PORT}`
      })
      .then(() => {
        // Prepare the request options for net.request
        const requestOptions = {
          method: init?.method || 'GET',
          url: input,
          partition: torSessionPartition
        }

        const request = net.request(requestOptions)

        // Set headers from init.headers
        if (init?.headers) {
          for (const [key, value] of Object.entries(init.headers)) {
            request.setHeader(key, value as string)
          }
        }

        // Handle the response and resolve the promise
        request.on('response', (response) => {
          let data = ''
          response.on('data', (chunk) => {
            data += chunk.toString()
          })
          response.on('end', () => {
            const headers = new Headers()
            for (const key in response.headers) {
              const value = response.headers[key]
              // The value can be a string or an array of strings
              if (Array.isArray(value)) {
                value.forEach((v) => headers.append(key, v))
              } else {
                headers.append(key, value)
              }
            }
            resolve({
              ok: response.statusCode >= 200 && response.statusCode < 300,
              status: response.statusCode,
              headers: headers,
              json: () => Promise.resolve(JSON.parse(data)),
              text: () => Promise.resolve(data)
            } as unknown as Response)
          })
        })

        request.on('error', (error) => {
          reject(error)
        })

        // Convert the request body to a string or Buffer and write it
        if (init?.body) {
          try {
            const body = init.body as string //
            request.setHeader('Content-Type', 'application/json')
            request.write(body)
          } catch (error) {
            reject(new Error('Failed to stringify request body.' + error))
          }
        }

        request.end()
      })
      .catch((err) => {
        reject(err)
      })
  })
}

/**
 * Determines the correct path to the Tor executable based on the operating system.
 * @returns {string | null} The path to the Tor binary, or null if not found.
 */
function getTorPath(): string | null {
  let torPath: string
  let basePath = app.isPackaged ? process.resourcesPath : path.join(__dirname, '..', '..') // Adjust this path to point to your project's root
  basePath = path.join(basePath, 'prod-deps', 'tor-dist')

  if (process.platform === 'win32') {
    if (process.arch === 'x64') {
      torPath = path.join(basePath, 'windows-x64', 'tor', 'tor.exe')
    } else if (process.arch === 'ia32') {
      torPath = path.join(basePath, 'windows-i686', 'tor', 'tor.exe')
    } else {
      log.error('Unsupported architecture on Windows:', process.arch)
      return null
    }
  } else if (process.platform === 'darwin') {
    if (process.arch === 'arm64') {
      torPath = path.join(basePath, 'mac-arm', 'tor', 'tor')
    } else if (process.arch === 'x64') {
      torPath = path.join(basePath, 'mac-x86', 'tor', 'tor')
    } else {
      log.error('Unsupported architecture on macOS:', process.arch)
      return null
    }
  } else if (process.platform === 'linux') {
    if (process.arch === 'x64') {
      torPath = path.join(basePath, 'linux-x86', 'tor', 'tor.exe')
    } else if (process.arch === 'ia32') {
      torPath = path.join(basePath, 'linux-i686', 'tor', 'tor.exe')
    } else {
      log.error('Unsupported architecture on Windows:', process.arch)
      return null
    }
  } else {
    log.error('Unsupported platform:', process.platform)
    return null
  }

  if (fs.existsSync(torPath)) {
    return torPath
  } else {
    log.error(`Tor binary not found at: ${torPath}`)
    return null
  }
}

/**
 * Self-signs a binary on macOS to bypass Gatekeeper.
 * @param binaryPath The full path to the binary to be signed.
 */
function selfSignBinary(binaryPath: string): void {
  try {
    // Check if the binary exists before attempting to sign
    if (fs.existsSync(binaryPath)) {
      log.info(`Attempting to codesign and unquarantine binary: ${binaryPath}`)
      execSync(`codesign --force --deep --sign - "${binaryPath}"`)
      execSync(`xattr -cr "${binaryPath}"`)
      log.info(`Successfully signed: ${binaryPath}`)
    } else {
      log.warn(`Binary not found for signing: ${binaryPath}`)
    }
  } catch (error) {
    log.error(`Failed to codesign binary at ${binaryPath}:`, error)
  }
}

export function waitForTor(): Promise<void> {
  return new Promise((resolve, reject) => {
    // If torProcess is null or invalid, reject immediately.
    if (!torProcess || torProcess.killed) {
      return reject(new Error('Tor process is not running.'))
    }

    // Set a timeout to prevent an indefinite wait.
    const timeout = setTimeout(() => {
      torProcess?.kill()
      reject(new Error('Tor bootstrap timed out after 30 seconds.'))
    }, 30000) // 30-second timeout.

    // Listen for data on Tor's stdout stream.
    torProcess.stdout?.on('data', (data: Buffer) => {
      const output = data.toString()
      // Look for the specific message indicating successful bootstrap.
      if (output.includes('Bootstrapped 100% (done)')) {
        clearTimeout(timeout)
        log.info('Tor is fully bootstrapped. Ready for requests.')
        resolve()
      }
    })

    // Listen for a critical error from the child process.
    torProcess.on('error', (err: Error) => {
      clearTimeout(timeout)
      reject(err)
    })

    // Listen for the process to close unexpectedly.
    torProcess.on('close', (code: number | null) => {
      clearTimeout(timeout)
      if (code !== 0) {
        reject(new Error(`Tor process exited unexpectedly with code ${code}`))
      }
    })
  })
}
