// Simple in-memory cache for profile pictures (pfp) in the renderer process
const pfpCache = new Map<string, string>()

// Mutex map to prevent concurrent fetches for the same URL
const pfpMutex = new Map<string, Promise<string>>()

export async function fetchPfpWithCache(url: string): Promise<string> {
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

// Cached fetch utility for model pricing catalogue
export async function fetchWithCache(url: string, ttlMs: number) {
  const cacheKey = `cache_${url}`
  const cached = localStorage.getItem(cacheKey)
  if (cached) {
    const { data, timestamp } = JSON.parse(cached)
    if (Date.now() - timestamp < ttlMs) {
      return data
    }
  }
  const resp = await fetch(url)
  if (!resp.ok) throw new Error('Failed to fetch: ' + url)
  const data = await resp.json()
  localStorage.setItem(cacheKey, JSON.stringify({ data, timestamp: Date.now() }))
  return data
}
