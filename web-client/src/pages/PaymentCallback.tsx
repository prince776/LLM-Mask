import { useEffect } from 'react'
import { CheckCircle } from 'lucide-react'

export function PaymentCallback() {
  useEffect(() => {
    // Auto-close popup after a short delay so the user sees the success message
    const t = setTimeout(() => window.close(), 2500)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#161b27]">
      <div className="text-center px-8">
        <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-500/20 flex items-center justify-center mx-auto mb-5">
          <CheckCircle size={32} className="text-green-600 dark:text-green-400" />
        </div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Payment Complete</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Your credits have been added. This window will close automatically.
        </p>
      </div>
    </div>
  )
}
