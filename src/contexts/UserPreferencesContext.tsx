'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { useUserPreferences } from '@/hooks/useUserPreferences'
import { InterfacePreferences } from '@/types'
import { supabase } from '@/lib/supabase'

interface UserPreferencesContextType {
  interfacePrefs: InterfacePreferences
  updateInterfacePreferences: (prefs: Partial<InterfacePreferences>) => Promise<void>
}

const UserPreferencesContext = createContext<UserPreferencesContextType | undefined>(undefined)

export function UserPreferencesProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  
  // Solo usar el hook si el usuario está autenticado
  const userPrefs = useUserPreferences()
  const { interfacePrefs, updateInterfacePreferences } = isAuthenticated ? userPrefs : {
    interfacePrefs: {
      theme: 'pink' as const,
      language: 'es' as const,
      currency: 'USD' as const,
      dateFormat: 'DD/MM/YYYY' as const,
      numberFormat: 'US' as const,
      dashboardLayout: 'grid' as const,
      showCountryFlags: true,
      compactMode: false,
      accentColor: 'rose' as const,
      sidebarCollapsed: false
    },
    updateInterfacePreferences: async () => {}
  }

  // Verificar autenticación
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setIsAuthenticated(!!session)
      setIsCheckingAuth(false)
    }
    
    checkAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setIsAuthenticated(!!session)
      setIsCheckingAuth(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Aplicar preferencias de tema al documento solo si está autenticado
  useEffect(() => {
    if (!isAuthenticated) return
    
    const root = document.documentElement
    
    // Aplicar tema de color
    root.setAttribute('data-theme', interfacePrefs.theme)
    
    // Aplicar color de acento
    root.setAttribute('data-accent', interfacePrefs.accentColor)
    
    // Aplicar modo compacto
    if (interfacePrefs.compactMode) {
      root.classList.add('compact-mode')
    } else {
      root.classList.remove('compact-mode')
    }
    
    // Aplicar sidebar colapsado
    if (interfacePrefs.sidebarCollapsed) {
      root.classList.add('sidebar-collapsed')
    } else {
      root.classList.remove('sidebar-collapsed')
    }
  }, [interfacePrefs, isAuthenticated])

  // Mostrar loading mientras verifica autenticación
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-rose-50 to-pink-100">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-500"></div>
      </div>
    )
  }

  return (
    <UserPreferencesContext.Provider value={{ interfacePrefs, updateInterfacePreferences }}>
      {children}
    </UserPreferencesContext.Provider>
  )
}

export function useUserPreferencesContext() {
  const context = useContext(UserPreferencesContext)
  if (context === undefined) {
    throw new Error('useUserPreferencesContext must be used within a UserPreferencesProvider')
  }
  return context
}
