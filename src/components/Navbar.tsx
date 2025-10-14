'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Settings, User, LogOut } from 'lucide-react'

export function Navbar() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      setLoading(false)
    }

    getUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <nav className="border-b border-pink-400 bg-gradient-to-r from-fuchsia-500 to-pink-500 backdrop-blur-sm shadow-lg">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 
              className="text-2xl font-bold font-heading text-white drop-shadow-md cursor-pointer hover:opacity-90 transition-opacity sparkle-float"
              onClick={() => router.push('/')}
            >
              SG Contadora ✨
            </h1>
            <div className="w-20 h-8 bg-white/20 rounded animate-pulse" />
          </div>
        </div>
      </nav>
    )
  }

  return (
    <nav className="border-b border-pink-400 bg-gradient-to-r from-fuchsia-500 to-pink-500 backdrop-blur-sm sticky top-0 z-40 shadow-lg">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <h1 
            className="text-2xl font-bold font-heading text-white drop-shadow-md cursor-pointer hover:opacity-90 transition-opacity sparkle-float"
            onClick={() => router.push('/')}
          >
            SG Contadora ✨
          </h1>
          
          {user ? (
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => router.push('/settings')}
                className="flex items-center gap-2 text-white hover:bg-white/20 hover:text-white"
              >
                <Settings className="w-4 h-4" />
                Configuración
              </Button>
              <Button 
                onClick={handleSignOut} 
                className="flex items-center gap-2 bg-white text-fuchsia-600 hover:bg-fuchsia-100 hover:text-fuchsia-700 border-0"
              >
                <LogOut className="w-4 h-4" />
                Cerrar Sesión
              </Button>
            </div>
          ) : (
            <Button 
              onClick={() => router.push('/login')}
              className="bg-white text-fuchsia-600 hover:bg-white/90"
            >
              Iniciar Sesión
            </Button>
          )}
        </div>
      </div>
    </nav>
  )
}
