import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { COUNTRY_CODES_LIST } from "@/lib/auth-constants"
import type { UserRole } from "@/lib/auth-constants"

export type { UserRole } from "@/lib/auth-constants"

export interface UserPermission {
  user_id: string
  role: UserRole
  allowed_countries: string[]
  invited_by: string | null
  created_at: string
}

/**
 * Obtiene los permisos del usuario actual (solo servidor).
 * Usa el cliente admin (service_role) para leer profiles y user_permissions,
 * evitando conflictos de RLS en el servidor.
 */
export async function getCurrentUserPermissions(): Promise<{
  userId: string
  email: string | null
  permission: UserPermission | null
  isAdmin: boolean
  canEdit: boolean
  allowedCountries: string[]
} | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminClient()

  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  const profileRole = (profile?.role as "user" | "admin" | undefined) ?? "user"
  const isAdmin = profileRole === "admin"

  const { data: permission } = await admin
    .from("user_permissions")
    .select("user_id, role, allowed_countries, invited_by, created_at")
    .eq("user_id", user.id)
    .single()

  const perm = permission as UserPermission | null
  const canEdit = isAdmin || perm?.role === "editor"
  const allowedCountries =
    isAdmin ? [...COUNTRY_CODES_LIST] : (perm?.allowed_countries ?? [])

  return {
    userId: user.id,
    email: user.email ?? null,
    permission: perm,
    isAdmin,
    canEdit,
    allowedCountries,
  }
}
