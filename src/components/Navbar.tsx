'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Settings, User, LogOut, BarChart3, FlaskConical, Home } from 'lucide-react'

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
      <nav className="border-b border-gray-200 bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 
              className="text-2xl font-semibold text-blue-600 cursor-pointer hover:text-blue-700 transition-colors"
              onClick={() => router.push('/')}
            >
              SouthGenetics P&L
            </h1>
            <div className="w-20 h-8 bg-gray-100 rounded animate-pulse" />
          </div>
        </div>
      </nav>
    )
  }

  return (
    <nav className="border-b border-gray-200 bg-white shadow-sm sticky top-0 z-40">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <h1 
            className="text-2xl font-semibold text-blue-600 cursor-pointer hover:text-blue-700 transition-colors"
            onClick={() => router.push('/')}
          >
            SouthGenetics P&L
          </h1>
          
          {user ? (
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => router.push('/products')}
                className="flex items-center gap-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50"
              >
                <Home className="w-4 h-4" />
                Inicio
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => router.push('/metrics')}
                className="flex items-center gap-2 text-gray-600 hover:text-orange-600 hover:bg-orange-50"
              >
                <BarChart3 className="w-4 h-4" />
                Métricas
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => router.push('/simulacro')}
                className="flex items-center gap-2 text-gray-600 hover:text-purple-600 hover:bg-purple-50"
              >
                <FlaskConical className="w-4 h-4" />
                Simulacro
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => router.push('/settings')}
                className="flex items-center gap-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50"
              >
                <Settings className="w-4 h-4" />
                Configuración
              </Button>
              <Button 
                onClick={handleSignOut} 
                className="flex items-center gap-2 bg-red-600 text-white hover:bg-red-700"
              >
                <LogOut className="w-4 h-4" />
                Cerrar Sesión
              </Button>
            </div>
          ) : (
            <Button 
              onClick={() => router.push('/login')}
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              Iniciar Sesión
            </Button>
          )}
        </div>
      </div>
    </nav>
  )
}
