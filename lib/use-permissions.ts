"use client"

import { useEffect, useState } from "react"

export interface PermissionsState {
  userId: string
  email: string | null
  isAdmin: boolean
  canEdit: boolean
  allowedCountries: string[]
  loading: boolean
  error: string | null
}

export function usePermissions(): PermissionsState {
  const [state, setState] = useState<PermissionsState>({
    userId: "",
    email: null,
    isAdmin: false,
    canEdit: false,
    allowedCountries: [],
    loading: true,
    error: null,
  })

  useEffect(() => {
    let cancelled = false
    fetch("/api/auth/me")
      .then((res) => {
        if (cancelled) return
        if (!res.ok) {
          setState((s) => ({
            ...s,
            loading: false,
            error: res.status === 401 ? null : "Error al cargar permisos",
          }))
          return
        }
        return res.json()
      })
      .then((data) => {
        if (cancelled || !data) return
        setState({
          userId: data.userId ?? "",
          email: data.email ?? null,
          isAdmin: data.isAdmin ?? false,
          canEdit: data.canEdit ?? false,
          allowedCountries: Array.isArray(data.allowedCountries) ? data.allowedCountries : [],
          loading: false,
          error: null,
        })
      })
      .catch(() => {
        if (!cancelled) {
          setState((s) => ({ ...s, loading: false, error: "Error al cargar permisos" }))
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  return state
}
