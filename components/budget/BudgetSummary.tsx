"use client"

import { useEffect, useState } from "react"
import { TrendingUp, DollarSign, Package, Calendar } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { formatCurrency } from "@/lib/utils"

interface BudgetSummaryProps {
  year: number
  country: string
  product: string
  month: string
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

export function BudgetSummary({ year, country, product, month }: BudgetSummaryProps) {
  const [summary, setSummary] = useState<SummaryData>({
    totalUnits: 0,
    totalGrossSale: 0,
    totalGrossProfit: 0,
    avgGrossMargin: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSummary()
  }, [year, country, product, month])

  const fetchSummary = async () => {
    setLoading(true)
    try {
      let query = supabase.from("budget").select("*").eq("year", year)

      if (country !== "all") {
        query = query.eq("country_code", country)
      }

      if (product !== "all") {
        query = query.eq("product_name", product)
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
      const productIds = budgetData
        .map((b) => b.product_id)
        .filter((id): id is string => id !== null)
      const productNames = [...new Set(budgetData.map((b) => b.product_name))]

      // Obtener productos
      const { data: products } = await supabase
        .from("products")
        .select("id, name")
        .in("id", productIds.length > 0 ? productIds : [null])

      // Obtener overrides
      const { data: overrides } = await supabase
        .from("product_country_overrides")
        .select("*")

      // Mapear productos por nombre e ID
      const productMap = new Map<string, string>()
      products?.forEach((p) => {
        productMap.set(p.name, p.id)
      })

      // Calcular totales
      let totalUnits = 0
      let totalGrossSale = 0
      let totalGrossProfit = 0

      // Determinar si estamos filtrando por mes
      const isMonthFiltered = month !== "all"
      const monthKey = isMonthFiltered ? MONTH_KEYS[parseInt(month) - 1] : null

      budgetData.forEach((row) => {
        // Si hay filtro de mes, usar solo ese mes
        const units = isMonthFiltered
          ? row[monthKey as keyof typeof row] || 0
          : row.total_units || 0

        totalUnits += units

        const productId = row.product_id || productMap.get(row.product_name)
        if (!productId) return

        const countryOverrides = overrides?.filter(
          (o) => o.product_id === productId && o.country_code === row.country_code
        )

        const override = countryOverrides?.[0]
        const overrideData = override?.overrides || {}

        const grossSaleUSD = overrideData.grossSalesUSD || 0
        const grossProfitUSD = calculateGrossProfit(overrideData)

        totalGrossSale += grossSaleUSD * units
        totalGrossProfit += grossProfitUSD * units
      })

      const avgGrossMargin =
        totalGrossSale > 0 ? (totalGrossProfit / totalGrossSale) * 100 : 0

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
  const isMonthFiltered = month !== "all"
  const periodText = isMonthFiltered
    ? `${MONTH_NAMES[parseInt(month) - 1]} ${year}`
    : `Año ${year}`

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
        <div className="bg-white p-4 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                {isMonthFiltered ? "Unidades del Mes" : "Total Unidades"}
              </p>
              <p className="text-2xl font-bold mt-1">
                {summary.totalUnits.toLocaleString("es-UY")}
              </p>
            </div>
            <Package className="w-8 h-8 text-blue-500" />
          </div>
        </div>

        {/* Total Gross Sale */}
        <div className="bg-white p-4 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                {isMonthFiltered ? "Gross Sale del Mes" : "Total Gross Sale"}
              </p>
              <p className="text-2xl font-bold mt-1 text-blue-600">
                {formatCurrency(summary.totalGrossSale)}
              </p>
            </div>
            <DollarSign className="w-8 h-8 text-blue-500" />
          </div>
        </div>

        {/* Total Gross Profit */}
        <div className="bg-white p-4 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                {isMonthFiltered ? "Gross Profit del Mes" : "Total Gross Profit"}
              </p>
              <p className="text-2xl font-bold mt-1 text-green-600">
                {formatCurrency(summary.totalGrossProfit)}
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-500" />
          </div>
        </div>

        {/* Margen Promedio */}
        <div className="bg-white p-4 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Margen Promedio</p>
              <p className="text-2xl font-bold mt-1 text-purple-600">
                {summary.avgGrossMargin.toFixed(1)}%
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-purple-500" />
          </div>
        </div>
      </div>
    </div>
  )
}

