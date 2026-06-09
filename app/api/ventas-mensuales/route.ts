import { NextResponse } from "next/server"
import { getCurrentUserPermissions } from "@/lib/auth-permissions"
import { createAdminClient } from "@/lib/supabase/admin"
import { getCountryForCompany } from "@/lib/auth-constants"
import type { VentasMensualRow } from "@/lib/pl-ventas-fetch"

export async function GET(request: Request) {
  const perm = await getCurrentUserPermissions()
  if (!perm) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const year = Number(searchParams.get("year") ?? "2026")
  if (!Number.isFinite(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: "Año inválido" }, { status: 400 })
  }

  const companiesParam = searchParams.get("companies")
  const companies =
    companiesParam && companiesParam.trim()
      ? companiesParam.split(",").map((c) => c.trim()).filter(Boolean)
      : null

  try {
    const admin = createAdminClient()
    const { data, error } = await admin.rpc("get_ventas_mensuales_pl", {
      p_year: year,
      p_companies: companies,
    })
    if (error) throw error

    const rows = (data ?? []) as VentasMensualRow[]
    if (perm.isAdmin) return NextResponse.json(rows)

    const filtered = rows.filter((row) => {
      const country = getCountryForCompany(row.compañia)
      return !country || perm.allowedCountries.includes(country)
    })
    return NextResponse.json(filtered)
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error al cargar ventas"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
