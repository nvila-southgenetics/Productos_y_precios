'use client'

export const dynamic = 'force-dynamic'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        router.push('/products')
      } else {
        router.push('/login')
      }
    }
    checkUser()
  }, [router])

  // Mostrar loading mientras verifica autenticación
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-rose-50 to-pink-100 bg-sparkles">
      <div className="flex flex-col items-center gap-4">
        <div className="text-4xl animate-pulse">✨</div>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500"></div>
        <div className="text-4xl animate-pulse" style={{ animationDelay: '0.5s' }}>💫</div>
      </div>
    </div>
  )
}
