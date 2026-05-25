/** Categorías predeterminadas de productos (selector y filtros). */
export const PRODUCT_CATEGORIES = [
  "Ginecología",
  "Oncología",
  "Endocrinología",
  "Urología",
  "Prenatales",
  "Anualidades",
  "Procesamientos",
  "Inscripciones",
  "Otros",
] as const

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number]

/** Mismo listado en orden alfabético (p. ej. filtros P&L). */
export const PRODUCT_CATEGORIES_SORTED = [...PRODUCT_CATEGORIES].sort((a, b) =>
  a.localeCompare(b, "es", { sensitivity: "base" })
)

export const PRODUCT_CATEGORY_COLORS: Record<string, string> = {
  "Ginecología": "bg-pink-300/20 text-pink-200 border-pink-300/30",
  "Oncología": "bg-rose-300/20 text-rose-200 border-rose-300/30",
  "Urología": "bg-sky-300/20 text-sky-200 border-sky-300/30",
  "Endocrinología": "bg-violet-300/20 text-violet-200 border-violet-300/30",
  "Prenatales": "bg-teal-300/20 text-teal-200 border-teal-300/30",
  "Anualidades": "bg-amber-300/20 text-amber-200 border-amber-300/30",
  "Procesamientos": "bg-cyan-300/20 text-cyan-200 border-cyan-300/30",
  "Inscripciones": "bg-emerald-300/20 text-emerald-200 border-emerald-300/30",
  "Carrier": "bg-indigo-300/20 text-indigo-200 border-indigo-300/30",
  "Nutrición": "bg-lime-300/20 text-lime-200 border-lime-300/30",
  "Otros": "bg-slate-300/20 text-slate-200 border-slate-300/30",
}

/** Variante clara para modales con fondo blanco. */
export const PRODUCT_CATEGORY_COLORS_LIGHT: Record<string, string> = {
  "Ginecología": "bg-pink-200 text-pink-800 border-pink-300",
  "Oncología": "bg-rose-200 text-rose-800 border-rose-300",
  "Urología": "bg-sky-200 text-sky-800 border-sky-300",
  "Endocrinología": "bg-violet-200 text-violet-800 border-violet-300",
  "Prenatales": "bg-teal-200 text-teal-800 border-teal-300",
  "Anualidades": "bg-amber-200 text-amber-800 border-amber-300",
  "Procesamientos": "bg-cyan-200 text-cyan-800 border-cyan-300",
  "Inscripciones": "bg-emerald-200 text-emerald-800 border-emerald-300",
  "Carrier": "bg-indigo-200 text-indigo-800 border-indigo-300",
  "Nutrición": "bg-lime-200 text-lime-800 border-lime-300",
  "Otros": "bg-slate-200 text-slate-800 border-slate-300",
}

/** Productos sin categoría en BD se agrupan solo bajo "Otros" al filtrar. */
export const UNCATEGORIZED_CATEGORY_BUCKET = "Otros"

export function isPredefinedCategory(category: string | null | undefined): boolean {
  if (!category?.trim()) return false
  return (PRODUCT_CATEGORIES as readonly string[]).includes(category.trim())
}

/**
 * Indica si un producto del catálogo pasa el filtro de categorías seleccionado.
 * Sin categoría (null/vacío) solo coincide si el filtro incluye "Otros".
 */
export function productMatchesCategoryFilter(
  category: string | null | undefined,
  allowedCategories: ReadonlySet<string> | Set<string>
): boolean {
  const cat = category?.trim() ?? ""
  if (!cat) {
    return allowedCategories.has(UNCATEGORIZED_CATEGORY_BUCKET)
  }
  return allowedCategories.has(cat)
}

export function getCategoryColor(category: string | null | undefined, variant: "dark" | "light" = "dark"): string {
  const map = variant === "light" ? PRODUCT_CATEGORY_COLORS_LIGHT : PRODUCT_CATEGORY_COLORS
  if (!category) return map["Otros"]
  return map[category] || map["Otros"]
}
