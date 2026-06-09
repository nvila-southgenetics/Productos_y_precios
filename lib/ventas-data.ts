import type { SupabaseClient } from "@supabase/supabase-js"
import { getCountryForCompany } from "@/lib/auth-constants"
import { fetchDistinctVentasCompanies } from "@/lib/ventas-companies"

export type VentasAggregateRow = {
  producto: string
  mes: number
  año: number
  periodo: string
  compañia: string
  cantidad_ventas: number
  monto_total: number
  precio_promedio: number | null
}

export interface VentasAggregateFilters {
  years?: number[]
  companies?: string[]
  products?: string[]
  periodo?: string
  monthFrom?: number
  monthTo?: number
  /** Atajo: filtra un solo mes (equivale a monthFrom = monthTo). */
  month?: number
}

function normalizeAggregateRow(row: Record<string, unknown>): VentasAggregateRow {
  return {
    producto: String(row.producto ?? ""),
    mes: Number(row.mes),
    año: Number(row.año),
    periodo: String(row.periodo ?? ""),
    compañia: String(row.compañia ?? ""),
    cantidad_ventas: Number(row.cantidad_ventas ?? 0),
    monto_total: Number(row.monto_total ?? 0),
    precio_promedio: row.precio_promedio == null ? null : Number(row.precio_promedio),
  }
}

function rpcFilters(filters: VentasAggregateFilters) {
  const monthFrom = filters.monthFrom ?? filters.month ?? null
  const monthTo = filters.monthTo ?? filters.month ?? null
  return {
    p_years: filters.years?.length ? filters.years : null,
    p_companies: filters.companies?.length ? filters.companies : null,
    p_products: filters.products?.length ? filters.products : null,
    p_periodo: filters.periodo ?? null,
    p_month_from: monthFrom,
    p_month_to: monthTo,
  }
}

export function filterRowsByAllowedCountries(
  rows: VentasAggregateRow[],
  allowedCountries: string[]
): VentasAggregateRow[] {
  if (!allowedCountries.length) return rows
  return rows.filter((row) => {
    const country = getCountryForCompany(row.compañia)
    return !country || allowedCountries.includes(country)
  })
}

export async function fetchVentasAggregatesServer(
  client: SupabaseClient,
  filters: VentasAggregateFilters
): Promise<VentasAggregateRow[]> {
  const { data, error } = await client.rpc("get_ventas_mensuales_agg", rpcFilters(filters))
  if (error) throw error
  return ((data ?? []) as Record<string, unknown>[]).map(normalizeAggregateRow)
}

export async function fetchDistinctProductsServer(
  client: SupabaseClient,
  years?: number[]
): Promise<string[]> {
  const { data, error } = await client.rpc("get_distinct_ventas_products", {
    p_years: years?.length ? years : null,
  })
  if (error) throw error
  return ((data ?? []) as string[]).map((p) => String(p).trim()).filter(Boolean)
}

export async function fetchDistinctPeriodsServer(
  client: SupabaseClient,
  companies?: string[]
): Promise<string[]> {
  const { data, error } = await client.rpc("get_distinct_ventas_periods", {
    p_companies: companies?.length ? companies : null,
  })
  if (error) throw error
  return ((data ?? []) as string[]).map((p) => String(p).trim()).filter(Boolean)
}

async function ventasDataRequest<T>(body: Record<string, unknown>): Promise<T> {
  const res = await fetch("/api/ventas-data", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(
      typeof err.error === "string" ? err.error : `Error ventas-data (${res.status})`
    )
  }
  return res.json()
}

/** Agregados mensuales de ventas. En browser usa API servidor; en servidor usa RPC directo. */
export async function fetchVentasAggregates(
  filters: VentasAggregateFilters
): Promise<VentasAggregateRow[]> {
  if (typeof window !== "undefined") {
    return ventasDataRequest<VentasAggregateRow[]>({ action: "aggregate", filters })
  }
  const { createAdminClient } = await import("./supabase/admin")
  return fetchVentasAggregatesServer(createAdminClient(), filters)
}

export async function getDistinctVentasProducts(years?: number[]): Promise<string[]> {
  if (typeof window !== "undefined") {
    return ventasDataRequest<string[]>({ action: "products", years: years ?? null })
  }
  const { createAdminClient } = await import("./supabase/admin")
  return fetchDistinctProductsServer(createAdminClient(), years)
}

export async function getDistinctVentasPeriods(companies?: string[]): Promise<string[]> {
  if (typeof window !== "undefined") {
    return ventasDataRequest<string[]>({ action: "periods", companies: companies ?? null })
  }
  const { createAdminClient } = await import("./supabase/admin")
  return fetchDistinctPeriodsServer(createAdminClient(), companies)
}

/** Compañías de ventas (wrapper unificado). */
export async function getVentasCompanies(): Promise<string[]> {
  if (typeof window !== "undefined") {
    const res = await fetch("/api/companies", { credentials: "include" })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(
        typeof body.error === "string" ? body.error : `Error al cargar compañías (${res.status})`
      )
    }
    return res.json()
  }
  const { createAdminClient } = await import("./supabase/admin")
  return fetchDistinctVentasCompanies(createAdminClient())
}
