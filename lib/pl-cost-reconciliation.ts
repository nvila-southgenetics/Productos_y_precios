import { supabase } from "@/lib/supabase"

/** Nombre fijo del producto que absorbe real − suma por producto. */
export const DIFFERENCIA_COSTOS_PRODUCT_NAME = "Diferencia de costos"

export type OverrideCostShape = {
  productCostUSD: number
  commercialDiscountUSD?: number
  kitCostUSD?: number
  paymentFeeUSD?: number
  bloodDrawSampleUSD?: number
  sanitaryPermitsUSD?: number
  externalCourierUSD?: number
  internalCourierUSD?: number
  physiciansFeesUSD?: number
  salesCommissionUSD?: number
  grossSalesUSD?: number
}

export type MonthlyProductCostRow = {
  year: number
  month: number
  company: string
  product_cost_usd: number
}

/** Sin filtro de productos = todos los productos visibles en P&L. */
export function shouldReconcileProductCost(productsFilter: string[]): boolean {
  return productsFilter.length === 0
}

/** Hay filas contables cargadas para el año/compañías del filtro actual. */
export function hasCompanyProductCostForFilter(
  rows: MonthlyProductCostRow[],
  year: number,
  companies: string[] | null
): boolean {
  const companySet =
    companies && companies.length > 0 ? new Set(companies.map((c) => c.trim())) : null
  return rows.some((r) => {
    if (r.year !== year) return false
    if (companySet && !companySet.has(String(r.company || "").trim())) return false
    return Number(r.product_cost_usd || 0) !== 0
  })
}

/** Suma Product Cost mensual desde filas por compañía (mes 1–12 → índice 0–11). */
export function sumRealProductCostByMonth(
  rows: MonthlyProductCostRow[],
  companies: string[] | null
): number[] {
  const monthly = Array(12).fill(0)
  const companySet =
    companies && companies.length > 0 ? new Set(companies.map((c) => c.trim())) : null

  for (const row of rows) {
    if (companySet && !companySet.has(String(row.company || "").trim())) continue
    const idx = Number(row.month) - 1
    if (idx < 0 || idx >= 12) continue
    monthly[idx] += Number(row.product_cost_usd || 0)
  }
  return monthly
}

/** Product Cost calculado por producto × unidades, excluyendo Diferencia de costos. */
export function computeMonthlyProductCostExcludingDiferencia(
  quantities: Record<string, number[]>,
  overrides: Record<string, OverrideCostShape>,
  diferenciaName: string = DIFFERENCIA_COSTOS_PRODUCT_NAME
): number[] {
  return Array.from({ length: 12 }, (_, mIdx) =>
    Object.entries(quantities).reduce((sum, [name, qtArr]) => {
      if (name === diferenciaName) return sum
      const ov = overrides[name]
      const unit = ov?.productCostUSD ?? 0
      return sum + unit * (qtArr[mIdx] || 0)
    }, 0)
  )
}

/**
 * Ajusta la serie mensual de Product Cost: total = real contable;
 * la porción Diferencia = real − suma(restos de productos).
 */
export function reconcileMonthlyProductCost(
  quantities: Record<string, number[]>,
  overrides: Record<string, OverrideCostShape>,
  realByMonth: number[],
  options?: { enabled?: boolean; diferenciaName?: string }
): {
  productCostMonthly: number[]
  diferenciaMonthly: number[]
  hasRealData: boolean
} {
  const enabled = options?.enabled !== false
  const diferenciaName = options?.diferenciaName ?? DIFFERENCIA_COSTOS_PRODUCT_NAME

  const computed = computeMonthlyProductCostExcludingDiferencia(quantities, overrides, diferenciaName)
  const hasRealData = enabled && realByMonth.some((v) => v !== 0)

  if (!enabled) {
    const fallback = Array.from({ length: 12 }, (_, m) => {
      const fromProducts = Object.entries(quantities).reduce((sum, [name, qtArr]) => {
        const ov = overrides[name]
        return sum + (ov?.productCostUSD ?? 0) * (qtArr[m] || 0)
      }, 0)
      return fromProducts
    })
    return {
      productCostMonthly: fallback,
      diferenciaMonthly: Array(12).fill(0),
      hasRealData: false,
    }
  }

  const diferenciaMonthly = Array.from({ length: 12 }, (_, m) => {
    const real = Number(realByMonth[m] || 0)
    if (real === 0) return 0
    return real - computed[m]
  })

  const productCostMonthly = Array.from({ length: 12 }, (_, m) => {
    const real = Number(realByMonth[m] || 0)
    if (real === 0) {
      return Object.entries(quantities).reduce((sum, [name, qtArr]) => {
        if (name === diferenciaName) return sum
        const ov = overrides[name]
        return sum + (ov?.productCostUSD ?? 0) * (qtArr[m] || 0)
      }, 0)
    }
    return real
  })

  return { productCostMonthly, diferenciaMonthly, hasRealData }
}

/** Asegura que Diferencia aparezca en cantidades/overrides (unidades 0 si no hay ventas). */
export function ensureDiferenciaInDataset<T extends Record<string, unknown>>(
  quantities: Record<string, number[]>,
  overrides: Record<string, T>,
  diferenciaName: string = DIFFERENCIA_COSTOS_PRODUCT_NAME
): { quantities: Record<string, number[]>; overrides: Record<string, T> } {
  const qty = { ...quantities }
  const ovs = { ...overrides }
  if (!qty[diferenciaName]) {
    qty[diferenciaName] = Array(12).fill(0)
  }
  if (!ovs[diferenciaName]) {
    ovs[diferenciaName] = {} as T
  }
  return { quantities: qty, overrides: ovs }
}

export async function fetchCompanyMonthlyProductCost(
  year: number,
  companies: string[] | null
): Promise<MonthlyProductCostRow[]> {
  let q = supabase
    .from("pl_company_monthly_product_cost")
    .select("year, month, company, product_cost_usd")
    .eq("year", year)

  if (companies && companies.length > 0) {
    q = q.in("company", companies)
  }

  const { data, error } = await q
  if (error) {
    console.error("fetchCompanyMonthlyProductCost:", error)
    return []
  }
  return (data || []) as MonthlyProductCostRow[]
}

export async function resolveDiferenciaProductName(): Promise<string | null> {
  const { data, error } = await supabase
    .from("products")
    .select("name")
    .eq("name", DIFFERENCIA_COSTOS_PRODUCT_NAME)
    .maybeSingle()

  if (error || !data) return null
  return String((data as { name: string }).name)
}
