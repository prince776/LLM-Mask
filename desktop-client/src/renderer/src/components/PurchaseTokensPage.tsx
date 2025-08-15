import React, { useState, useEffect } from 'react'
import { ArrowLeft, CreditCard, Check, Star, Zap, Shield, Clock } from 'lucide-react'
import { availableModels } from '../data/models'
import { TokenPackage } from '../types'
import { useUser } from '../contexts/UserContext'
import { fetchWithCache } from '../utils/pfpCache'
import { SERVER_URL } from '../config'

interface PurchaseTokensPageProps {
  onBack: () => void
}

export const PurchaseTokensPage: React.FC<PurchaseTokensPageProps> = ({ onBack }) => {
  const [selectedModel, setSelectedModel] = useState<string>('all')
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const { user } = useUser()
  const [packages, setPackages] = useState<TokenPackage[]>([])

  useEffect(() => {
    fetchWithCache(`${SERVER_URL}/api/v1/model-pricing`, 10000)
      .then((resp) => {
        console.log(resp.data)
        const data: { Packages: TokenPackage[] } = resp.data
        setPackages(data.Packages)
      })
      .catch(() => setPackages([]))
  }, [])

  console.log('packages: ', packages)
  const filteredPackages =
    selectedModel === 'all' ? packages : packages.filter((pkg) => pkg.ModelID === selectedModel)
  console.log('Filtered: ', filteredPackages)

  const groupedPackages = filteredPackages.reduce(
    (acc, pkg) => {
      if (!acc[pkg.ModelID]) {
        acc[pkg.ModelID] = []
      }
      acc[pkg.ModelID].push(pkg)
      return acc
    },
    {} as Record<string, TokenPackage[]>
  )

  const handlePurchase = async (packageId: string) => {
    setSelectedPackage(packageId)
    setIsProcessing(true)

    // Simulate payment processing
    setTimeout(() => {
      setIsProcessing(false)
      setSelectedPackage(null)
      // Show success message or redirect
      alert('Purchase successful! Tokens have been added to your account.')
    }, 2000)
  }

  const getModelInfo = (modelId: string) => {
    return availableModels.find((model) => model.id === modelId)
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900">
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={onBack}
            className="p-2 hover:bg-white dark:hover:bg-gray-800 rounded-lg transition-colors shadow-sm"
          >
            <ArrowLeft size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Purchase Tokens</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Buy request tokens for your favorite AI models
            </p>
          </div>
        </div>

        {/* Balances Section */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">
            Token Balances
          </h2>
          <div className="flex flex-wrap gap-4">
            {availableModels.map((model) => (
              <div
                key={model.id}
                className="bg-white dark:bg-gray-800 rounded-lg px-4 py-2 shadow border border-gray-200 dark:border-gray-700 flex flex-col min-w-[180px]"
              >
                <span className="font-medium text-gray-900 dark:text-white">{model.name}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">{model.provider}</span>
                <span className="text-sm mt-1 text-blue-600 dark:text-blue-400 font-semibold">
                  {user?.numActiveToken?.[model.id] ?? 0} tokens left
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Benefits Section */}
        <div className="bg-gray-100 dark:bg-gray-900/60 rounded-2xl p-6 mb-8 border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-200">
            Why Purchase Tokens?
          </h2>
          <p className="text-base text-gray-600 dark:text-gray-400">
            To truly access LLMs privately, the BlindRSA Algorithm requires pre-purchase of tokens,
            which can be later used, at any point of time. It's different, because it's real
          </p>
        </div>

        {/* Model Filter */}
        <div className="mb-8">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Filter by Model
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedModel('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedModel === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600'
              }`}
            >
              All Models
            </button>
            {availableModels.map((model) => (
              <button
                key={model.id}
                onClick={() => setSelectedModel(model.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedModel === model.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600'
                }`}
              >
                {model.name}
              </button>
            ))}
          </div>
        </div>

        {/* Token Packages */}
        <div className="space-y-8">
          {Object.entries(groupedPackages).map(([modelId, packages]) => {
            const modelInfo = getModelInfo(modelId)
            return (
              <div
                key={modelId}
                className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                    <Zap className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                      {modelInfo?.name}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 text-sm">
                      {modelInfo?.provider} • {modelInfo?.description}
                    </p>
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  {packages.map((pkg) => (
                    <div
                      key={pkg.ID}
                      className={`relative p-6 rounded-xl border-2 transition-all duration-200 hover:shadow-lg ${
                        pkg.Popular
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/10'
                          : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50'
                      }`}
                    >
                      {pkg.Popular && (
                        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                          <div className="bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1">
                            <Star size={12} />
                            Most Popular
                          </div>
                        </div>
                      )}

                      <div className="text-center mb-4">
                        <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
                          {pkg.Price}
                        </div>
                        <div className="text-gray-600 dark:text-gray-400 text-sm">
                          {pkg.Tokens.toLocaleString()} tokens
                        </div>
                        {/*<div className="text-xs text-gray-500 dark:text-gray-500 mt-1">*/}
                        {/*  ${((pkg.Price/ pkg.tokens) * 1000).toFixed(2)} per 1K tokens*/}
                        {/*</div>*/}
                      </div>

                      <div className="space-y-2 mb-6">
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                          <Check size={16} className="text-green-500" />
                          {pkg.Tokens.toLocaleString()} request tokens
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                          <Check size={16} className="text-green-500" />
                          No expiration date
                        </div>
                        {/*<div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">*/}
                        {/*  <Check size={16} className="text-green-500" />*/}
                        {/*/!*  Priority support*!/ LOOL*/}
                        {/*</div>*/}
                      </div>

                      <button
                        onClick={() => handlePurchase(pkg.ID)}
                        disabled={isProcessing && selectedPackage === pkg.ID}
                        className={`w-full py-3 px-4 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 ${
                          pkg.Popular
                            ? 'bg-blue-600 hover:bg-blue-700 text-white'
                            : 'bg-gray-900 dark:bg-gray-600 hover:bg-gray-800 dark:hover:bg-gray-500 text-white'
                        } ${
                          isProcessing && selectedPackage === pkg.ID
                            ? 'opacity-50 cursor-not-allowed'
                            : ''
                        }`}
                      >
                        {isProcessing && selectedPackage === pkg.ID ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <CreditCard size={16} />
                            Purchase Now
                          </>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* Payment Security */}
        <div className="mt-12 bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="w-6 h-6 text-green-500" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Secure Payment Processing
            </h3>
          </div>
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
            Your payment information is encrypted and processed securely. We use industry-standard
            SSL encryption and never store your credit card details on our servers.
          </p>
          <div className="flex items-center gap-6 text-xs text-gray-500 dark:text-gray-400">
            <div className="flex items-center gap-1">
              <Shield size={14} />
              SSL Encrypted
            </div>
            <div className="flex items-center gap-1">
              <Check size={14} />
              PCI Compliant
            </div>
            <div className="flex items-center gap-1">
              <CreditCard size={14} />
              Secure Checkout
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
