import { supabase } from "@/lib/supabase"

/** @deprecated Usar PL_COS_LINES; se mantiene por compatibilidad. */
export const DIFFERENCIA_COSTOS_PRODUCT_NAME = "Diferencia de costos"

export type CosCostLineKey =
  | "product_cost"
  | "carrier_cost"
  | "kit_cost"
  | "payment_fee"
  | "blood_draw"
  | "sanitary"
  | "external_courier"
  | "internal_courier"
  | "physicians_fees"
  | "sales_commission"

export type OverrideCostShape = {
  productCostUSD: number
  commercialDiscountUSD?: number
  carrierCostUSD?: number
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

export type CosLineConfig = {
  line: CosCostLineKey
  overrideField: keyof OverrideCostShape
  diferenciaName: string
  label: string
}

/** Líneas COS del P&L con campo en overrides y producto Diferencia. */
export const PL_COS_LINES: readonly CosLineConfig[] = [
  {
    line: "product_cost",
    overrideField: "productCostUSD",
    diferenciaName: "Diferencia de costos",
    label: "Product Cost",
  },
  {
    line: "carrier_cost",
    overrideField: "carrierCostUSD",
    diferenciaName: "Diferencia - Carrier Cost",
    label: "Carrier Cost",
  },
  {
    line: "kit_cost",
    overrideField: "kitCostUSD",
    diferenciaName: "Diferencia - Kit Cost",
    label: "Kit Cost",
  },
  {
    line: "payment_fee",
    overrideField: "paymentFeeUSD",
    diferenciaName: "Diferencia - Payment Fee",
    label: "Payment Fee",
  },
  {
    line: "blood_draw",
    overrideField: "bloodDrawSampleUSD",
    diferenciaName: "Diferencia - Blood Draw",
    label: "Blood Draw",
  },
  {
    line: "sanitary",
    overrideField: "sanitaryPermitsUSD",
    diferenciaName: "Diferencia - Sanitary Permits",
    label: "Sanitary Permits",
  },
  {
    line: "external_courier",
    overrideField: "externalCourierUSD",
    diferenciaName: "Diferencia - External Courier",
    label: "External Courier",
  },
  {
    line: "internal_courier",
    overrideField: "internalCourierUSD",
    diferenciaName: "Diferencia - Internal Courier",
    label: "Internal Courier",
  },
  {
    line: "physicians_fees",
    overrideField: "physiciansFeesUSD",
    diferenciaName: "Diferencia - Physicians Fees",
    label: "Physicians Fees",
  },
  {
    line: "sales_commission",
    overrideField: "salesCommissionUSD",
    diferenciaName: "Diferencia - Sales Commission",
    label: "Sales Commission",
  },
] as const

/** Líneas COS que n8n carga desde Odoo en pl_company_monthly_cos. */
export const PL_COS_ODOO_LINES: readonly CosCostLineKey[] = [
  "product_cost",
  "carrier_cost",
  "kit_cost",
  "blood_draw",
  "external_courier",
  "internal_courier",
  "physicians_fees",
] as const

export const PL_COS_DIFERENCIA_PRODUCT_NAMES = PL_COS_LINES.map((c) => c.diferenciaName)

export type MonthlyCosRow = {
  year: number
  month: number
  company: string
  cost_line: CosCostLineKey
  amount_usd: number
}

/** @deprecated */
export type MonthlyProductCostRow = {
  year: number
  month: number
  company: string
  product_cost_usd: number
}

export function shouldReconcileCos(productsFilter: string[]): boolean {
  return productsFilter.length === 0
}

/** @deprecated */
export const shouldReconcileProductCost = shouldReconcileCos

export function hasCompanyCosForFilter(
  rows: MonthlyCosRow[],
  year: number,
  companies: string[] | null
): boolean {
  const companySet =
    companies && companies.length > 0 ? new Set(companies.map((c) => c.trim())) : null
  return rows.some((r) => {
    if (r.year !== year) return false
    if (companySet && !companySet.has(String(r.company || "").trim())) return false
    return Number(r.amount_usd || 0) !== 0
  })
}

/** @deprecated */
export const hasCompanyProductCostForFilter = (
  rows: MonthlyProductCostRow[],
  year: number,
  companies: string[] | null
) =>
  hasCompanyCosForFilter(
    rows.map((r) => ({
      year: r.year,
      month: r.month,
      company: r.company,
      cost_line: "product_cost" as const,
      amount_usd: r.product_cost_usd,
    })),
    year,
    companies
  )

export function sumRealCosByMonth(
  rows: MonthlyCosRow[],
  costLine: CosCostLineKey,
  companies: string[] | null
): number[] {
  const monthly = Array(12).fill(0)
  const companySet =
    companies && companies.length > 0 ? new Set(companies.map((c) => c.trim())) : null

  for (const row of rows) {
    if (row.cost_line !== costLine) continue
    if (companySet && !companySet.has(String(row.company || "").trim())) continue
    const idx = Number(row.month) - 1
    if (idx < 0 || idx >= 12) continue
    monthly[idx] += Number(row.amount_usd || 0)
  }
  return monthly
}

/** @deprecated */
export const sumRealProductCostByMonth = (
  rows: MonthlyProductCostRow[],
  companies: string[] | null
) =>
  sumRealCosByMonth(
    rows.map((r) => ({
      year: r.year,
      month: r.month,
      company: r.company,
      cost_line: "product_cost" as const,
      amount_usd: r.product_cost_usd,
    })),
    "product_cost",
    companies
  )

function computeMonthlyExcludingDiferencia(
  quantities: Record<string, number[]>,
  overrides: Record<string, OverrideCostShape>,
  overrideField: keyof OverrideCostShape,
  diferenciaName: string
): number[] {
  return Array.from({ length: 12 }, (_, mIdx) =>
    Object.entries(quantities).reduce((sum, [name, qtArr]) => {
      if (name === diferenciaName) return sum
      const ov = overrides[name]
      const unit = Number(ov?.[overrideField] ?? 0)
      return sum + unit * (qtArr[mIdx] || 0)
    }, 0)
  )
}

export function reconcileMonthlyCosLine(
  quantities: Record<string, number[]>,
  overrides: Record<string, OverrideCostShape>,
  realByMonth: number[],
  overrideField: keyof OverrideCostShape,
  diferenciaName: string,
  options?: { enabled?: boolean }
): {
  monthly: number[]
  diferenciaMonthly: number[]
  hasRealData: boolean
} {
  const enabled = options?.enabled !== false
  const computed = computeMonthlyExcludingDiferencia(
    quantities,
    overrides,
    overrideField,
    diferenciaName
  )
  const hasRealData = enabled && realByMonth.some((v) => v !== 0)

  if (!enabled) {
    const fallback = Array.from({ length: 12 }, (_, m) =>
      Object.entries(quantities).reduce((sum, [name, qtArr]) => {
        if (name === diferenciaName) return sum
        const ov = overrides[name]
        return sum + Number(ov?.[overrideField] ?? 0) * (qtArr[m] || 0)
      }, 0)
    )
    return { monthly: fallback, diferenciaMonthly: Array(12).fill(0), hasRealData: false }
  }

  const diferenciaMonthly = Array.from({ length: 12 }, (_, m) => {
    const real = Number(realByMonth[m] || 0)
    if (real === 0) return 0
    return real - computed[m]
  })

  const monthly = Array.from({ length: 12 }, (_, m) => {
    const real = Number(realByMonth[m] || 0)
    if (real === 0) {
      return Object.entries(quantities).reduce((sum, [name, qtArr]) => {
        if (name === diferenciaName) return sum
        const ov = overrides[name]
        return sum + Number(ov?.[overrideField] ?? 0) * (qtArr[m] || 0)
      }, 0)
    }
    return real
  })

  return { monthly, diferenciaMonthly, hasRealData }
}

/** @deprecated */
export function reconcileMonthlyProductCost(
  quantities: Record<string, number[]>,
  overrides: Record<string, OverrideCostShape>,
  realByMonth: number[],
  options?: { enabled?: boolean; diferenciaName?: string }
) {
  const r = reconcileMonthlyCosLine(
    quantities,
    overrides,
    realByMonth,
    "productCostUSD",
    options?.diferenciaName ?? DIFFERENCIA_COSTOS_PRODUCT_NAME,
    options
  )
  return {
    productCostMonthly: r.monthly,
    diferenciaMonthly: r.diferenciaMonthly,
    hasRealData: r.hasRealData,
  }
}

/** @deprecated */
export const computeMonthlyProductCostExcludingDiferencia = (
  quantities: Record<string, number[]>,
  overrides: Record<string, OverrideCostShape>,
  diferenciaName: string = DIFFERENCIA_COSTOS_PRODUCT_NAME
) => computeMonthlyExcludingDiferencia(quantities, overrides, "productCostUSD", diferenciaName)

export function ensureDiferenciaInDataset<T extends object = OverrideCostShape>(
  quantities: Record<string, number[]>,
  overrides: Record<string, T>,
  diferenciaName: string = DIFFERENCIA_COSTOS_PRODUCT_NAME
): { quantities: Record<string, number[]>; overrides: Record<string, T> } {
  const qty = { ...quantities }
  const ovs = { ...overrides }
  if (!qty[diferenciaName]) qty[diferenciaName] = Array(12).fill(0)
  if (!ovs[diferenciaName]) ovs[diferenciaName] = {} as T
  return { quantities: qty, overrides: ovs }
}

export function ensureAllDiferenciaInDataset<T extends object = OverrideCostShape>(
  quantities: Record<string, number[]>,
  overrides: Record<string, T>
): { quantities: Record<string, number[]>; overrides: Record<string, T> } {
  let qty = quantities
  let ovs = overrides
  for (const { diferenciaName } of PL_COS_LINES) {
    const next = ensureDiferenciaInDataset(qty, ovs, diferenciaName)
    qty = next.quantities
    ovs = next.overrides
  }
  return { quantities: qty, overrides: ovs }
}

export function reconcileAllCosLines(
  quantities: Record<string, number[]>,
  overrides: Record<string, OverrideCostShape>,
  rows: MonthlyCosRow[],
  companies: string[] | null,
  options?: { enabled?: boolean }
): Record<
  CosCostLineKey,
  { monthly: number[]; diferenciaMonthly: number[]; hasRealData: boolean }
> {
  const enabled = options?.enabled !== false
  const out = {} as Record<
    CosCostLineKey,
    { monthly: number[]; diferenciaMonthly: number[]; hasRealData: boolean }
  >
  for (const { line, overrideField, diferenciaName } of PL_COS_LINES) {
    const realByMonth = sumRealCosByMonth(rows, line, companies)
    const { quantities: qty, overrides: ovs } = ensureDiferenciaInDataset(
      quantities,
      overrides,
      diferenciaName
    )
    out[line] = reconcileMonthlyCosLine(qty, ovs, realByMonth, overrideField, diferenciaName, {
      enabled,
    })
  }
  return out
}

export async function fetchCompanyMonthlyCos(
  year: number,
  companies: string[] | null
): Promise<MonthlyCosRow[]> {
  let q = supabase
    .from("pl_company_monthly_cos")
    .select("year, month, company, cost_line, amount_usd")
    .eq("year", year)

  if (companies && companies.length > 0) {
    q = q.in("company", companies)
  }

  const { data, error } = await q
  if (error) {
    console.error("fetchCompanyMonthlyCos:", error)
    return []
  }
  return (data || []) as MonthlyCosRow[]
}

/** @deprecated */
export const fetchCompanyMonthlyProductCost = async (
  year: number,
  companies: string[] | null
): Promise<MonthlyProductCostRow[]> => {
  const rows = await fetchCompanyMonthlyCos(year, companies)
  return rows
    .filter((r) => r.cost_line === "product_cost")
    .map((r) => ({
      year: r.year,
      month: r.month,
      company: r.company,
      product_cost_usd: r.amount_usd,
    }))
}

export function getCosLineConfig(line: CosCostLineKey): CosLineConfig {
  const cfg = PL_COS_LINES.find((c) => c.line === line)
  if (!cfg) throw new Error(`Unknown COS line: ${line}`)
  return cfg
}
