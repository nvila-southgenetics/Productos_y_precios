import { NextResponse } from "next/server"
import { getCurrentUserPermissions } from "@/lib/auth-permissions"
import { createAdminClient } from "@/lib/supabase/admin"
import { filterCompaniesByCountries } from "@/lib/auth-constants"
import { fetchDistinctVentasCompanies } from "@/lib/ventas-companies"

export async function GET() {
  const perm = await getCurrentUserPermissions()
  if (!perm) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  try {
    const admin = createAdminClient()
    const all = await fetchDistinctVentasCompanies(admin)
    const filtered = filterCompaniesByCountries(all, perm.allowedCountries)
    return NextResponse.json(filtered)
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error al cargar compañías"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
