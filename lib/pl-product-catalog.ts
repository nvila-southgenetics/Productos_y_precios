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

  catalogCache = (data || []).map((p) => ({
    name: String((p as { name?: string }).name || ""),
    category: String((p as { category?: string | null }).category || ""),
    alias: String((p as { alias?: string | null }).alias || ""),
  }))
  return catalogCache
}

export function allowedProductNamesForCategories(
  catalog: PlProductCatalogRow[],
  categoriesSet: Set<string>
): Set<string> {
  return new Set(
    catalog.filter((p) => categoriesSet.has(p.category)).map((p) => p.name)
  )
}
