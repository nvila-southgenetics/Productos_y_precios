import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Compañías distintas desde `ventas.company` (rápido).
 * No usar ventas_mensuales_view: materializa toda la vista y hace timeout en producción.
 */
export async function fetchDistinctVentasCompanies(
  client: SupabaseClient
): Promise<string[]> {
  const { data, error } = await client.rpc("get_distinct_ventas_companies")
  if (error) throw error
  return ((data ?? []) as string[])
    .map((c) => String(c).trim())
    .filter(Boolean)
}
