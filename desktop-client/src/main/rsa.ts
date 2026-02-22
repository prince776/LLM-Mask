import { RSABSSA } from '@cloudflare/blindrsa-ts'
import { RSAKeys, SERVER_URL } from '../types/config'
import { getCookieHeader } from './utils'
import log from 'electron-log/main'
import { GenerateTokenReq, GenerateTokenResp } from '../types/ipc'
import { getStore } from './local-store'

// TODO: Improvements
// 1. Proper retry mechanism when requesting token/ Making LLM Proxy requests.
// 2. Store the chats in local store as well. This entire thing needs to
//    go to proxy server in every call.
// 3. Forward llm-proxy request via tor port.

// Token pool configuration: number of tokens to maintain in the queue
const TOKEN_POOL_SIZE = 5

interface TokenPoolEntry {
  token: string
  signedToken: string
}

function getTokenPoolKey(modelName: string): string {
  return `_tokenPool.${modelName}`
}

async function getTokenPool(modelName: string): Promise<TokenPoolEntry[]> {
  const localStore = getStore()
  const poolData = localStore.get(getTokenPoolKey(modelName)) as string | undefined
  if (!poolData) {
    return []
  }
  try {
    return JSON.parse(poolData)
  } catch {
    return []
  }
}

async function saveTokenPool(modelName: string, pool: TokenPoolEntry[]): Promise<void> {
  const localStore = getStore()
  localStore.set(getTokenPoolKey(modelName), JSON.stringify(pool))
}

async function consumeTokenFromPool(modelName: string): Promise<TokenPoolEntry | null> {
  const pool = await getTokenPool(modelName)
  if (pool.length === 0) {
    return null
  }
  const token = pool.shift()!
  await saveTokenPool(modelName, pool)
  return token
}

async function addTokenToPool(modelName: string, token: TokenPoolEntry): Promise<void> {
  const pool = await getTokenPool(modelName)
  pool.push(token)
  await saveTokenPool(modelName, pool)
}

async function getTokenPoolSize(modelName: string): Promise<number> {
  const pool = await getTokenPool(modelName)
  return pool.length
}

export async function GenerateToken(req: GenerateTokenReq): Promise<GenerateTokenResp> {
  const modelName = req.modelName

  // Try to consume a token from the pool first
  const pooledToken = await consumeTokenFromPool(modelName)
  if (pooledToken) {
    // Start prefetching if pool is low
    const poolSize = await getTokenPoolSize(modelName)
    log.info('Using pooled token for model:', modelName, 'remaining tokens in pool:', poolSize)
    if (poolSize < TOKEN_POOL_SIZE / 2) {
      log.info('Token pool low for', modelName, '- starting prefetch')
      // Don't await, let it happen in background
      prefetchTokens(modelName).catch((err) => {
        log.error('Error prefetching tokens for', modelName, ':', err)
      })
    }
    return {
      token: pooledToken.token,
      signedToken: pooledToken.signedToken,
      isNew: false
    }
  }

  // If no pooled tokens, generate one and start prefetching pool
  log.info('No pooled tokens available, generating new token for:', modelName)
  const token = await generateSingleToken(modelName)

  // Start background prefetch to fill the pool
  prefetchTokens(modelName).catch((err) => {
    log.error('Error prefetching tokens for', modelName, ':', err)
  })

  return token
}

async function generateSingleToken(modelName: string): Promise<GenerateTokenResp> {
  const publicKeyPEMForModel = RSAKeys[modelName]
  if (!publicKeyPEMForModel) {
    throw `No public key found for model: ${modelName}`
  }

  const publicKey = await getCryptoKey(publicKeyPEMForModel)
  const suite = RSABSSA.SHA384.PSS.Randomized()

  // 1. Generate Blinded Token - keep token and blindedToken together in scope
  const uniqueID = crypto.randomUUID()
  const token = new TextEncoder().encode(uniqueID)
  log.info('Initiating blind signing for a new token')

  // Blind the token and keep the blind result in local scope
  const blindResult = await suite.blind(publicKey, token)

  // 2. Get the signed blinded token from the server
  const requestID = crypto.randomUUID()
  const resp = await fetch(`${SERVER_URL}/api/v1/auth-token/${modelName}`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      ...(await getCookieHeader()),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      RequestID: requestID,
      BlindedToken: uint8ArrayToBase64(blindResult.blindedMsg),
      ModelName: modelName
    })
  }) // TODO: Add retries.

  if (!resp.ok) {
    const errorData = await resp.json()
    log.info('failed to get signed blinded token', errorData)
    throw errorData
  }

  const data = await resp.json()
  log.info('Successfully got signed blinded token')
  const base64SignedBlinded = data.data.SignedBlindedToken
  const signedBlindedToken = base64ToUint8Array(base64SignedBlinded)

  // 3. Unblind and finalize the signature
  // CRITICAL: Use the same token and blindResult.inv that were created at the start
  const finalSignature = await suite.finalize(publicKey, token, signedBlindedToken, blindResult.inv)

  // 4. Verify the final signature using the CryptoKey
  const isValid = await suite.verify(publicKey, finalSignature, token)

  if (isValid) {
    log.info('Signature is valid! The anonymous token is ready to use.')
    return {
      token: uint8ArrayToBase64(token),
      signedToken: uint8ArrayToBase64(finalSignature),
      isNew: true
    }
  } else {
    log.info('Signature verification failed.')
    throw new Error('Invalid signature.')
  }
}

export async function prefetchTokens(
  modelName: string,
  availableTokens: number = Infinity
): Promise<void> {
  try {
    const poolSize = await getTokenPoolSize(modelName)
    const tokensNeeded = TOKEN_POOL_SIZE - poolSize
    // Only prefetch up to the available tokens user has for this model
    const tokensToPrefetch = Math.min(tokensNeeded, availableTokens)

    if (tokensToPrefetch <= 0) {
      log.info('Token pool for', modelName, 'is full or no available tokens, skipping prefetch')
      return
    }

    log.info(
      'Prefetching',
      tokensToPrefetch,
      'tokens for model:',
      modelName,
      '(available:',
      availableTokens,
      ')'
    )

    // Generate tokens sequentially with small delays to avoid race conditions
    // and reduce server load
    for (let i = 0; i < tokensToPrefetch; i++) {
      try {
        const token = await generateSingleToken(modelName)
        await addTokenToPool(modelName, {
          token: token.token || '',
          signedToken: token.signedToken || ''
        })
        log.info('Prefetched token', i + 1, 'of', tokensToPrefetch, 'for model:', modelName)

        // Random jitter between token issuances to reduce timing-correlation attacks.
        // Tokens are pooled so the user never waits for this delay.
        if (i < tokensToPrefetch - 1) {
          const jitterMs = 5000 + Math.random() * 25000 // 5–30 seconds
          await new Promise((resolve) => setTimeout(resolve, jitterMs))
        }
      } catch (err) {
        log.error('Failed to prefetch token', i + 1, 'for model:', modelName, ':', err)
        // Continue with next token even if one fails
        // Add delay before retrying
        await new Promise((resolve) => setTimeout(resolve, 500))
      }
    }

    log.info('Prefetch completed for model:', modelName)
  } catch (err) {
    log.error('Prefetch failed for model:', modelName, ':', err)
  }
}

async function getCryptoKey(pem: string): Promise<CryptoKey> {
  const pemHeader = '-----BEGIN PUBLIC KEY-----'
  const pemFooter = '-----END PUBLIC KEY-----'
  const pemText = pem.substring(pemHeader.length, pem.length - pemFooter.length).trim()
  const binaryDerString = atob(pemText)
  const binaryDer = Uint8Array.from(binaryDerString, (c) => c.charCodeAt(0))

  return await crypto.subtle.importKey(
    'spki',
    binaryDer,
    {
      name: 'RSA-PSS',
      hash: 'SHA-384'
    },
    true, // extractable
    ['verify']
  )
}

export function uint8ArrayToBase64(buffer: Uint8Array): string {
  let binary = ''
  const bytes = [].slice.call(new Uint8Array(buffer))
  bytes.forEach((b) => (binary += String.fromCharCode(b)))
  return btoa(binary)
}

export function base64ToUint8Array(base64String: string): Uint8Array {
  return Uint8Array.from(atob(base64String), (c) => c.charCodeAt(0))
}
