import { supabase } from "@/lib/supabase"

export type VentasMensualRow = {
  producto: string
  mes: number
  cantidad_ventas: number | string | null
  monto_total?: number | string | null
  compañia: string | null
}

const PAGE_SIZE = 1000

/** Ventas mensuales paginadas (evita timeout y mejora respuesta en filtros del P&L). */
export async function fetchVentasMensualesPaginated(
  year: number,
  companies: string[] | null
): Promise<VentasMensualRow[]> {
  const all: VentasMensualRow[] = []
  let offset = 0

  while (true) {
    let q = supabase
      .from("ventas_mensuales_view")
      .select("producto, mes, cantidad_ventas, monto_total, compañia")
      .eq("año", year)
    if (companies?.length) q = q.in("compañia", companies)

    const { data, error } = await q.range(offset, offset + PAGE_SIZE - 1)
    if (error) throw error

    const batch = (data || []) as VentasMensualRow[]
    all.push(...batch)
    if (batch.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }

  return all
}
