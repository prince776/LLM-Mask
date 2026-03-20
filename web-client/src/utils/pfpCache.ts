const pfpCache = new Map<string, string>()
const pfpMutex = new Map<string, Promise<string>>()

export async function fetchPfpWithCache(url: string): Promise<string> {
  if (pfpCache.has(url)) return pfpCache.get(url)!
  if (pfpMutex.has(url)) return pfpMutex.get(url)!

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

export async function fetchWithCache(url: string, ttlMs: number) {
  const cacheKey = `cache_${url}`
  const cached = localStorage.getItem(cacheKey)
  if (cached) {
    const { data, timestamp } = JSON.parse(cached)
    if (Date.now() - timestamp < ttlMs) return data
  }
  const resp = await fetch(url, { credentials: 'include' })
  if (!resp.ok) throw new Error('Failed to fetch: ' + url)
  const data = await resp.json()
  localStorage.setItem(cacheKey, JSON.stringify({ data, timestamp: Date.now() }))
  return data
}
