'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { InterfacePreferences, NotificationPreferences, Profile } from '@/types'

export function useUserPreferences() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [interfacePrefs, setInterfacePrefs] = useState<InterfacePreferences>({
    theme: 'pink',
    language: 'es',
    currency: 'USD',
    dateFormat: 'DD/MM/YYYY',
    numberFormat: 'US',
    dashboardLayout: 'grid',
    showCountryFlags: true,
    compactMode: false,
    accentColor: 'rose',
    sidebarCollapsed: false
  })
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences>({
    emailNotifications: true,
    desktopNotifications: true,
    priceChangeAlerts: true,
    newProductAlerts: true,
    weeklyReports: false
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadUserProfile()
  }, [])

  const loadUserProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (error) throw error

      setProfile(data)
      
      // Cargar preferencias de interfaz
      if (data.interface_preferences) {
        setInterfacePrefs(data.interface_preferences as InterfacePreferences)
      }
      
      // Cargar preferencias de notificaciones
      if (data.notification_preferences) {
        setNotificationPrefs(data.notification_preferences as NotificationPreferences)
      }
    } catch (error) {
      console.error('Error loading user profile:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateInterfacePreferences = async (newPrefs: Partial<InterfacePreferences>) => {
    if (!profile) return

    const updatedPrefs = { ...interfacePrefs, ...newPrefs }
    setInterfacePrefs(updatedPrefs)

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ interface_preferences: updatedPrefs })
        .eq('id', profile.id)

      if (error) throw error
    } catch (error) {
      console.error('Error updating interface preferences:', error)
      // Revertir cambios en caso de error
      setInterfacePrefs(interfacePrefs)
    }
  }

  const updateNotificationPreferences = async (newPrefs: Partial<NotificationPreferences>) => {
    if (!profile) return

    const updatedPrefs = { ...notificationPrefs, ...newPrefs }
    setNotificationPrefs(updatedPrefs)

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ notification_preferences: updatedPrefs })
        .eq('id', profile.id)

      if (error) throw error
    } catch (error) {
      console.error('Error updating notification preferences:', error)
      // Revertir cambios en caso de error
      setNotificationPrefs(notificationPrefs)
    }
  }

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!profile) return

    try {
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', profile.id)
        .select()
        .single()

      if (error) throw error

      setProfile(data)
      return data
    } catch (error) {
      console.error('Error updating profile:', error)
      throw error
    }
  }

  return {
    profile,
    interfacePrefs,
    notificationPrefs,
    loading,
    updateInterfacePreferences,
    updateNotificationPreferences,
    updateProfile,
    refreshProfile: loadUserProfile
  }
}










