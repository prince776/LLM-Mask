import OpenAI from 'openai'
import { LLMProxyReq, LLMProxyResp } from '../types/ipc'
import { SERVER_URL } from '../types/config'
import { ChatCompletion } from 'openai/src/resources/chat/completions/completions'
import log from 'electron-log/main'
import { doTorProxiedRequest } from './torproxy'
import { getStore } from './local-store'
import { getStoredAbuseTokens } from './abuse-token'

export async function LLMProxy(req: LLMProxyReq): Promise<LLMProxyResp> {
  const { token, signedToken, modelName } = req
  const reqPath = `${SERVER_URL}/api/v1/llm-proxy`
  const openai = new OpenAI({
    apiKey: '', // will be populated at out server.
    baseURL: reqPath,
    fetch: torFetch // Use the custom fetch function
  })

  try {
    const localStore = getStore()
    // Make a request to the OpenAI API using the provided model name
    log.info('Making LLM Proxy request with model:', modelName)

    const abuseTokens = getStoredAbuseTokens()

    const response = await openai.chat.completions.create(
      {
        model: modelName,
        messages: req.messages,
        // @ts-expect-error not part of the OpenAI types, but we need to send it as extra body.
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
      },
      {
        path: reqPath
      }
    )

    localStore.delete(`tokens.${modelName}`)
    localStore.delete(`signedTokens.${modelName}`)

    const proxyResp = response as unknown as {
      status: string
      data: {
        metadata: string
        proxy_response: string
        is_blocked: boolean
        blocked_reason?: string
        size_limit_exceeded?: boolean
        size_limit_reason?: string
        abuse_token_invalid?: boolean
        abuse_token_expired?: boolean
        abuse_token_blacklisted?: boolean
      }
    }

    if (proxyResp.data.abuse_token_expired) {
      log.warn('Abuse token expired (transient token needs refresh)')
      return { data: undefined, abuseTokenExpired: true }
    }

    if (proxyResp.data.abuse_token_invalid) {
      log.warn('Abuse token invalid')
      return { data: undefined, abuseTokenInvalid: true }
    }

    if (proxyResp.data.abuse_token_blacklisted) {
      log.warn('Abuse token blacklisted')
      return { data: undefined, abuseTokenBlacklisted: true }
    }

    if (proxyResp.data.is_blocked) {
      log.warn('(╯°□°）╯︵ ┻━┻ LLM Proxy request blocked:', proxyResp.data.blocked_reason)
      return {
        data: undefined,
        blocked: true,
        blockReason: proxyResp.data.blocked_reason || 'Blocked by LLM Proxy'
      }
    }

    if (proxyResp.data.size_limit_exceeded) {
      log.warn('Chat size limit exceeded:', proxyResp.data.size_limit_reason)
      return {
        data: undefined,
        sizeLimitExceeded: true,
        sizeLimitReason:
          proxyResp.data.size_limit_reason ||
          'Chat size limit exceeded. Please start a new conversation.'
      }
    }

    const respBase64 = proxyResp.data.proxy_response
    const respStr = Buffer.from(respBase64, 'base64').toString('utf-8')
    const resp: ChatCompletion = JSON.parse(respStr)

    return {
      data: resp,
      error: undefined
    }
  } catch (error) {
    return {
      data: undefined,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

// 2. Create the custom fetch function
const torFetch = (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
  log.info('Using custom fetch to make proxied request via Tor.')
  let url
  if (typeof input === 'string' || input instanceof URL) {
    url = input.toString()
  } else {
    url = input.url
  }

  return doTorProxiedRequest(url, init)
}

// TODO: Error handling at all the places.
