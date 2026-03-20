import { RSABSSA } from '@cloudflare/blindrsa-ts'
import { AbuseTokenPublicKeys } from '../types/config'
import { SERVER_URL } from '../config'
import { StoredAbuseTokens } from '../types'
import { uint8ArrayToBase64, base64ToUint8Array } from './rsa'

const PERMANENT_TOKEN_SIZE = 48
const TRANSIENT_TOKEN_SIZE = 48 // 44 random + 4 epoch bytes
const STORE_KEY = '_abuseTokens'

export function getCurrentEpoch(): number {
  const now = new Date()
  return now.getUTCFullYear() * 12 + (now.getUTCMonth() + 1)
}

export function saveAbuseTokens(tokens: StoredAbuseTokens): void {
  localStorage.setItem(STORE_KEY, JSON.stringify(tokens))
}

export function getStoredAbuseTokens(): StoredAbuseTokens | null {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    return raw ? (JSON.parse(raw) as StoredAbuseTokens) : null
  } catch {
    return null
  }
}

export function clearAbuseTokens(): void {
  localStorage.removeItem(STORE_KEY)
}

export function isTransientExpired(tokens: StoredAbuseTokens): boolean {
  return tokens.transientEpoch !== getCurrentEpoch()
}

async function getCryptoKey(pem: string): Promise<CryptoKey> {
  const pemHeader = '-----BEGIN PUBLIC KEY-----'
  const pemFooter = '-----END PUBLIC KEY-----'
  const pemText = pem.substring(pemHeader.length, pem.length - pemFooter.length).trim()
  const binaryDer = base64ToUint8Array(pemText)
  return crypto.subtle.importKey('spki', binaryDer as Uint8Array<ArrayBuffer>, { name: 'RSA-PSS', hash: 'SHA-384' }, true, ['verify'])
}

export async function generatePermanentAbuseToken(): Promise<{ token: string; sig: string }> {
  const publicKey = await getCryptoKey(AbuseTokenPublicKeys.permanent)
  const suite = RSABSSA.SHA384.PSS.Randomized()

  const tokenBytes = new Uint8Array(PERMANENT_TOKEN_SIZE)
  crypto.getRandomValues(tokenBytes)

  const blindResult = await suite.blind(publicKey, tokenBytes)

  const resp = await fetch(`${SERVER_URL}/api/v1/abuse-token/permanent`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ BlindedToken: uint8ArrayToBase64(blindResult.blindedMsg) })
  })

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}))
    throw new Error(err?.error ?? err?.status ?? `Server error ${resp.status}`)
  }

  const data = await resp.json()
  const signedBlindedToken = base64ToUint8Array(data.data.SignedBlindedToken)
  const finalSig = await suite.finalize(publicKey, tokenBytes, signedBlindedToken, blindResult.inv)

  if (!(await suite.verify(publicKey, finalSig, tokenBytes))) {
    throw new Error('Permanent abuse token signature verification failed')
  }

  return { token: uint8ArrayToBase64(tokenBytes), sig: uint8ArrayToBase64(finalSig) }
}

export async function generateTransientAbuseToken(): Promise<{ token: string; sig: string; epoch: number }> {
  const publicKey = await getCryptoKey(AbuseTokenPublicKeys.transient)
  const suite = RSABSSA.SHA384.PSS.Randomized()

  const epoch = getCurrentEpoch()
  const tokenBytes = new Uint8Array(TRANSIENT_TOKEN_SIZE)
  crypto.getRandomValues(tokenBytes.subarray(0, 44))
  new DataView(tokenBytes.buffer).setUint32(44, epoch, false)

  const blindResult = await suite.blind(publicKey, tokenBytes)

  const resp = await fetch(`${SERVER_URL}/api/v1/abuse-token/transient`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ BlindedToken: uint8ArrayToBase64(blindResult.blindedMsg) })
  })

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}))
    throw new Error(err?.error ?? err?.status ?? `Server error ${resp.status}`)
  }

  const data = await resp.json()
  const signedBlindedToken = base64ToUint8Array(data.data.SignedBlindedToken)
  const finalSig = await suite.finalize(publicKey, tokenBytes, signedBlindedToken, blindResult.inv)

  if (!(await suite.verify(publicKey, finalSig, tokenBytes))) {
    throw new Error('Transient abuse token signature verification failed')
  }

  return { token: uint8ArrayToBase64(tokenBytes), sig: uint8ArrayToBase64(finalSig), epoch }
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
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt.buffer as ArrayBuffer, iterations: 600000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

export async function encryptBackup(payload: BackupPayload, password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(password, salt)

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(JSON.stringify(payload))
  )

  const combined = new Uint8Array(salt.length + iv.length + ciphertext.byteLength)
  combined.set(salt, 0)
  combined.set(iv, salt.length)
  combined.set(new Uint8Array(ciphertext), salt.length + iv.length)

  return uint8ArrayToBase64(combined)
}

export async function decryptBackup(encryptedBlob: string, password: string): Promise<BackupPayload> {
  const combined = base64ToUint8Array(encryptedBlob)
  const salt = combined.slice(0, 16)
  const iv = combined.slice(16, 28)
  const ciphertext = combined.slice(28)

  const key = await deriveKey(password, salt)

  let plaintext: ArrayBuffer
  try {
    plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext)
  } catch {
    throw new Error('Incorrect password')
  }

  return JSON.parse(new TextDecoder().decode(plaintext)) as BackupPayload
}

export function downloadBackupFile(encryptedBlob: string): void {
  const blob = new Blob([encryptedBlob], { type: 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'llmtor-backup.llmmaskbak'
  a.click()
  URL.revokeObjectURL(url)
}

export async function uploadBackup(encryptedBlob: string): Promise<void> {
  const resp = await fetch(`${SERVER_URL}/api/v1/abuse-token/backup`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ EncryptedBlob: encryptedBlob })
  })
  if (!resp.ok) throw new Error(`Failed to upload backup: ${resp.status}`)
}

export async function downloadBackupFromServer(): Promise<string> {
  const resp = await fetch(`${SERVER_URL}/api/v1/abuse-token/backup`, {
    method: 'GET',
    credentials: 'include'
  })
  if (!resp.ok) throw new Error(`Failed to download backup: ${resp.status}`)
  const data = await resp.json()
  return data.data.EncryptedBlob as string
}

// ---- Setup helpers ----

export async function setupAbuseTokens(
  password: string,
  uploadToServer: boolean
): Promise<void> {
  const permanent = await generatePermanentAbuseToken()
  const transient = await generateTransientAbuseToken()

  const tokens: StoredAbuseTokens = {
    permanentToken: permanent.token,
    permanentSig: permanent.sig,
    transientToken: transient.token,
    transientSig: transient.sig,
    transientEpoch: transient.epoch
  }
  saveAbuseTokens(tokens)

  const encrypted = await encryptBackup(
    {
      permanentToken: permanent.token,
      permanentSig: permanent.sig,
      transientToken: transient.token,
      transientSig: transient.sig,
      transientEpoch: transient.epoch
    },
    password
  )
  downloadBackupFile(encrypted)

  if (uploadToServer) await uploadBackup(encrypted)
}

export async function refreshTransientToken(password: string, uploadToServer: boolean): Promise<void> {
  const stored = getStoredAbuseTokens()
  if (!stored) throw new Error('No abuse tokens stored — run setup first')

  const transient = await generateTransientAbuseToken()

  const updated: StoredAbuseTokens = {
    ...stored,
    transientToken: transient.token,
    transientSig: transient.sig,
    transientEpoch: transient.epoch
  }
  saveAbuseTokens(updated)

  const encrypted = await encryptBackup(
    {
      permanentToken: stored.permanentToken,
      permanentSig: stored.permanentSig,
      transientToken: transient.token,
      transientSig: transient.sig,
      transientEpoch: transient.epoch
    },
    password
  )
  downloadBackupFile(encrypted)

  if (uploadToServer) await uploadBackup(encrypted)
}

export async function restoreFromFile(password: string, file: File): Promise<void> {
  const encryptedBlob = await file.text()
  const payload = await decryptBackup(encryptedBlob.trim(), password)
  saveAbuseTokens({
    permanentToken: payload.permanentToken,
    permanentSig: payload.permanentSig,
    transientToken: payload.transientToken,
    transientSig: payload.transientSig,
    transientEpoch: payload.transientEpoch
  })
}

export async function restoreFromServer(password: string): Promise<void> {
  const encryptedBlob = await downloadBackupFromServer()
  const payload = await decryptBackup(encryptedBlob, password)
  saveAbuseTokens({
    permanentToken: payload.permanentToken,
    permanentSig: payload.permanentSig,
    transientToken: payload.transientToken,
    transientSig: payload.transientSig,
    transientEpoch: payload.transientEpoch
  })
}

// Check whether a permanent abuse token has already been issued for this account
export async function checkPermanentTokenIssued(): Promise<boolean> {
  try {
    const resp = await fetch(`${SERVER_URL}/api/v1/me`, { credentials: 'include' })
    if (!resp.ok) return false
    const data = await resp.json()
    return Boolean(data?.data?.PermanentAbuseTokenIssuedAt)
  } catch {
    return false
  }
}
