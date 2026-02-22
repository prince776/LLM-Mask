import { RSABSSA } from '@cloudflare/blindrsa-ts'
import { AbuseTokenPublicKeys, SERVER_URL } from '../types/config'
import { getCookieHeader } from './utils'
import log from 'electron-log/main'
import { getStore } from './local-store'
import { StoredAbuseTokens } from '../types/ipc'

const PERMANENT_TOKEN_SIZE = 48
const TRANSIENT_TOKEN_SIZE = 48 // 44 random + 4 epoch bytes

const ABUSE_TOKENS_STORE_KEY = '_abuseTokens'

// Returns year * 12 + month (1-indexed), matching the server's CurrentEpoch().
export function getCurrentEpoch(): number {
  const now = new Date()
  return now.getUTCFullYear() * 12 + (now.getUTCMonth() + 1)
}

// ---- Store helpers ----

export function saveAbuseTokens(tokens: StoredAbuseTokens): void {
  getStore().set(ABUSE_TOKENS_STORE_KEY, JSON.stringify(tokens))
}

export function getStoredAbuseTokens(): StoredAbuseTokens | null {
  const raw = getStore().get(ABUSE_TOKENS_STORE_KEY) as string | undefined
  if (!raw) return null
  try {
    return JSON.parse(raw) as StoredAbuseTokens
  } catch {
    return null
  }
}

// ---- Crypto helpers ----

async function getCryptoKey(pem: string): Promise<CryptoKey> {
  const pemHeader = '-----BEGIN PUBLIC KEY-----'
  const pemFooter = '-----END PUBLIC KEY-----'
  const pemText = pem.substring(pemHeader.length, pem.length - pemFooter.length).trim()
  const binaryDerString = atob(pemText)
  const binaryDer = Uint8Array.from(binaryDerString, (c) => c.charCodeAt(0))
  return crypto.subtle.importKey(
    'spki',
    binaryDer,
    { name: 'RSA-PSS', hash: 'SHA-384' },
    true,
    ['verify']
  )
}

function uint8ArrayToBase64(buf: Uint8Array): string {
  let binary = ''
  buf.forEach((b) => (binary += String.fromCharCode(b)))
  return btoa(binary)
}

function base64ToUint8Array(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
}

// ---- Token generation ----

/**
 * Generates a permanent abuse token: 48 random bytes, blinded, signed by server, unblinded.
 * The server enforces one permanent token per account.
 */
export async function generatePermanentAbuseToken(): Promise<{ token: string; sig: string }> {
  const publicKey = await getCryptoKey(AbuseTokenPublicKeys.permanent)
  const suite = RSABSSA.SHA384.PSS.Randomized()

  const tokenBytes = new Uint8Array(PERMANENT_TOKEN_SIZE)
  crypto.getRandomValues(tokenBytes)

  const blindResult = await suite.blind(publicKey, tokenBytes)

  const resp = await fetch(`${SERVER_URL}/api/v1/abuse-token/permanent`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      ...(await getCookieHeader()),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      BlindedToken: uint8ArrayToBase64(blindResult.blindedMsg)
    })
  })

  if (!resp.ok) {
    const errData = await resp.json().catch(() => ({}))
    log.error('Failed to issue permanent abuse token:', errData)
    throw errData
  }

  const data = await resp.json()
  const signedBlindedToken = base64ToUint8Array(data.data.SignedBlindedToken)
  const finalSig = await suite.finalize(publicKey, tokenBytes, signedBlindedToken, blindResult.inv)

  const isValid = await suite.verify(publicKey, finalSig, tokenBytes)
  if (!isValid) throw new Error('Permanent abuse token signature verification failed')

  log.info('Permanent abuse token generated and verified.')
  return {
    token: uint8ArrayToBase64(tokenBytes),
    sig: uint8ArrayToBase64(finalSig)
  }
}

/**
 * Generates a transient abuse token: 44 random bytes + 4-byte big-endian epoch = 48 bytes total.
 * Expires at the end of the calendar month.
 */
export async function generateTransientAbuseToken(): Promise<{ token: string; sig: string }> {
  const publicKey = await getCryptoKey(AbuseTokenPublicKeys.transient)
  const suite = RSABSSA.SHA384.PSS.Randomized()

  const epoch = getCurrentEpoch()
  const tokenBytes = new Uint8Array(TRANSIENT_TOKEN_SIZE)
  // 44 random bytes
  crypto.getRandomValues(tokenBytes.subarray(0, 44))
  // Last 4 bytes: epoch as big-endian uint32
  const epochView = new DataView(tokenBytes.buffer)
  epochView.setUint32(44, epoch, false /* big-endian */)

  const blindResult = await suite.blind(publicKey, tokenBytes)

  const resp = await fetch(`${SERVER_URL}/api/v1/abuse-token/transient`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      ...(await getCookieHeader()),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      BlindedToken: uint8ArrayToBase64(blindResult.blindedMsg)
    })
  })

  if (!resp.ok) {
    const errData = await resp.json().catch(() => ({}))
    log.error('Failed to issue transient abuse token:', errData)
    throw errData
  }

  const data = await resp.json()
  const signedBlindedToken = base64ToUint8Array(data.data.SignedBlindedToken)
  const finalSig = await suite.finalize(publicKey, tokenBytes, signedBlindedToken, blindResult.inv)

  const isValid = await suite.verify(publicKey, finalSig, tokenBytes)
  if (!isValid) throw new Error('Transient abuse token signature verification failed')

  log.info('Transient abuse token generated and verified for epoch:', epoch)
  return {
    token: uint8ArrayToBase64(tokenBytes),
    sig: uint8ArrayToBase64(finalSig)
  }
}

// ---- Backup encryption / decryption ----

interface BackupPayload {
  permanentToken: string
  permanentSig: string
  transientToken: string
  transientSig: string
  transientEpoch: number
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, [
    'deriveKey'
  ])
  // Cast salt to ArrayBuffer to satisfy strict BufferSource typing
  const saltBuf = salt.buffer instanceof ArrayBuffer ? salt.buffer : new Uint8Array(salt).buffer
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: saltBuf, iterations: 600000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

/**
 * Encrypts the abuse token backup payload using AES-256-GCM with a PBKDF2-derived key.
 * Returns base64(salt || iv || ciphertext).
 */
export async function encryptBackup(payload: BackupPayload, password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(password, salt)

  const enc = new TextEncoder()
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(JSON.stringify(payload))
  )

  const combined = new Uint8Array(salt.length + iv.length + ciphertext.byteLength)
  combined.set(salt, 0)
  combined.set(iv, salt.length)
  combined.set(new Uint8Array(ciphertext), salt.length + iv.length)

  return uint8ArrayToBase64(combined)
}

/**
 * Decrypts an encrypted backup blob (base64(salt || iv || ciphertext)) using the provided password.
 */
export async function decryptBackup(encryptedBlob: string, password: string): Promise<BackupPayload> {
  const combined = base64ToUint8Array(encryptedBlob)
  const salt = combined.slice(0, 16)
  const iv = combined.slice(16, 28)
  const ciphertext = combined.slice(28)

  const key = await deriveKey(password, salt)

  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext)
  const dec = new TextDecoder()
  return JSON.parse(dec.decode(plaintext)) as BackupPayload
}

// ---- Backup API calls ----

export async function uploadBackup(encryptedBlob: string): Promise<void> {
  const resp = await fetch(`${SERVER_URL}/api/v1/abuse-token/backup`, {
    method: 'PUT',
    credentials: 'include',
    headers: {
      ...(await getCookieHeader()),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ EncryptedBlob: encryptedBlob })
  })
  if (!resp.ok) {
    throw new Error(`Failed to upload abuse token backup: ${resp.status}`)
  }
}

export async function downloadBackup(): Promise<string> {
  const resp = await fetch(`${SERVER_URL}/api/v1/abuse-token/backup`, {
    method: 'GET',
    credentials: 'include',
    headers: await getCookieHeader()
  })
  if (!resp.ok) {
    throw new Error(`Failed to download abuse token backup: ${resp.status}`)
  }
  const data = await resp.json()
  return data.data.EncryptedBlob as string
}
