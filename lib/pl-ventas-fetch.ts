import { fetchVentasAggregates } from "@/lib/ventas-data"

export type VentasMensualRow = {
  producto: string
  mes: number
  cantidad_ventas: number | string | null
  monto_total?: number | string | null
  compañia: string | null
}

/** Ventas mensuales agregadas para P&L (RPC rápido vía API servidor). */
export async function fetchVentasMensualesPaginated(
  year: number,
  companies: string[] | null
): Promise<VentasMensualRow[]> {
  const rows = await fetchVentasAggregates({
    years: [year],
    companies: companies?.length ? companies : undefined,
  })
  return rows.map((r) => ({
    producto: r.producto,
    mes: r.mes,
    cantidad_ventas: r.cantidad_ventas,
    monto_total: r.monto_total,
    compañia: r.compañia,
  }))
}
