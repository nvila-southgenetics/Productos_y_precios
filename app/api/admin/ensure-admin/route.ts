import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

const ADMIN_EMAILS = ["nvila@southgenetics.com", "jrodriguez@southgenetics.com"]
const ALL_COUNTRIES = ["UY", "AR", "MX", "CL", "VE", "CO"]

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const admin = createAdminClient()

  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single()

  if (!profile) {
    const defaultRole = ADMIN_EMAILS.includes(user.email ?? "") ? "admin" : "user"
    await admin.from("profiles").insert({ id: user.id, email: user.email, role: defaultRole })
    if (defaultRole === "admin") {
      await admin.from("user_permissions").upsert(
        { user_id: user.id, role: "admin", allowed_countries: ALL_COUNTRIES },
        { onConflict: "user_id" }
      )
    }
    return NextResponse.json({ ok: true, role: defaultRole })
  }

  if (profile.role === "admin") {
    return NextResponse.json({ ok: true, role: "admin" })
  }

  if (ADMIN_EMAILS.includes(user.email ?? "")) {
    await admin.from("profiles").update({ role: "admin", updated_at: new Date().toISOString() }).eq("id", user.id)
    await admin.from("user_permissions").upsert(
      { user_id: user.id, role: "admin", allowed_countries: ALL_COUNTRIES },
      { onConflict: "user_id" }
    )
    return NextResponse.json({ ok: true, role: "admin" })
  }

  return NextResponse.json({ ok: true, role: "user" })
}
