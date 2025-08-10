import OpenAI from 'openai'
import { LLMProxyReq, LLMProxyResp } from '../types/ipc'
import { SERVER_URL } from '../types/config'

export async function LLMProxy(req: LLMProxyReq): Promise<LLMProxyResp> {
  const { token, signedToken, modelName } = req
  const reqPath = `${SERVER_URL}/api/v1/llm-proxy`
  const openai = new OpenAI({
    apiKey: '', // will be populated at out server.
    baseURL: reqPath
  })

  try {
    // Make a request to the OpenAI API using the provided model name
    const response = await openai.chat.completions.create(
      {
        model: modelName,
        messages: [{ role: 'user', content: 'Hey who are you?' }],
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

    return {
      data: response,
      error: null
    }
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}
