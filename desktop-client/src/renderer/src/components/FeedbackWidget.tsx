import { useState, useEffect, useRef } from 'react'
import { MessageCircle, X, Send } from 'lucide-react'
import { useUser } from '../contexts/UserContext'
import type { ThreadEntry } from '../../../types/ipc'

export function FeedbackWidget() {
  const [open, setOpen] = useState(false)
  const [entries, setEntries] = useState<ThreadEntry[]>([])
  const [inputText, setInputText] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const lastSeenCountRef = useRef(0)
  const { user } = useUser()

  const fetchEntries = async (): Promise<ThreadEntry[] | undefined> => {
    if (!user) return undefined
    try {
      const resp = await window.api.getFeedback()
      if (resp.error) {
        setError(resp.error)
        return undefined
      }
      const fetched = resp.entries ?? []
      setEntries(fetched)
      return fetched
    } catch (e: any) {
      setError(e?.message ?? 'Unknown error')
      return undefined
    }
  }

  // On open: load and mark all as seen
  useEffect(() => {
    if (!open || !user) return
    setLoading(true)
    fetchEntries()
      .then((fetched) => {
        if (fetched) {
          lastSeenCountRef.current = fetched.length
          setUnreadCount(0)
        }
      })
      .finally(() => setLoading(false))
  }, [open, user])

  // Scroll to bottom when entries change while open
  useEffect(() => {
    if (open && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [entries, open])

  // Poll for new admin replies while closed
  useEffect(() => {
    if (!user) return
    const poll = async () => {
      if (open) return
      const resp = await window.api.getFeedback().catch(() => null)
      if (!resp || resp.error) return
      const fetched = resp.entries ?? []
      const adminCount = fetched.filter((e) => e.Role === 'admin').length
      const seenAdminCount = entries.filter((e) => e.Role === 'admin').length
      if (adminCount > seenAdminCount) {
        setEntries(fetched)
        setUnreadCount(adminCount - Math.max(seenAdminCount, lastSeenCountRef.current - (entries.length - seenAdminCount)))
      }
    }
    const interval = setInterval(poll, 30000)
    return () => clearInterval(interval)
  }, [user, open, entries])

  const handleSend = async () => {
    const text = inputText.trim()
    if (!text || sending) return
    setSending(true)
    setError(null)

    // Optimistic entry
    const optimistic: ThreadEntry = {
      Role: 'user',
      Content: text,
      CreatedAt: new Date().toISOString()
    }
    setEntries((prev) => [...prev, optimistic])
    setInputText('')

    try {
      const resp = await window.api.sendFeedback({ message: text })
      if (resp.error) {
        setError(resp.error)
        setEntries((prev) => prev.filter((e) => e !== optimistic))
        setInputText(text)
      } else {
        // Refresh to get server-stamped entry
        const fetched = await fetchEntries()
        if (fetched) lastSeenCountRef.current = fetched.length
      }
    } catch (e: any) {
      setError(e?.message ?? 'Unknown error')
      setEntries((prev) => prev.filter((e) => e !== optimistic))
      setInputText(text)
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleOpen = () => {
    setOpen((v) => !v)
    if (!open) setUnreadCount(0)
  }

  return (
    <>
      {open && (
        <div
          className="fixed bottom-20 right-6 w-80 z-50 flex flex-col rounded-2xl shadow-2xl border border-gray-100 dark:border-white/[0.06] bg-white dark:bg-[#1c2333] overflow-hidden"
          style={{ height: '24rem' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-white/[0.06] flex-shrink-0">
            <span className="text-sm font-semibold text-gray-900 dark:text-white">
              Feedback &amp; Support
            </span>
            <button
              onClick={() => setOpen(false)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 min-h-0">
            {!user ? (
              <p className="text-sm text-gray-400 dark:text-gray-500 text-center mt-10">
                Sign in to send feedback
              </p>
            ) : loading ? (
              <p className="text-sm text-gray-400 dark:text-gray-500 text-center mt-10">
                Loading...
              </p>
            ) : entries.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500 text-center mt-10">
                Send us a message
              </p>
            ) : (
              entries.map((entry, i) =>
                entry.Role === 'user' ? (
                  <div key={i} className="flex justify-end">
                    <div className="max-w-[85%] bg-blue-500 text-white rounded-2xl rounded-tr-sm px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words">
                      {entry.Content}
                    </div>
                  </div>
                ) : (
                  <div key={i} className="flex justify-start">
                    <div className="max-w-[85%]">
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 ml-1 mb-0.5">
                        Support
                      </p>
                      <div className="bg-gray-100 dark:bg-white/[0.06] text-gray-800 dark:text-gray-200 rounded-2xl rounded-tl-sm px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words">
                        {entry.Content}
                      </div>
                    </div>
                  </div>
                )
              )
            )}
            {error && <p className="text-xs text-red-400 text-center pt-1">{error}</p>}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          {user && (
            <div className="flex items-end gap-2 px-3 py-3 border-t border-gray-100 dark:border-white/[0.06] flex-shrink-0">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message… (Enter to send)"
                disabled={sending}
                rows={1}
                className="flex-1 resize-none bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                style={{ minHeight: '36px', maxHeight: '80px' }}
              />
              <button
                onClick={handleSend}
                disabled={!inputText.trim() || sending}
                className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-xl bg-blue-500 hover:bg-blue-600 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Send size={15} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* FAB */}
      <button
        onClick={handleOpen}
        className="fixed bottom-6 right-6 z-50 w-12 h-12 flex items-center justify-center rounded-full bg-blue-500 hover:bg-blue-600 text-white shadow-lg shadow-blue-500/30 transition-all"
      >
        {open ? <X size={20} /> : <MessageCircle size={20} />}
        {!open && unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
    </>
  )
}
