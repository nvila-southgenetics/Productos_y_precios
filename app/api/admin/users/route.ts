import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import type { UserRole } from "@/lib/auth-constants"

const ROLES: UserRole[] = ["admin", "editor", "viewer"]
const COUNTRY_CODES = ["UY", "AR", "MX", "CL", "VE", "CO"]

async function getCallerRole(userId: string): Promise<string | null> {
  const admin = createAdminClient()
  const { data } = await admin.from("profiles").select("role").eq("id", userId).single()
  return data?.role ?? null
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const role = await getCallerRole(user.id)
  if (role !== "admin") return NextResponse.json({ error: "Solo administradores" }, { status: 403 })

  const admin = createAdminClient()
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 500 })
  const users = list?.users ?? []

  const { data: permissions } = await admin
    .from("user_permissions")
    .select("user_id, role, allowed_countries")

  const permByUser = new Map(
    (permissions ?? []).map((p: { user_id: string; role: string; allowed_countries: string[] }) => [
      p.user_id,
      { role: p.role, allowed_countries: p.allowed_countries ?? [] },
    ])
  )

  const result = users.map((u) => ({
    id: u.id,
    email: u.email,
    created_at: u.created_at,
    ...permByUser.get(u.id),
  }))

  return NextResponse.json(result)
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const role = await getCallerRole(user.id)
  if (role !== "admin") return NextResponse.json({ error: "Solo administradores" }, { status: 403 })

  let body: { user_id: string; role: UserRole; allowed_countries: string[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Body JSON inválido" }, { status: 400 })
  }

  const { user_id, role: newRole, allowed_countries } = body
  if (!user_id) return NextResponse.json({ error: "user_id requerido" }, { status: 400 })
  if (!ROLES.includes(newRole)) return NextResponse.json({ error: "Rol inválido" }, { status: 400 })

  const countries = Array.isArray(allowed_countries)
    ? allowed_countries.filter((c) => COUNTRY_CODES.includes(c))
    : []

  const admin = createAdminClient()

  const { error: permError } = await admin.from("user_permissions").upsert(
    { user_id, role: newRole, allowed_countries: newRole === "admin" ? COUNTRY_CODES : countries },
    { onConflict: "user_id" }
  )
  if (permError) return NextResponse.json({ error: permError.message }, { status: 500 })

  await admin.from("profiles").upsert(
    { id: user_id, role: newRole === "admin" ? "admin" : "user", updated_at: new Date().toISOString() },
    { onConflict: "id" }
  )

  return NextResponse.json({ ok: true, message: "Permisos actualizados" })
}
