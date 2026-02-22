import React, { useState, useRef, useEffect } from 'react'
import { Send, Loader2, Image as ImageIcon, X } from 'lucide-react'

interface ImageAttachment {
  name: string
  mime: string
  dataUrl: string
  size: number
}

interface ChatInputProps {
  onSendMessage: (payload: {
    text: string
    images?: ImageAttachment[]
    displayText?: string
  }) => void
  disabled?: boolean
  isLoading?: boolean
  disabledText?: string
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  disabled = false,
  isLoading = false,
  disabledText
}) => {
  const [message, setMessage] = useState('')
  const [attachments, setAttachments] = useState<ImageAttachment[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault()
    const hasContent = message.trim().length > 0 || attachments.length > 0
    if (!hasContent || disabled || isLoading) return

    const text = message.trim()
    const images = attachments

    const imageMarkdown = images.map((img) => `![image](${img.dataUrl})`).join('\n')
    const displayText = [text, imageMarkdown]
      .filter(Boolean)
      .join(text && imageMarkdown ? '\n\n' : '')

    onSendMessage({ text, images, displayText })
    setMessage('')
    setAttachments([])
  }

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
    }
  }, [message])

  const onPickFiles = (): void => fileInputRef.current?.click()

  const handleFiles = async (files: FileList | null): Promise<void> => {
    if (!files) return
    const newAttachments: ImageAttachment[] = []

    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue
      if (file.size > 5 * 1024 * 1024) continue
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = (err) => reject(err)
        reader.readAsDataURL(file)
      })
      newAttachments.push({ name: file.name, mime: file.type, dataUrl, size: file.size })
    }

    if (newAttachments.length) setAttachments((prev) => [...prev, ...newAttachments])
  }

  const onRemoveAttachment = (idx: number): void => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx))
  }

  const onPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>): void => {
    const items = e.clipboardData?.items
    if (!items) return
    const files: File[] = []
    for (const item of Array.from(items)) {
      if (item.kind === 'file') {
        const file = item.getAsFile()
        if (file && file.type.startsWith('image/')) files.push(file)
      }
    }
    if (files.length) {
      e.preventDefault()
      const dt = new DataTransfer()
      files.forEach((f) => dt.items.add(f))
      handleFiles(dt.files)
    }
  }

  const onDrop = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault()
    handleFiles(e.dataTransfer?.files || null)
  }

  const onDragOver = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault()
  }

  const canSend = (message.trim().length > 0 || attachments.length > 0) && !disabled && !isLoading

  return (
    <form
      onSubmit={handleSubmit}
      className="px-4 pb-4 pt-3 bg-white dark:bg-[#161b27] border-t border-gray-100 dark:border-white/[0.06]"
    >
      <div className="max-w-3xl mx-auto">
        {/* Attachment previews */}
        {attachments.length > 0 && (
          <div className="flex gap-2 mb-2 flex-wrap">
            {attachments.map((att, idx) => (
              <div
                key={`${att.name}-${idx}`}
                className="relative w-14 h-14 rounded-xl overflow-hidden border border-gray-200 dark:border-white/10 shadow-sm"
              >
                <img src={att.dataUrl} alt={att.name} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => onRemoveAttachment(idx)}
                  className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-gray-900 text-white rounded-full flex items-center justify-center shadow"
                  title="Remove"
                >
                  <X size={9} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div
          className={`relative flex items-end gap-2 bg-gray-50 dark:bg-white/[0.04] rounded-2xl border transition-all duration-150 ${
            disabled || isLoading
              ? 'border-gray-100 dark:border-white/[0.04] opacity-60'
              : 'border-gray-200 dark:border-white/[0.08] focus-within:border-blue-500/50 dark:focus-within:border-blue-500/30 focus-within:shadow-[0_0_0_3px_rgba(59,130,246,0.08)]'
          }`}
          onDrop={onDrop}
          onDragOver={onDragOver}
        >
          {/* Attach button */}
          <button
            type="button"
            onClick={onPickFiles}
            disabled={disabled || isLoading}
            className="p-3 text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-400 transition-colors flex-shrink-0 disabled:cursor-not-allowed"
            title="Attach image"
          >
            <ImageIcon size={17} />
          </button>

          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={onPaste}
            placeholder={disabled && disabledText ? disabledText : 'Message LLMTor...'}
            disabled={disabled || isLoading}
            rows={1}
            className="flex-1 py-3 pr-1 bg-transparent text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none resize-none text-sm leading-relaxed scrollbar-hide disabled:cursor-not-allowed"
            style={{ minHeight: '44px', maxHeight: '200px' }}
          />

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => handleFiles(e.target.files)}
          />

          {/* Send button */}
          <div className="p-2 flex-shrink-0">
            <button
              type="submit"
              disabled={!canSend}
              className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-150 ${
                canSend
                  ? 'bg-blue-600 hover:bg-blue-700 text-white shadow shadow-blue-600/30'
                  : 'bg-gray-200 dark:bg-white/5 text-gray-400 dark:text-gray-600 cursor-not-allowed'
              }`}
            >
              {isLoading ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Send size={15} className={canSend ? '' : ''} />
              )}
            </button>
          </div>
        </div>

        <p className="text-center text-[11px] text-gray-300 dark:text-gray-600 mt-2">
          Enter to send · Shift+Enter for new line · Paste or drag images
        </p>
      </div>
    </form>
  )
}
