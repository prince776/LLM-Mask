import OpenAI from 'openai'
import { LLMProxyReq, LLMProxyResp } from '../types/ipc'
import { SERVER_URL } from '../types/config'
import { ChatCompletion } from 'openai/src/resources/chat/completions/completions'
import log from 'electron-log/main'
import { doTorProxiedRequest } from './torproxy'

export async function LLMProxy(req: LLMProxyReq): Promise<LLMProxyResp> {
  const { token, signedToken, modelName } = req
  const reqPath = `${SERVER_URL}/api/v1/llm-proxy`
  const openai = new OpenAI({
    apiKey: '', // will be populated at out server.
    baseURL: reqPath,
    fetch: torFetch // Use the custom fetch function
  })

  try {
    // Make a request to the OpenAI API using the provided model name
    log.info('Making LLM Proxy request with model:', modelName, 'and messages:', req.messages)
    const response = await openai.chat.completions.create(
      {
        model: modelName,
        messages: req.messages,
        // @ts-expect-error not part of the OpenAI types, but we need to send it as extra body.
        extra_body: {
          llmmask: {
            Token: token,
            SignedToken: signedToken,
            ModelName: modelName
          }
        }
      },
      {
        path: reqPath
      }
    )

    const proxyResp = response as unknown as {
      status: string
      data: {
        metadata: string
        proxy_response: string
        is_blocked: boolean
        blocked_reason?: string
      }
    }

    if (proxyResp.data.is_blocked) {
      log.warn('LLM Proxy request blocked:', proxyResp.data.blocked_reason)
      return {
        data: undefined,
        blocked: true,
        blockReason: proxyResp.data.blocked_reason || 'Blocked by LLM Proxy'
      }
    }

    log.info('proxyresp:', proxyResp)
    const respBase64 = proxyResp.data.proxy_response
    const respStr = Buffer.from(respBase64, 'base64').toString('binary')
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
