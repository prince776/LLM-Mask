import OpenAI from 'openai'
import { LLMProxyReq, LLMProxyResp } from '../types/ipc'
import { SERVER_URL } from '../types/config'
import { ChatCompletion } from 'openai/src/resources/chat/completions/completions'
import log from 'electron-log/main'

export async function LLMProxy(req: LLMProxyReq): Promise<LLMProxyResp> {
  const { token, signedToken, modelName } = req
  const reqPath = `${SERVER_URL}/api/v1/llm-proxy`
  const openai = new OpenAI({
    apiKey: '', // will be populated at out server.
    baseURL: reqPath
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

// TODO: Error handling at all the places.
