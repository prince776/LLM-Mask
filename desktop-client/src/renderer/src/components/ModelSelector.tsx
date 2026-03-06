import React, { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { availableModels } from '../data/models'

interface ModelSelectorProps {
  selectedModel: string
  onModelSelect: (modelId: string) => void
  numActiveToken?: Record<string, number>
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  selectedModel,
  onModelSelect,
  numActiveToken
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const selectedModelData = availableModels.find((model) => model.id === selectedModel)
  const activeTokens = numActiveToken?.[selectedModel] ?? null

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const providerColor = (provider?: string) => {
    if (provider === 'Google') return 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300'
    if (provider === 'OpenAI') return 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
    return 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400'
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 px-3 py-2 bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-xl hover:bg-gray-100 dark:hover:bg-white/[0.07] transition-all duration-150 min-w-[200px]"
      >
        <div className="flex flex-col items-start min-w-0 flex-1">
          <span className="text-[13px] font-semibold text-gray-800 dark:text-gray-100 truncate leading-snug">
            {selectedModelData?.name || 'Select Model'}
          </span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span
              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${providerColor(selectedModelData?.provider)}`}
            >
              {selectedModelData?.provider}
            </span>
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
              {activeTokens ?? 0} credits
            </span>
          </div>
        </div>
        <ChevronDown
          size={14}
          className={`text-gray-400 flex-shrink-0 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-1.5 bg-white dark:bg-[#1e2535] border border-gray-200 dark:border-white/[0.08] rounded-2xl shadow-xl dark:shadow-black/40 z-50 overflow-hidden min-w-[280px]">
          <div className="max-h-80 overflow-y-auto scrollbar-hide">
            {/* Group by provider */}
            {['OpenAI', 'Google'].map((provider) => {
              const providerModels = availableModels.filter((m) => m.provider === provider)
              return (
                <div key={provider}>
                  <div className="px-3 pt-3 pb-1">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md ${providerColor(provider)}`}
                    >
                      {provider}
                    </span>
                  </div>
                  {providerModels.map((model) => {
                    const tokensLeft = numActiveToken?.[model.id] ?? 0
                    const isSelected = selectedModel === model.id
                    return (
                      <button
                        key={model.id}
                        onClick={() => {
                          onModelSelect(model.id)
                          setIsOpen(false)
                        }}
                        className={`w-full px-3 py-2.5 text-left flex items-center justify-between gap-3 transition-colors ${
                          isSelected
                            ? 'bg-blue-50 dark:bg-blue-500/10'
                            : 'hover:bg-gray-50 dark:hover:bg-white/[0.04]'
                        }`}
                      >
                        <div className="flex flex-col min-w-0">
                          <span
                            className={`text-[13px] font-semibold leading-snug ${isSelected ? 'text-blue-700 dark:text-blue-300' : 'text-gray-800 dark:text-gray-100'}`}
                          >
                            {model.name}
                          </span>
                          <span className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5 truncate">
                            {model.description}
                          </span>
                          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
                            {tokensLeft} credits
                          </span>
                        </div>
                        {isSelected && (
                          <Check size={14} className="text-blue-600 dark:text-blue-400 flex-shrink-0" />
                        )}
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
