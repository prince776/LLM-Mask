import { RSABSSA } from '@cloudflare/blindrsa-ts'
import { RSAKeys } from '../types/config'
import { SERVER_URL } from '../config'

const TOKEN_POOL_SIZE = 5
const POOL_REFILL_THRESHOLD = TOKEN_POOL_SIZE / 2

interface TokenPoolEntry {
  token: string
  signedToken: string
}

export function uint8ArrayToBase64(buffer: Uint8Array): string {
  let binary = ''
  buffer.forEach((b) => (binary += String.fromCharCode(b)))
  return btoa(binary)
}

export function base64ToUint8Array(base64String: string): Uint8Array {
  return Uint8Array.from(atob(base64String), (c) => c.charCodeAt(0))
}

function getPoolKey(modelName: string): string {
  return `_tokenPool.${modelName}`
}

function getTokenPool(modelName: string): TokenPoolEntry[] {
  try {
    const raw = localStorage.getItem(getPoolKey(modelName))
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveTokenPool(modelName: string, pool: TokenPoolEntry[]): void {
  localStorage.setItem(getPoolKey(modelName), JSON.stringify(pool))
}

function consumeFromPool(modelName: string): TokenPoolEntry | null {
  const pool = getTokenPool(modelName)
  if (pool.length === 0) return null
  const token = pool.shift()!
  saveTokenPool(modelName, pool)
  return token
}

function addToPool(modelName: string, entry: TokenPoolEntry): void {
  const pool = getTokenPool(modelName)
  pool.push(entry)
  saveTokenPool(modelName, pool)
}

async function getCryptoKey(pem: string): Promise<CryptoKey> {
  const pemHeader = '-----BEGIN PUBLIC KEY-----'
  const pemFooter = '-----END PUBLIC KEY-----'
  const pemText = pem.substring(pemHeader.length, pem.length - pemFooter.length).trim()
  const binaryDer = base64ToUint8Array(pemText)
  return crypto.subtle.importKey('spki', binaryDer as Uint8Array<ArrayBuffer>, { name: 'RSA-PSS', hash: 'SHA-384' }, true, ['verify'])
}

async function generateSingleToken(modelName: string): Promise<TokenPoolEntry> {
  const publicKeyPEM = RSAKeys[modelName]
  if (!publicKeyPEM) throw new Error(`No public key for model: ${modelName}`)

  const publicKey = await getCryptoKey(publicKeyPEM)
  const suite = RSABSSA.SHA384.PSS.Randomized()

  const uniqueID = crypto.randomUUID()
  const token = new TextEncoder().encode(uniqueID)

  const blindResult = await suite.blind(publicKey, token)

  const resp = await fetch(`${SERVER_URL}/api/v1/auth-token/${modelName}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      RequestID: crypto.randomUUID(),
      BlindedToken: uint8ArrayToBase64(blindResult.blindedMsg),
      ModelName: modelName
    })
  })

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}))
    throw new Error(err?.error ?? err?.status ?? `Server error ${resp.status}`)
  }

  const data = await resp.json()
  const signedBlindedToken = base64ToUint8Array(data.data.SignedBlindedToken)
  const finalSig = await suite.finalize(publicKey, token, signedBlindedToken, blindResult.inv)
  const isValid = await suite.verify(publicKey, finalSig, token)

  if (!isValid) throw new Error('Token signature verification failed')

  return {
    token: uint8ArrayToBase64(token),
    signedToken: uint8ArrayToBase64(finalSig)
  }
}

export async function generateToken(modelName: string): Promise<{ token: string; signedToken: string }> {
  const pooled = consumeFromPool(modelName)
  if (pooled) {
    const poolSize = getTokenPool(modelName).length
    if (poolSize < POOL_REFILL_THRESHOLD) {
      prefetchTokens(modelName).catch(console.error)
    }
    return pooled
  }

  const newToken = await generateSingleToken(modelName)
  prefetchTokens(modelName).catch(console.error)
  return newToken
}

export async function prefetchTokens(modelName: string, availableTokens = Infinity): Promise<void> {
  const currentSize = getTokenPool(modelName).length
  const needed = Math.min(TOKEN_POOL_SIZE - currentSize, availableTokens)
  if (needed <= 0) return

  for (let i = 0; i < needed; i++) {
    try {
      const entry = await generateSingleToken(modelName)
      addToPool(modelName, entry)
      if (i < needed - 1) {
        // Jitter between issuances to reduce timing correlation
        await new Promise((r) => setTimeout(r, 5000 + Math.random() * 25000))
      }
    } catch (err) {
      console.error(`Failed to prefetch token ${i + 1} for ${modelName}:`, err)
      await new Promise((r) => setTimeout(r, 500))
    }
  }
}
