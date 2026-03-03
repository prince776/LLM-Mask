import { app, session, net } from 'electron'
import * as os from 'os'
import { spawn, ChildProcess } from 'child_process'
import * as path from 'path'
import * as fs from 'fs'
import log from 'electron-log/main'
import { execSync } from 'node:child_process'

// let mainWindow: BrowserWindow | null
let torProcess: ChildProcess | null = null
let activeTorPort = 9050

const TOR_PORT_MIN = 9050
const TOR_PORT_MAX = 9059

const torSessionPartition = 'persist:tor-session'

export function getActiveTorPort(): number {
  return activeTorPort
}

class PortInUseError extends Error {
  constructor(port: number) {
    super(`Port ${port} is already in use`)
    this.name = 'PortInUseError'
  }
}

/**
 * Starts Tor on a specific port and waits for bootstrap or a port-in-use error.
 */
function startTorOnPort(port: number, torPath: string, geoipPath: string, geoip6Path: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const dataDir = path.join(os.tmpdir(), `tor-data-${port}`)
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true })
    }
    const torArgs = [
      '--SocksPort', `${port}`,
      '--DataDirectory', dataDir,
      '--GeoIPFile', geoipPath,
      '--GeoIPv6File', geoip6Path
    ]

    const spawnEnv =
      process.platform === 'linux'
        ? { ...process.env, LD_LIBRARY_PATH: path.dirname(torPath) }
        : process.env

    torProcess = spawn(torPath, torArgs, { env: spawnEnv })

    const timeout = setTimeout(() => {
      torProcess?.kill()
      reject(new Error('Tor bootstrap timed out after 30 seconds.'))
    }, 30000)

    torProcess.stdout?.on('data', (data: Buffer) => {
      const output = data.toString()
      log.info(`[Tor stdout]: ${output}`)
      if (output.includes('Bootstrapped 100% (done)')) {
        clearTimeout(timeout)
        log.info('Tor is fully bootstrapped. Ready for requests.')
        resolve()
      } else if (output.includes('Address already in use')) {
        clearTimeout(timeout)
        reject(new PortInUseError(port))
      }
    })

    torProcess.stderr?.on('data', (data: Buffer) => {
      log.error(`[Tor stderr]: ${data.toString()}`)
    })

    torProcess.on('error', (err: Error) => {
      clearTimeout(timeout)
      log.error('Failed to start Tor process:', err)
      reject(err)
    })

    torProcess.on('close', (code: number | null) => {
      clearTimeout(timeout)
      log.info(`Tor process exited with code ${code}`)
      if (code !== 0) {
        reject(new Error(`Tor process exited unexpectedly with code ${code}`))
      }
    })
  })
}

/**
 * Starts Tor, retrying with incrementing ports if the current port is already in use.
 */
export async function startTorWithRetry(): Promise<void> {
  const torPath = getTorPath()
  if (!torPath) {
    throw new Error('Tor binary not found for this platform/architecture.')
  }

  const torDir = path.dirname(torPath)
  const geoipPath = path.join(torDir, '..', 'data', 'geoip')
  const geoip6Path = path.join(torDir, '..', 'data', 'geoip6')

  for (let port = TOR_PORT_MIN; port <= TOR_PORT_MAX; port++) {
    log.info(`Starting Tor proxy on port ${port}...`)
    try {
      await startTorOnPort(port, torPath, geoipPath, geoip6Path)
      activeTorPort = port
      return
    } catch (err) {
      if (err instanceof PortInUseError && port < TOR_PORT_MAX) {
        log.warn(`Port ${port} already in use, trying ${port + 1}...`)
        if (torProcess && !torProcess.killed) {
          torProcess.kill()
        }
        torProcess = null
        continue
      }
      throw err
    }
  }

  throw new Error(`Failed to start Tor: all ports from ${TOR_PORT_MIN} to ${TOR_PORT_MAX} are in use.`)
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
        proxyRules: `socks5://127.0.0.1:${activeTorPort}`
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
  if (app.isPackaged) {
    basePath = path.join(basePath, 'app.asar.unpacked')
  }
  basePath = path.join(basePath, 'prod-deps', 'tor-dist')

  if (process.platform === 'win32') {
    if (process.arch === 'x64') {
      torPath = path.join(basePath, 'windows-x86', 'tor', 'tor.exe')
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
      torPath = path.join(basePath, 'linux-x86', 'tor', 'tor')
    } else if (process.arch === 'ia32') {
      torPath = path.join(basePath, 'linux-i686', 'tor', 'tor')
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

// @ts-ignore bruh
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

