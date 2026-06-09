import { supabase } from "@/lib/supabase"

export type PlProductCatalogRow = {
  name: string
  category: string
  alias: string
}

let catalogCache: PlProductCatalogRow[] | null = null

export async function fetchPlProductCatalog(force = false): Promise<PlProductCatalogRow[]> {
  if (!force && catalogCache) return catalogCache

  const { data, error } = await supabase.from("products").select("name, category, alias")
  if (error) throw error

  const rows = (data || []).map((p: { name?: string; category?: string | null; alias?: string | null }) => ({
    name: String(p.name || ""),
    category: String(p.category || ""),
    alias: String(p.alias || ""),
  }))
  catalogCache = rows
  return rows
}

export function allowedProductNamesForCategories(
  catalog: PlProductCatalogRow[],
  categoriesSet: Set<string>
): Set<string> {
  return new Set(
    catalog.filter((p) => categoriesSet.has(p.category)).map((p) => p.name)
  )
}
