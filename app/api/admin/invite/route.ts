import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import type { UserRole } from "@/lib/auth-constants"

const ROLES: UserRole[] = ["admin", "editor", "viewer"]
const COUNTRY_CODES = ["UY", "AR", "MX", "CL", "VE", "CO"]

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single()
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Solo un administrador puede invitar usuarios" }, { status: 403 })
  }

  let body: { email: string; role: UserRole; allowed_countries: string[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Body JSON inválido" }, { status: 400 })
  }

  const { email, role, allowed_countries } = body
  if (!email || typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "Email inválido" }, { status: 400 })
  }
  if (!ROLES.includes(role)) {
    return NextResponse.json({ error: "Rol inválido" }, { status: 400 })
  }
  const countries = Array.isArray(allowed_countries)
    ? allowed_countries.filter((c) => COUNTRY_CODES.includes(c))
    : []

  const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${request.headers.get("origin") ?? ""}/login`,
  })

  if (inviteError) {
    if (inviteError.message?.includes("already been registered")) {
      return NextResponse.json({ error: "Ese email ya está registrado" }, { status: 409 })
    }
    return NextResponse.json({ error: inviteError.message }, { status: 400 })
  }

  const invitedUserId = inviteData?.user?.id
  if (!invitedUserId) {
    return NextResponse.json({ error: "No se pudo crear el usuario" }, { status: 500 })
  }

  const { error: permError } = await admin.from("user_permissions").insert({
    user_id: invitedUserId,
    role,
    allowed_countries: role === "admin" ? COUNTRY_CODES : countries,
    invited_by: user.id,
  })
  if (permError) return NextResponse.json({ error: permError.message }, { status: 500 })

  await admin.from("profiles").upsert(
    { id: invitedUserId, role: role === "admin" ? "admin" : "user", updated_at: new Date().toISOString() },
    { onConflict: "id" }
  )

  return NextResponse.json({
    ok: true,
    message: "Invitación enviada por email. El usuario debe aceptar el enlace para entrar.",
  })
}
