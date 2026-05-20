import type { ProductCountryOverride, ProductWithOverrides } from "@/lib/supabase-mcp"

type OverrideRow = ProductCountryOverride & {
  mx_config_type?: string | null
  cl_config_type?: string | null
  col_config_type?: string | null
}

/** Valor por defecto en UI/BD; no cuenta como precio cargado (igual que en dashboard/P&L). */
export const PLACEHOLDER_GROSS_SALES_USD = 10

function isMeaningfulOverrideField(key: string, value: number): boolean {
  if (value === 0) return false
  if (key === "grossSalesUSD" && value === PLACEHOLDER_GROSS_SALES_USD) return false
  return true
}

/** True si hay precio, costo, revisado u otro dato numérico cargado en overrides. */
export function hasMeaningfulOverrideData(
  overrides?: ProductCountryOverride["overrides"] | null
): boolean {
  if (!overrides || typeof overrides !== "object") return false
  if (overrides.reviewed === true) return true
  for (const [key, value] of Object.entries(overrides)) {
    if (key === "reviewed") continue
    if (typeof value === "number" && isMeaningfulOverrideField(key, value)) return true
  }
  return false
}

const CONFIG_TYPE_PLACEHOLDERS = new Set(["", "default"])

/** Config P&L solo aplica al país correspondiente; "default" no cuenta como dato cargado. */
function hasCountryConfig(row: OverrideRow, countryCode: string): boolean {
  const isRealConfig = (value?: string | null) => {
    const v = value?.trim().toLowerCase()
    return !!v && !CONFIG_TYPE_PLACEHOLDERS.has(v)
  }
  switch (countryCode) {
    case "MX":
      return isRealConfig(row.mx_config_type)
    case "CL":
      return isRealConfig(row.cl_config_type)
    case "CO":
      return isRealConfig(row.col_config_type)
    default:
      return false
  }
}

/**
 * Producto con datos en un país: ventas, budget, precios/costos en overrides o config P&L.
 */
export function productHasActivityInCountry(
  product: ProductWithOverrides,
  countryCode: string,
  ctx?: { salesCount?: number; budgetUnits?: number }
): boolean {
  if ((ctx?.salesCount ?? 0) > 0) return true
  if ((ctx?.budgetUnits ?? 0) > 0) return true

  const countryOverrides = (product.country_overrides || []).filter(
    (o) => o.country_code === countryCode
  ) as OverrideRow[]

  if (countryOverrides.some((o) => hasMeaningfulOverrideData(o.overrides))) return true
  if (countryOverrides.some((o) => hasCountryConfig(o, countryCode))) return true

  return false
}

export function filterProductsWithCountryActivity(
  products: ProductWithOverrides[],
  countryCode: string,
  salesCountByProductId: Record<string, number>,
  budgetUnitsByProductId: Record<string, number>
): ProductWithOverrides[] {
  return products.filter((p) =>
    productHasActivityInCountry(p, countryCode, {
      salesCount: salesCountByProductId[p.id] ?? 0,
      budgetUnits: budgetUnitsByProductId[p.id] ?? 0,
    })
  )
}
