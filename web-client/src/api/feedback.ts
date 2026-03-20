import { SERVER_URL } from '../config'
import { ThreadEntry } from '../types'

export async function getFeedback(): Promise<{ entries?: ThreadEntry[]; error?: string }> {
  try {
    const resp = await fetch(`${SERVER_URL}/api/v1/feedback`, { credentials: 'include' })
    if (!resp.ok) return { error: `Server error ${resp.status}` }
    const data = await resp.json()
    return { entries: data.data?.entries ?? data.data ?? [] }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

export async function sendFeedback(message: string): Promise<{ error?: string }> {
  try {
    const resp = await fetch(`${SERVER_URL}/api/v1/feedback`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ Message: message })
    })
    if (!resp.ok) return { error: `Server error ${resp.status}` }
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Unknown error' }
  }
}
