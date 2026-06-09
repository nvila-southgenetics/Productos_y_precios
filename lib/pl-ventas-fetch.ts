export type VentasMensualRow = {
  producto: string
  mes: number
  cantidad_ventas: number | string | null
  monto_total?: number | string | null
  compañia: string | null
}

/**
 * Ventas mensuales agregadas para P&L.
 * Usa RPC sobre `ventas` (rápido); ventas_mensuales_view hace timeout en producción.
 */
export async function fetchVentasMensualesPaginated(
  year: number,
  companies: string[] | null
): Promise<VentasMensualRow[]> {
  if (typeof window !== "undefined") {
    const params = new URLSearchParams({ year: String(year) })
    if (companies?.length) params.set("companies", companies.join(","))
    const res = await fetch(`/api/ventas-mensuales?${params}`, { credentials: "include" })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(
        typeof body.error === "string" ? body.error : `Error al cargar ventas (${res.status})`
      )
    }
    return res.json()
  }

  const { createAdminClient } = await import("./supabase/admin")
  const admin = createAdminClient()
  const { data, error } = await admin.rpc("get_ventas_mensuales_pl", {
    p_year: year,
    p_companies: companies,
  })
  if (error) throw error
  return (data ?? []) as VentasMensualRow[]
}
