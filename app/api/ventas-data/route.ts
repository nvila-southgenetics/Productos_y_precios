import { NextResponse } from "next/server"
import { getCurrentUserPermissions } from "@/lib/auth-permissions"
import { createAdminClient } from "@/lib/supabase/admin"
import { filterCompaniesByCountries } from "@/lib/auth-constants"
import {
  fetchDistinctPeriodsServer,
  fetchDistinctProductsServer,
  fetchVentasAggregatesServer,
  filterRowsByAllowedCountries,
  type VentasAggregateFilters,
} from "@/lib/ventas-data"
import { fetchDistinctVentasCompanies } from "@/lib/ventas-companies"

type Body =
  | { action: "aggregate"; filters: VentasAggregateFilters }
  | { action: "products"; years: number[] | null }
  | { action: "periods"; companies: string[] | null }
  | { action: "companies" }

export async function POST(request: Request) {
  const perm = await getCurrentUserPermissions()
  if (!perm) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  let body: Body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Body JSON inválido" }, { status: 400 })
  }

  try {
    const admin = createAdminClient()

    if (body.action === "companies") {
      const all = await fetchDistinctVentasCompanies(admin)
      const filtered = filterCompaniesByCountries(all, perm.allowedCountries)
      return NextResponse.json(filtered)
    }

    if (body.action === "products") {
      const years = Array.isArray(body.years) ? body.years : undefined
      const products = await fetchDistinctProductsServer(admin, years)
      return NextResponse.json(products)
    }

    if (body.action === "periods") {
      const companies = Array.isArray(body.companies) ? body.companies : undefined
      const periods = await fetchDistinctPeriodsServer(admin, companies)
      return NextResponse.json(periods)
    }

    if (body.action === "aggregate") {
      const filters = body.filters ?? {}
      let rows = await fetchVentasAggregatesServer(admin, filters)
      if (!perm.isAdmin) {
        rows = filterRowsByAllowedCountries(rows, perm.allowedCountries)
      }
      return NextResponse.json(rows)
    }

    return NextResponse.json({ error: "Acción inválida" }, { status: 400 })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error al cargar datos de ventas"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
