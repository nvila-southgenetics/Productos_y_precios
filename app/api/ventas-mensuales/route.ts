import { NextResponse } from "next/server"
import { getCurrentUserPermissions } from "@/lib/auth-permissions"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  fetchVentasAggregatesServer,
  filterRowsByAllowedCountries,
} from "@/lib/ventas-data"
import type { VentasMensualRow } from "@/lib/pl-ventas-fetch"

/** Compat: delega a get_ventas_mensuales_agg. Preferir /api/ventas-data. */
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
      : undefined

  try {
    const admin = createAdminClient()
    let rows = await fetchVentasAggregatesServer(admin, { years: [year], companies })
    if (!perm.isAdmin) {
      rows = filterRowsByAllowedCountries(rows, perm.allowedCountries)
    }
    const payload: VentasMensualRow[] = rows.map((r) => ({
      producto: r.producto,
      mes: r.mes,
      cantidad_ventas: r.cantidad_ventas,
      monto_total: r.monto_total,
      compañia: r.compañia,
    }))
    return NextResponse.json(payload)
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error al cargar ventas"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
