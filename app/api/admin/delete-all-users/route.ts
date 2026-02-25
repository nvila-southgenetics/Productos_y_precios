import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single()
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Solo un administrador puede ejecutar esta acción" }, { status: 403 })
  }

  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const users = list?.users ?? []
  const toDelete = users.filter((u) => u.id !== user.id)

  for (const u of toDelete) {
    await admin.auth.admin.deleteUser(u.id)
  }

  await admin.from("user_permissions").delete().neq("user_id", user.id)

  return NextResponse.json({
    ok: true,
    deleted: toDelete.length,
    message: `Se eliminaron ${toDelete.length} usuario(s). Tu sesión se mantiene.`,
  })
}
