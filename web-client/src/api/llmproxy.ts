import { SERVER_URL } from '../config'
import { base64ToUint8Array } from './rsa'
import { getStoredAbuseTokens } from './abuse-token'

export interface LLMProxyReq {
  token: string
  signedToken: string
  modelName: string
  messages: Array<{ role: string; content: any }>
}

export interface LLMProxyResp {
  data?: any // ChatCompletion shape
  blocked?: boolean
  blockReason?: string
  sizeLimitExceeded?: boolean
  sizeLimitReason?: string
  abuseTokenExpired?: boolean
  abuseTokenInvalid?: boolean
  abuseTokenBlacklisted?: boolean
  error?: string
}

export async function llmProxy(req: LLMProxyReq): Promise<LLMProxyResp> {
  const { token, signedToken, modelName, messages } = req
  const abuseTokens = getStoredAbuseTokens()

  const body = {
    model: modelName,
    messages,
    extra_body: {
      llmmask: {
        Token: token,
        SignedToken: signedToken,
        ModelName: modelName,
        PermanentAbuseToken: abuseTokens?.permanentToken ?? '',
        PermanentAbuseTokenSig: abuseTokens?.permanentSig ?? '',
        TransientAbuseToken: abuseTokens?.transientToken ?? '',
        TransientAbuseTokenSig: abuseTokens?.transientSig ?? ''
      }
    }
  }

  try {
    const resp = await fetch(`${SERVER_URL}/api/v1/llm-proxy`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '')
      return { error: `Server error ${resp.status}: ${errText}` }
    }

    const outer = await resp.json()
    const proxyData = outer.data as {
      is_blocked: boolean
      blocked_reason?: string
      size_limit_exceeded?: boolean
      size_limit_reason?: string
      abuse_token_invalid?: boolean
      abuse_token_expired?: boolean
      abuse_token_blacklisted?: boolean
      proxy_response?: string
    }

    if (proxyData.abuse_token_expired) return { abuseTokenExpired: true }
    if (proxyData.abuse_token_invalid) return { abuseTokenInvalid: true }
    if (proxyData.abuse_token_blacklisted) return { abuseTokenBlacklisted: true }
    if (proxyData.is_blocked) {
      return { blocked: true, blockReason: proxyData.blocked_reason ?? 'Blocked by LLM Proxy' }
    }
    if (proxyData.size_limit_exceeded) {
      return {
        sizeLimitExceeded: true,
        sizeLimitReason:
          proxyData.size_limit_reason ?? 'Chat size limit exceeded. Please start a new conversation.'
      }
    }

    const respBase64 = proxyData.proxy_response ?? ''
    const respBytes = base64ToUint8Array(respBase64)
    const respStr = new TextDecoder().decode(respBytes)
    const chatCompletion = JSON.parse(respStr)

    return { data: chatCompletion }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unknown error' }
  }
}
