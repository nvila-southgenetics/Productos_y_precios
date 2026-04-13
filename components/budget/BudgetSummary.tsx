"use client"

import { useEffect, useState } from "react"
import { TrendingUp, DollarSign, Package, Calendar } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { formatCurrency, formatNumber } from "@/lib/utils"

interface BudgetSummaryProps {
  year: number
  budgetName: string
  countries: string[]
  /** Array vacío = todos. */
  products: string[]
  months: string[]
  channels: string[]
}

const MONTH_KEYS = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
]

const MONTH_NAMES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
]

interface SummaryData {
  totalUnits: number
  totalGrossSale: number
  totalGrossProfit: number
  avgGrossMargin: number
}

function calculateGrossProfit(overrides: any): number {
  const grossSalesUSD = overrides?.grossSalesUSD || 0
  const commercialDiscountUSD = overrides?.commercialDiscountUSD || 0
  const salesRevenueUSD = grossSalesUSD - commercialDiscountUSD

  const totalCosts =
    (overrides?.productCostUSD || 0) +
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

export function BudgetSummary({ year, budgetName, countries, products, months, channels }: BudgetSummaryProps) {
  const [summary, setSummary] = useState<SummaryData>({
    totalUnits: 0,
    totalGrossSale: 0,
    totalGrossProfit: 0,
    avgGrossMargin: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSummary()
  }, [year, budgetName, countries, products, months, channels])

  const fetchSummary = async () => {
    setLoading(true)
    try {
      let query = supabase.from("budget").select("*").eq("year", year)
        .eq("budget_name", budgetName)

      if (countries.length > 0) {
        query = query.in("country_code", countries)
      }

      if (products.length > 0) {
        query = query.in("product_name", products)
      }

      if (channels.length > 0) {
        query = query.in("channel", channels)
      }

      const { data: budgetData, error } = await query

      if (error) throw error
      if (!budgetData || budgetData.length === 0) {
        setSummary({
          totalUnits: 0,
          totalGrossSale: 0,
          totalGrossProfit: 0,
          avgGrossMargin: 0,
        })
        setLoading(false)
        return
      }

      // Obtener productos únicos para hacer join con overrides
      type BudgetRow = { product_id: string | null; product_name: string }
      const productIds = budgetData
        .map((b: BudgetRow) => b.product_id)
        .filter((id: string | null): id is string => id !== null)
      const productNames = [...new Set(budgetData.map((b: BudgetRow) => b.product_name))]

      // Obtener productos
      const { data: productRows } = await supabase
        .from("products")
        .select("id, name")
        .in("id", productIds.length > 0 ? productIds : [null])

      // Mapear productos por nombre e ID
      const productMap = new Map<string, string>()
      productRows?.forEach((p: { name: string; id: string }) => {
        productMap.set(p.name, p.id)
      })

      // Calcular totales
      let totalUnits = 0
      let totalGrossSale = 0
      let totalGrossProfit = 0
      let totalCommercialDiscount = 0

      // Meses seleccionados: permitir 1/varios/todos
      const allMonthsSelected = months.length === 12
      const isMonthFiltered = !allMonthsSelected
      const monthIndices = Array.from(
        new Set(months.map((m) => parseInt(m, 10) - 1).filter((i) => i >= 0 && i < 12))
      )
      const monthKeysSelected = isMonthFiltered ? monthIndices.map((i) => MONTH_KEYS[i]) : []

      // Procesar cada registro con query individual para override correcto
      type SummaryRow = BudgetRow & { country_code: string; total_units?: number; [k: string]: unknown }
      await Promise.all(
        budgetData.map(async (row: SummaryRow) => {
          // Si hay filtro de mes, usar solo ese mes
          const units = isMonthFiltered
            ? monthKeysSelected.reduce(
                (sum, mk) => sum + Number((row as Record<string, unknown>)[mk as string] ?? 0),
                0
              )
            : (row.total_units || 0)

          totalUnits += units

          const productId = row.product_id || productMap.get(row.product_name)
          if (!productId) return

          // Buscar el override para este producto, país y canal específico (o fallback)
          const channelToQuery =
            channels.length === 1
              ? channels[0]
              : (row as SummaryRow & { channel?: string }).channel || "Paciente"
          let overrideDataObj: Record<string, number> = {}

          const { data: channelOverride } = await supabase
            .from("product_country_overrides")
            .select("overrides")
            .eq("product_id", productId)
            .eq("country_code", row.country_code)
            .eq("channel", channelToQuery)
            .maybeSingle()

          if (channelOverride?.overrides) {
            overrideDataObj = channelOverride.overrides
          } else {
            const { data: fallbackOverride } = await supabase
              .from("product_country_overrides")
              .select("overrides")
              .eq("product_id", productId)
              .eq("country_code", row.country_code)
              .order("cl_config_type", { ascending: true })
              .order("mx_config_type", { ascending: true })
              .order("col_config_type", { ascending: true })
              .limit(1)
              .maybeSingle()
            overrideDataObj = fallbackOverride?.overrides || {}
          }

          const grossSaleUSD = overrideDataObj.grossSalesUSD || 0
          const commercialDiscountUSD = overrideDataObj.commercialDiscountUSD || 0
          const grossProfitUSD = calculateGrossProfit(overrideDataObj)

          totalGrossSale += grossSaleUSD * units
          totalGrossProfit += grossProfitUSD * units
          totalCommercialDiscount += commercialDiscountUSD * units
        })
      )

      // Calcular el margen promedio sobre Sales Revenue (Gross Sale - Commercial Discount)
      const totalSalesRevenue = totalGrossSale - totalCommercialDiscount
      const avgGrossMargin =
        totalSalesRevenue > 0 ? (totalGrossProfit / totalSalesRevenue) * 100 : 0

      setSummary({
        totalUnits,
        totalGrossSale,
        totalGrossProfit,
        avgGrossMargin,
      })
    } catch (error) {
      console.error("Error fetching summary:", error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        Cargando resumen...
      </div>
    )
  }

  // Texto dinámico según filtro
  const allMonthsSelected = months.length === 12
  const isMonthFiltered = !allMonthsSelected
  const periodText = isMonthFiltered
    ? months.length === 1
      ? `${MONTH_NAMES[parseInt(months[0], 10) - 1]} ${year}`
      : `Meses seleccionados (${months.length}) ${year}`
    : `Año ${year}`

  const unitsLabel = isMonthFiltered
    ? months.length === 1
      ? "Total de unidades del mes"
      : "Total de unidades seleccionadas"
    : "Total de unidades del año"

  const grossSaleLabel = isMonthFiltered
    ? months.length === 1
      ? "Gross Sale del Mes"
      : "Gross Sale Seleccionado(s)"
    : "Total Gross Sale"

  const grossProfitLabel = isMonthFiltered
    ? months.length === 1
      ? "Gross Profit del Mes"
      : "Gross Profit Seleccionado(s)"
    : "Total Gross Profit"

  return (
    <div className="space-y-3">
      {/* Indicador de período */}
      {isMonthFiltered && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="w-4 h-4" />
          <span>
            Período: <strong>{periodText}</strong>
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Total Unidades */}
        <div className="bg-white/10 backdrop-blur-sm p-4 rounded-lg border border-white/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white/70">
                {unitsLabel}
              </p>
              <p className="text-2xl font-bold mt-1 text-white">
                {formatNumber(summary.totalUnits, "es-UY")}
              </p>
            </div>
            <Package className="w-8 h-8 text-blue-300" />
          </div>
        </div>

        {/* Total Gross Sale */}
        <div className="bg-white/10 backdrop-blur-sm p-4 rounded-lg border border-white/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white/70">
                {grossSaleLabel}
              </p>
              <p className="text-2xl font-bold mt-1 text-blue-300">
                {formatCurrency(summary.totalGrossSale)}
              </p>
            </div>
            <DollarSign className="w-8 h-8 text-blue-300" />
          </div>
        </div>

        {/* Total Gross Profit */}
        <div className="bg-white/10 backdrop-blur-sm p-4 rounded-lg border border-white/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white/70">
                {grossProfitLabel}
              </p>
              <p className="text-2xl font-bold mt-1 text-emerald-300">
                {formatCurrency(summary.totalGrossProfit)}
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-emerald-300" />
          </div>
        </div>

        {/* Margen Promedio */}
        <div className="bg-white/10 backdrop-blur-sm p-4 rounded-lg border border-white/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white/70">Margen Promedio</p>
              <p className="text-2xl font-bold mt-1 text-purple-300">
                {summary.avgGrossMargin.toFixed(1)}%
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-purple-300" />
          </div>
        </div>
      </div>
    </div>
  )
}

