import type { SupabaseClient } from "@supabase/supabase-js"

const PAGE_SIZE = 1000

/** Distintas compañías de ventas_mensuales_view (paginado, sin truncar a 1000 filas). */
export async function fetchDistinctVentasCompanies(
  client: SupabaseClient
): Promise<string[]> {
  const seen = new Set<string>()
  let offset = 0

  while (true) {
    const { data, error } = await client
      .from("ventas_mensuales_view")
      .select("compañia")
      .order("compañia", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)

    if (error) throw error

    const batch = data ?? []
    for (const row of batch) {
      const name = String((row as { compañia?: string }).compañia ?? "").trim()
      if (name) seen.add(name)
    }

    if (batch.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }

  return [...seen].sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }))
}
