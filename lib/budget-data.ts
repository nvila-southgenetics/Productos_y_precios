/**
 * Carga y procesamiento compartido de budget.
 * Un solo fetch + batch de overrides (evita N+1 que tenían BudgetTable y BudgetSummary por separado).
 */

import { supabase } from "@/lib/supabase"
import { productNameSortKey } from "@/lib/utils"

export const BUDGET_MONTH_KEYS = [
  "jan", "feb", "mar", "apr", "may", "jun",
  "jul", "aug", "sep", "oct", "nov", "dec",
] as const

export type BudgetMonthKey = (typeof BUDGET_MONTH_KEYS)[number]

export interface BudgetRow {
  id: string
  country: string
  country_code: string
  product_name: string
  product_id: string | null
  channel?: string
  jan: number
  feb: number
  mar: number
  apr: number
  may: number
  jun: number
  jul: number
  aug: number
  sep: number
  oct: number
  nov: number
  dec: number
  total_units: number
  total_gross_sale: number
  total_gross_profit: number
  monthly_units?: number
  monthly_gross_sale?: number
  monthly_gross_profit?: number
  commercial_discount?: number
  monthly_commercial_discount?: number
}

export interface BudgetSummaryData {
  totalUnits: number
  totalGrossSale: number
  totalGrossProfit: number
  avgGrossMargin: number
}

export interface BudgetFetchParams {
  year: number
  budgetName: string
  countries: string[]
  products: string[]
  months: string[]
  channels: string[]
}

export interface BudgetBundle {
  tableRows: BudgetRow[]
  summary: BudgetSummaryData
  aliasByName: Record<string, string>
}

type RawBudgetRow = {
  id: string
  country: string
  country_code: string
  product_id: string | null
  product_name: string
  channel: string
  total_units?: number
} & Record<string, unknown>

type OverrideRow = {
  product_id: string
  country_code: string
  channel: string
  overrides: Record<string, number>
  cl_config_type?: string | null
  mx_config_type?: string | null
  col_config_type?: string | null
}

const BUDGET_SELECT_COLUMNS =
  "id, country, country_code, product_id, product_name, channel, total_units, jan, feb, mar, apr, may, jun, jul, aug, sep, oct, nov, dec"

export function calculateBudgetGrossProfit(overrides: Record<string, number> | null | undefined): number {
  const grossSalesUSD = overrides?.grossSalesUSD || 0
  const commercialDiscountUSD = overrides?.commercialDiscountUSD || 0
  const salesRevenueUSD = grossSalesUSD - commercialDiscountUSD

  const totalCosts =
    (overrides?.productCostUSD || 0) +
    (overrides?.carrierCostUSD || 0) +
    (overrides?.kitCostUSD || 0) +
    (overrides?.paymentFeeUSD || 0) +
    (overrides?.bloodDrawSampleUSD || 0) +
    (overrides?.sanitaryPermitsUSD || 0) +
    (overrides?.externalCourierUSD || 0) +
    (overrides?.internalCourierUSD || 0) +
    (overrides?.physiciansFeesUSD || 0) +
    (overrides?.salesCommissionUSD || 0)

  return salesRevenueUSD - totalCosts
}

/** Batch: una query de overrides por chunk de product_ids (reemplaza N queries por fila). */
async function fetchOverridesBatch(productIds: string[]): Promise<OverrideRow[]> {
  const unique = [...new Set(productIds.filter(Boolean))]
  if (unique.length === 0) return []

  const chunkSize = 100
  const chunks: string[][] = []
  for (let i = 0; i < unique.length; i += chunkSize) {
    chunks.push(unique.slice(i, i + chunkSize))
  }

  const results = await Promise.all(
    chunks.map(async (chunk) => {
      const { data, error } = await supabase
        .from("product_country_overrides")
        .select("product_id, country_code, channel, overrides, cl_config_type, mx_config_type, col_config_type")
        .in("product_id", chunk)
      if (error) {
        console.warn("fetchOverridesBatch:", error)
        return [] as OverrideRow[]
      }
      return (data || []) as OverrideRow[]
    })
  )

  return results.flat()
}

function overrideKey(productId: string, countryCode: string, channel: string): string {
  return `${productId}|${countryCode}|${channel}`
}

/** Índice en memoria con la misma lógica de fallback que los componentes originales. */
function buildOverrideIndex(rows: OverrideRow[]) {
  const exact = new Map<string, Record<string, number>>()
  const byProductCountry = new Map<string, OverrideRow[]>()

  for (const row of rows) {
    exact.set(overrideKey(row.product_id, row.country_code, row.channel), row.overrides || {})
    const pcKey = `${row.product_id}|${row.country_code}`
    const list = byProductCountry.get(pcKey) || []
    list.push(row)
    byProductCountry.set(pcKey, list)
  }

  for (const list of byProductCountry.values()) {
    list.sort((a, b) => {
      const cl = String(a.cl_config_type ?? "").localeCompare(String(b.cl_config_type ?? ""))
      if (cl !== 0) return cl
      const mx = String(a.mx_config_type ?? "").localeCompare(String(b.mx_config_type ?? ""))
      if (mx !== 0) return mx
      return String(a.col_config_type ?? "").localeCompare(String(b.col_config_type ?? ""))
    })
  }

  return { exact, byProductCountry }
}

function pickOverride(
  index: ReturnType<typeof buildOverrideIndex>,
  productId: string,
  countryCode: string,
  channel: string
): Record<string, number> {
  const exact = index.exact.get(overrideKey(productId, countryCode, channel))
  if (exact) return exact
  const fallback = index.byProductCountry.get(`${productId}|${countryCode}`)?.[0]
  return fallback?.overrides || {}
}

async function fetchProductAliasMap(productNames: string[]): Promise<Record<string, string>> {
  if (productNames.length === 0) return {}
  const { data } = await supabase.from("products").select("name, alias").in("name", productNames)
  const map: Record<string, string> = {}
  for (const p of (data || []) as { name: string; alias: string | null }[]) {
    map[p.name] = p.alias || ""
  }
  return map
}

async function fetchBudgetRaw(params: BudgetFetchParams): Promise<RawBudgetRow[]> {
  let query = supabase
    .from("budget")
    .select(BUDGET_SELECT_COLUMNS)
    .eq("year", params.year)
    .eq("budget_name", params.budgetName)

  if (params.countries.length > 0) query = query.in("country_code", params.countries)
  if (params.products.length > 0) query = query.in("product_name", params.products)
  if (params.channels.length > 0) query = query.in("channel", params.channels)

  const { data, error } = await query
  if (error) throw error
  return (data || []) as RawBudgetRow[]
}

function monthFilterState(months: string[]) {
  const allMonthsSelected = months.length === 12
  const isMonthFiltered = !allMonthsSelected
  const monthIndices = Array.from(
    new Set(months.map((m) => parseInt(m, 10) - 1).filter((i) => i >= 0 && i < 12))
  )
  const monthKeysSelected = isMonthFiltered
    ? monthIndices.map((i) => BUDGET_MONTH_KEYS[i])
    : []
  return { allMonthsSelected, isMonthFiltered, monthKeysSelected }
}

function sumMonthUnits(row: RawBudgetRow, monthKeys: BudgetMonthKey[]): number {
  return monthKeys.reduce((sum, mk) => sum + Number(row[mk] ?? 0), 0)
}

function buildProductMap(budgetData: RawBudgetRow[], productRows: { id: string; name: string }[]): Map<string, string> {
  const productMap = new Map<string, string>()
  productRows.forEach((p) => productMap.set(p.name, p.id))
  return productMap
}

function buildBudgetTableRows(
  budgetData: RawBudgetRow[],
  productMap: Map<string, string>,
  overrideIndex: ReturnType<typeof buildOverrideIndex>,
  params: BudgetFetchParams
): BudgetRow[] {
  const { isMonthFiltered, monthKeysSelected } = monthFilterState(params.months)
  const multiChannelMode = params.channels.length > 1
  const primaryChannel = params.channels[0] || "Paciente"

  const grouped = new Map<string, RawBudgetRow>()
  for (const row of budgetData) {
    const key = `${row.country_code}|${row.product_name}`
    if (!grouped.has(key)) {
      grouped.set(key, { ...row })
    } else {
      const existing = grouped.get(key)!
      for (const mk of BUDGET_MONTH_KEYS) {
        existing[mk] = Number(existing[mk] ?? 0) + Number(row[mk] ?? 0)
      }
    }
  }

  const processedData: BudgetRow[] = []

  for (const row of grouped.values()) {
    const productId = row.product_id || productMap.get(row.product_name) || null
    const rowTotalUnits = sumMonthUnits(row, [...BUDGET_MONTH_KEYS])
    const monthlyUnits = isMonthFiltered
      ? sumMonthUnits(row, monthKeysSelected as BudgetMonthKey[])
      : rowTotalUnits

    let totalGrossSale = 0
    let totalGrossProfit = 0
    let monthlyGrossSale = 0
    let monthlyGrossProfit = 0
    let commercialDiscount = 0
    let monthlyCommercialDiscount = 0

    if (productId) {
      if (multiChannelMode) {
        const channelRows = budgetData.filter(
          (r) => r.country_code === row.country_code && r.product_name === row.product_name
        )
        let sumGrossSale = 0
        let sumGrossProfit = 0
        let sumCommercialDiscount = 0

        for (const cr of channelRows) {
          const crProductId = cr.product_id || productMap.get(cr.product_name) || null
          if (!crProductId) continue
          const crUnits = isMonthFiltered
            ? sumMonthUnits(cr, monthKeysSelected as BudgetMonthKey[])
            : sumMonthUnits(cr, [...BUDGET_MONTH_KEYS])
          const crOverrideObj = pickOverride(overrideIndex, crProductId, cr.country_code, cr.channel)
          sumGrossSale += (crOverrideObj.grossSalesUSD || 0) * crUnits
          sumGrossProfit += calculateBudgetGrossProfit(crOverrideObj) * crUnits
          sumCommercialDiscount += (crOverrideObj.commercialDiscountUSD || 0) * crUnits
        }

        totalGrossSale = sumGrossSale
        totalGrossProfit = sumGrossProfit
        commercialDiscount = sumCommercialDiscount
        if (isMonthFiltered) {
          monthlyGrossSale = sumGrossSale
          monthlyGrossProfit = sumGrossProfit
          monthlyCommercialDiscount = sumCommercialDiscount
        }
      } else {
        const overrideDataObj = pickOverride(overrideIndex, productId, row.country_code, primaryChannel)
        const grossSaleUSD = overrideDataObj.grossSalesUSD || 0
        const commercialDiscountUSDPerUnit = overrideDataObj.commercialDiscountUSD || 0
        const grossProfitUSD = calculateBudgetGrossProfit(overrideDataObj)

        totalGrossSale = grossSaleUSD * rowTotalUnits
        totalGrossProfit = grossProfitUSD * rowTotalUnits
        commercialDiscount = commercialDiscountUSDPerUnit * rowTotalUnits
        if (isMonthFiltered) {
          monthlyGrossSale = grossSaleUSD * monthlyUnits
          monthlyGrossProfit = grossProfitUSD * monthlyUnits
          monthlyCommercialDiscount = commercialDiscountUSDPerUnit * monthlyUnits
        }
      }
    }

    processedData.push({
      id: row.id,
      country: row.country as string,
      country_code: row.country_code,
      product_name: row.product_name,
      product_id: productId,
      jan: Number(row.jan ?? 0),
      feb: Number(row.feb ?? 0),
      mar: Number(row.mar ?? 0),
      apr: Number(row.apr ?? 0),
      may: Number(row.may ?? 0),
      jun: Number(row.jun ?? 0),
      jul: Number(row.jul ?? 0),
      aug: Number(row.aug ?? 0),
      sep: Number(row.sep ?? 0),
      oct: Number(row.oct ?? 0),
      nov: Number(row.nov ?? 0),
      dec: Number(row.dec ?? 0),
      total_units: rowTotalUnits,
      total_gross_sale: totalGrossSale,
      total_gross_profit: totalGrossProfit,
      monthly_units: monthlyUnits,
      monthly_gross_sale: monthlyGrossSale,
      monthly_gross_profit: monthlyGrossProfit,
      commercial_discount: commercialDiscount,
      monthly_commercial_discount: monthlyCommercialDiscount,
    })
  }

  processedData.sort((a, b) => {
    if (a.country !== b.country) return a.country.localeCompare(b.country)
    return productNameSortKey(a.product_name).localeCompare(productNameSortKey(b.product_name), "es", {
      sensitivity: "base",
    })
  })

  return processedData
}

function buildBudgetSummary(
  budgetData: RawBudgetRow[],
  productMap: Map<string, string>,
  overrideIndex: ReturnType<typeof buildOverrideIndex>,
  params: BudgetFetchParams
): BudgetSummaryData {
  const { isMonthFiltered, monthKeysSelected } = monthFilterState(params.months)

  let totalUnits = 0
  let totalGrossSale = 0
  let totalGrossProfit = 0
  let totalCommercialDiscount = 0

  for (const row of budgetData) {
    const units = isMonthFiltered
      ? sumMonthUnits(row, monthKeysSelected as BudgetMonthKey[])
      : Number(row.total_units || 0)

    totalUnits += units

    const productId = row.product_id || productMap.get(row.product_name)
    if (!productId) continue

    const channelToQuery =
      params.channels.length === 1
        ? params.channels[0]
        : row.channel || "Paciente"

    const overrideDataObj = pickOverride(overrideIndex, productId, row.country_code, channelToQuery)
    const grossSaleUSD = overrideDataObj.grossSalesUSD || 0
    const commercialDiscountUSD = overrideDataObj.commercialDiscountUSD || 0
    const grossProfitUSD = calculateBudgetGrossProfit(overrideDataObj)

    totalGrossSale += grossSaleUSD * units
    totalGrossProfit += grossProfitUSD * units
    totalCommercialDiscount += commercialDiscountUSD * units
  }

  const totalSalesRevenue = totalGrossSale - totalCommercialDiscount
  const avgGrossMargin = totalSalesRevenue > 0 ? (totalGrossProfit / totalSalesRevenue) * 100 : 0

  return {
    totalUnits,
    totalGrossSale,
    totalGrossProfit,
    avgGrossMargin,
  }
}

const EMPTY_SUMMARY: BudgetSummaryData = {
  totalUnits: 0,
  totalGrossSale: 0,
  totalGrossProfit: 0,
  avgGrossMargin: 0,
}

/** Fetch único: budget + overrides batch + filas tabla + resumen. */
export async function fetchBudgetBundle(params: BudgetFetchParams): Promise<BudgetBundle> {
  const budgetData = await fetchBudgetRaw(params)

  if (budgetData.length === 0) {
    return { tableRows: [], summary: { ...EMPTY_SUMMARY }, aliasByName: {} }
  }

  const productIdsFromBudget = budgetData
    .map((b) => b.product_id)
    .filter((id): id is string => id !== null)

  const productNames = [...new Set(budgetData.map((b) => b.product_name))]

  const [productsByIdResult, aliasByName] = await Promise.all([
    supabase
      .from("products")
      .select("id, name")
      .in("id", productIdsFromBudget.length > 0 ? productIdsFromBudget : ["00000000-0000-0000-0000-000000000000"]),
    fetchProductAliasMap(productNames),
  ])

  const resolvedById = (productsByIdResult.data || []) as { id: string; name: string }[]
  const namesNeedingLookup = productNames.filter(
    (name) => !resolvedById.some((p) => p.name === name)
  )

  let resolvedByName: { id: string; name: string }[] = []
  if (namesNeedingLookup.length > 0) {
    const { data } = await supabase.from("products").select("id, name").in("name", namesNeedingLookup)
    resolvedByName = (data || []) as { id: string; name: string }[]
  }

  const allProductRows = [
    ...resolvedById,
    ...resolvedByName.filter((p) => !resolvedById.some((x) => x.id === p.id)),
  ]
  const allProductIds = [...new Set(allProductRows.map((p) => p.id))]
  const overrideRows = await fetchOverridesBatch(allProductIds)

  const productMap = buildProductMap(budgetData, allProductRows)
  const overrideIndex = buildOverrideIndex(overrideRows)

  return {
    tableRows: buildBudgetTableRows(budgetData, productMap, overrideIndex, params),
    summary: buildBudgetSummary(budgetData, productMap, overrideIndex, params),
    aliasByName,
  }
}
