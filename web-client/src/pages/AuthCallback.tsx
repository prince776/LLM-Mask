import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser } from '../contexts/UserContext'

export function AuthCallback() {
  const navigate = useNavigate()
  const { refetchUser } = useUser()

  useEffect(() => {
    refetchUser().then(() => navigate('/', { replace: true }))
  }, [])

  return (
    <div className="flex items-center justify-center h-screen bg-[#0f1117]">
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-400 text-sm">Signing you in...</p>
      </div>
    </div>
  )
}
