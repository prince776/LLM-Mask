// Simple in-memory cache for profile pictures (pfp) in the renderer process
const pfpCache = new Map<string, string>()

// Mutex map to prevent concurrent fetches for the same URL
const pfpMutex = new Map<string, Promise<string>>()

export async function fetchPfpWithCache(url: string): Promise<string> {
  console.log('requesting fetch' + crypto.randomUUID())
  if (pfpCache.has(url)) {
    return pfpCache.get(url)!
  }
  if (pfpMutex.has(url)) {
    // Wait for the ongoing fetch to complete
    return pfpMutex.get(url)!
  }
  // Start a new fetch and store the promise in the mutex
  const fetchPromise = (async () => {
    try {
      const resp = await fetch(url)
      if (!resp.ok) throw new Error('Failed to fetch pfp')
      console.log('requesting blob:', crypto.randomUUID())
      const blob = await resp.blob()
      const objectUrl = URL.createObjectURL(blob)
      pfpCache.set(url, objectUrl)
      return objectUrl
    } finally {
      pfpMutex.delete(url)
    }
  })()
  pfpMutex.set(url, fetchPromise)
  return fetchPromise
}
