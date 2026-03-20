import React, { useState, useEffect } from 'react'
import { ArrowLeft, CreditCard, Check, Star, Zap, Shield } from 'lucide-react'
import { availableModels } from '../data/models'
import { TokenPackage, LLMModel } from '../types'
import { useUser } from '../contexts/UserContext'
import { fetchWithCache } from '../utils/pfpCache'
import { SERVER_URL, WEB_APP_URL } from '../config'

interface PurchaseTokensPageProps {
  onBack: () => void
}

export const PurchaseTokensPage: React.FC<PurchaseTokensPageProps> = ({ onBack }) => {
  const [selectedModel, setSelectedModel] = useState<string>('all')
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const { user, refetchUser } = useUser()
  const [packages, setPackages] = useState<TokenPackage[]>([])

  useEffect(() => {
    fetchWithCache(`${SERVER_URL}/api/v1/model-pricing`, 5000)
      .then((resp) => {
        const data: { Packages: TokenPackage[] } = resp.data
        setPackages(data.Packages)
      })
      .catch(() => setPackages([]))
  }, [])

  const filteredPackages =
    selectedModel === 'all' ? packages : packages.filter((pkg) => pkg.ModelID === selectedModel)

  const groupedPackages = filteredPackages.reduce(
    (acc, pkg) => {
      if (!acc[pkg.ModelID]) acc[pkg.ModelID] = []
      acc[pkg.ModelID].push(pkg)
      return acc
    },
    {} as Record<string, TokenPackage[]>
  )

  const handlePurchase = async (packageId: string): Promise<void> => {
    setSelectedPackage(packageId)
    setIsProcessing(true)

    try {
      const res = await fetch(`${SERVER_URL}/api/v1/me`, {
        method: 'GET',
        credentials: 'include'
      })

      if (!res.ok) throw new Error('Failed to fetch user before purchase')

      const data = await res.json()
      const transientToken: string | undefined = data?.data?.TransientToken
      const userId: string | undefined = data?.data?.id

      const pkg = packages.find((p) => p.ID === packageId)
      const dodoProductID = pkg?.DodoProductID

      if (!transientToken || !userId || !dodoProductID) {
        throw new Error('Missing required purchase parameters')
      }

      const redirectURL = `${WEB_APP_URL}/payment/callback`
      const purchaseUrl = `${SERVER_URL}/api/v1/purchase?transientToken=${encodeURIComponent(transientToken)}&dodoProductID=${encodeURIComponent(dodoProductID)}&userID=${encodeURIComponent(userId)}&redirectURL=${encodeURIComponent(redirectURL)}`
      const popup = window.open(purchaseUrl, '_blank', 'width=600,height=700')

      if (popup) {
        const timer = setInterval(async () => {
          if (popup.closed) {
            clearInterval(timer)
            await refetchUser()
            setIsProcessing(false)
            setSelectedPackage(null)
          }
        }, 500)
      } else {
        // Popup was blocked — open in same tab as fallback
        window.location.href = purchaseUrl
      }
    } catch (e: unknown) {
      console.error('Purchase failed', e)
      const message = e instanceof Error ? e.message : String(e)
      alert('Purchase failed: ' + message)
      setIsProcessing(false)
      setSelectedPackage(null)
    }
  }

  const getModelInfo = (modelId: string): LLMModel | undefined => {
    return availableModels.find((model) => model.id === modelId)
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-[#161b27]">
      <div className="max-w-5xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-7">
          <button onClick={onBack} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors">
            <ArrowLeft size={18} className="text-gray-500 dark:text-gray-400" />
          </button>
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Purchase Credits</h1>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Buy anonymous request credits for AI models</p>
          </div>
        </div>

        {/* Balances */}
        <div className="bg-white dark:bg-white/[0.04] rounded-2xl p-5 mb-4 border border-gray-100 dark:border-white/[0.06]">
          <div className="flex items-center gap-2 mb-4">
            <Zap size={14} className="text-yellow-500" />
            <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Credit Balances</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {availableModels.map((model) => (
              <div key={model.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-white/[0.03] rounded-xl border border-gray-100 dark:border-white/[0.05]">
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold text-gray-800 dark:text-gray-100 truncate">{model.name}</p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500">{model.provider}</p>
                </div>
                <div className="text-right flex-shrink-0 ml-2">
                  <p className="text-base font-bold text-blue-600 dark:text-blue-400 leading-none">{user?.numActiveToken?.[model.id] ?? 0}</p>
                  <p className="text-[9px] text-gray-400 dark:text-gray-500 mt-0.5">credits</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Benefits */}
        <div className="bg-white dark:bg-white/[0.04] rounded-2xl p-5 mb-4 border border-gray-100 dark:border-white/[0.06]">
          <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
            Credits are pre-purchased for cryptographic unlinkability. Using blind RSA signatures, the server cannot link which credits you spent to any specific request — true privacy by design.
          </p>
        </div>

        {/* Model Filter */}
        <div className="mb-5">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedModel('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${selectedModel === 'all' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-white/[0.04] text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/[0.07] border border-gray-200 dark:border-white/[0.08]'}`}
            >
              All Models
            </button>
            {availableModels.map((model) => (
              <button
                key={model.id}
                onClick={() => setSelectedModel(model.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${selectedModel === model.id ? 'bg-blue-600 text-white' : 'bg-white dark:bg-white/[0.04] text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/[0.07] border border-gray-200 dark:border-white/[0.08]'}`}
              >
                {model.name}
              </button>
            ))}
          </div>
        </div>

        {/* Packages */}
        <div className="space-y-5">
          {Object.entries(groupedPackages).map(([modelId, pkgs]) => {
            const modelInfo = getModelInfo(modelId)
            return (
              <div key={modelId} className="bg-white dark:bg-white/[0.04] rounded-2xl p-5 border border-gray-100 dark:border-white/[0.06]">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Zap size={16} className="text-white" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{modelInfo?.name}</h3>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{modelInfo?.provider} · {modelInfo?.description}</p>
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-3">
                  {pkgs.map((pkg) => (
                    <div
                      key={pkg.ID}
                      className={`relative p-5 rounded-xl border-2 transition-all ${pkg.Popular ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10' : 'border-gray-100 dark:border-white/[0.06] bg-gray-50 dark:bg-white/[0.02]'}`}
                    >
                      {pkg.Popular && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                          <div className="bg-blue-600 text-white px-3 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1">
                            <Star size={10} />
                            Most Popular
                          </div>
                        </div>
                      )}

                      <div className="text-center mb-4">
                        <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{pkg.Price}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{pkg.Tokens.toLocaleString()} credits</div>
                      </div>

                      <div className="space-y-1.5 mb-4">
                        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                          <Check size={13} className="text-green-500 flex-shrink-0" />
                          {pkg.Tokens.toLocaleString()} request credits
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                          <Check size={13} className="text-green-500 flex-shrink-0" />
                          No expiration date
                        </div>
                      </div>

                      <button
                        onClick={() => handlePurchase(pkg.ID)}
                        disabled={isProcessing && selectedPackage === pkg.ID}
                        className={`w-full py-2.5 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${pkg.Popular ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-gray-900 dark:bg-white/[0.08] hover:bg-gray-800 dark:hover:bg-white/[0.12] text-white dark:text-gray-100'} ${isProcessing && selectedPackage === pkg.ID ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {isProcessing && selectedPackage === pkg.ID ? (
                          <>
                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <CreditCard size={14} />
                            Purchase
                          </>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}

          {Object.keys(groupedPackages).length === 0 && packages.length === 0 && (
            <div className="text-center py-12 text-gray-400 dark:text-gray-500 text-sm">Loading packages...</div>
          )}
        </div>

        {/* Payment Security */}
        <div className="mt-6 bg-white dark:bg-white/[0.04] rounded-2xl p-5 border border-gray-100 dark:border-white/[0.06]">
          <div className="flex items-center gap-2 mb-2">
            <Shield size={15} className="text-green-500" />
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Secure Payment</h3>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 leading-relaxed">
            Payments are processed securely. We never store payment card details on our servers. After purchase, credits are cryptographically unlinkable from your usage.
          </p>
        </div>
      </div>
    </div>
  )
}
