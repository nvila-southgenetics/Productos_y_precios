"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ChevronDown, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"
import { formatCurrency } from "@/lib/utils"

interface BudgetRow {
  id: string
  country: string
  country_code: string
  product_name: string
  product_id: string | null
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
}

interface BudgetTableProps {
  year: number
  country: string
  product: string
  month: string
}

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

const MONTH_KEYS: (keyof BudgetRow)[] = [
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

function calculateMargin(grossSale: number, grossProfit: number): number {
  if (grossSale === 0) return 0
  return (grossProfit / grossSale) * 100
}

function formatMargin(margin: number): string {
  if (margin === 0) return "-"
  return `${margin.toFixed(1)}%`
}

function getMarginColor(margin: number): string {
  if (margin >= 50) return "text-green-600"
  if (margin >= 30) return "text-yellow-600"
  if (margin > 0) return "text-orange-600"
  return "text-gray-400"
}

export function BudgetTable({ year, country, product, month }: BudgetTableProps) {
  const [data, setData] = useState<BudgetRow[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchBudgetData()
  }, [year, country, product, month])

  const fetchBudgetData = async () => {
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
        setData([])
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

      // Determinar si estamos filtrando por mes
      const isMonthFiltered = month !== "all"
      const monthIndex = isMonthFiltered ? parseInt(month) - 1 : -1
      const monthKey = isMonthFiltered ? MONTH_KEYS[monthIndex] : null

      // Procesar datos y calcular financieros
      const processedData: BudgetRow[] = budgetData.map((row) => {
        const productId = row.product_id || productMap.get(row.product_name) || null

        let totalGrossSale = 0
        let totalGrossProfit = 0
        let monthlyUnits = row.total_units || 0
        let monthlyGrossSale = 0
        let monthlyGrossProfit = 0

        if (productId) {
          const countryOverrides = overrides?.filter(
            (o) => o.product_id === productId && o.country_code === row.country_code
          )

          const override = countryOverrides?.[0]
          const overrideData = override?.overrides || {}

          const grossSaleUSD = overrideData.grossSalesUSD || 0
          const grossProfitUSD = calculateGrossProfit(overrideData)

          totalGrossSale = grossSaleUSD * row.total_units
          totalGrossProfit = grossProfitUSD * row.total_units

          // Calcular valores específicos del mes si está filtrado
          if (isMonthFiltered && monthKey) {
            monthlyUnits = row[monthKey as keyof typeof row] || 0
            monthlyGrossSale = grossSaleUSD * monthlyUnits
            monthlyGrossProfit = grossProfitUSD * monthlyUnits
          }
        }

        return {
          id: row.id,
          country: row.country,
          country_code: row.country_code,
          product_name: row.product_name,
          product_id: productId,
          jan: row.jan || 0,
          feb: row.feb || 0,
          mar: row.mar || 0,
          apr: row.apr || 0,
          may: row.may || 0,
          jun: row.jun || 0,
          jul: row.jul || 0,
          aug: row.aug || 0,
          sep: row.sep || 0,
          oct: row.oct || 0,
          nov: row.nov || 0,
          dec: row.dec || 0,
          total_units: row.total_units || 0,
          total_gross_sale: totalGrossSale,
          total_gross_profit: totalGrossProfit,
          monthly_units: monthlyUnits,
          monthly_gross_sale: monthlyGrossSale,
          monthly_gross_profit: monthlyGrossProfit,
        }
      })

      // Ordenar por país y luego por producto
      processedData.sort((a, b) => {
        if (a.country !== b.country) {
          return a.country.localeCompare(b.country)
        }
        return a.product_name.localeCompare(b.product_name)
      })

      setData(processedData)
    } catch (error) {
      console.error("Error fetching budget data:", error)
    } finally {
      setLoading(false)
    }
  }

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedRows(newExpanded)
  }

  if (loading) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        Cargando datos...
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        No hay datos de presupuesto para los filtros seleccionados
      </div>
    )
  }

  const monthLabels = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"]
  const isMonthFiltered = month !== "all"
  const monthName = isMonthFiltered ? MONTH_NAMES[parseInt(month) - 1] : ""

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Indicador de mes filtrado */}
      {isMonthFiltered && (
        <div className="bg-blue-50 px-4 py-2 border-b">
          <p className="text-sm text-blue-700">
            📅 Mostrando proyecciones para <strong>{monthName} {year}</strong>
          </p>
        </div>
      )}

      <table className="w-full text-sm">
        <thead className="bg-muted/50 border-b">
          <tr>
            <th className="text-left px-3 py-2 font-medium text-xs">País</th>
            <th className="text-left px-3 py-2 font-medium text-xs">Producto</th>
            <th className="text-right px-3 py-2 font-medium text-xs">
              {isMonthFiltered ? `Unidades (${monthName})` : "Total Unidades"}
            </th>
            <th className="text-right px-3 py-2 font-medium text-xs">Gross Sale</th>
            <th className="text-right px-3 py-2 font-medium text-xs">Gross Profit</th>
            <th className="text-right px-3 py-2 font-medium text-xs">Margen</th>
            {!isMonthFiltered && (
              <th className="text-center px-3 py-2 font-medium text-xs">Detalle</th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y">
          {data.map((row) => {
            // Calcular margen según si hay filtro de mes o no
            const grossSale = isMonthFiltered
              ? row.monthly_gross_sale || 0
              : row.total_gross_sale
            const grossProfit = isMonthFiltered
              ? row.monthly_gross_profit || 0
              : row.total_gross_profit
            const margin = calculateMargin(grossSale, grossProfit)

            return (
              <>
                <tr key={row.id} className="hover:bg-muted/50 transition-colors">
                  <td className="px-3 py-2 text-sm">{row.country}</td>
                  <td className="px-3 py-2">
                    {row.product_id ? (
                      <Link
                        href={`/productos/${row.product_id}`}
                        className="text-primary hover:underline text-sm font-medium"
                      >
                        {row.product_name}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground text-sm">{row.product_name}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-sm">
                    {isMonthFiltered
                      ? (row.monthly_units || 0).toLocaleString("es-UY")
                      : row.total_units.toLocaleString("es-UY")}
                  </td>
                  <td className="px-3 py-2 text-right text-blue-600 font-medium text-sm">
                    {formatCurrency(grossSale)}
                  </td>
                  <td className="px-3 py-2 text-right text-green-600 font-medium text-sm">
                    {formatCurrency(grossProfit)}
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-sm">
                    <span className={getMarginColor(margin)}>{formatMargin(margin)}</span>
                  </td>
                  {!isMonthFiltered && (
                    <td className="px-3 py-2 text-center">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0"
                        onClick={() => toggleRow(row.id)}
                      >
                        {expandedRows.has(row.id) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                    </td>
                  )}
                </tr>

              {/* Fila expandida con detalle mensual - SOLO si no hay filtro de mes */}
              {!isMonthFiltered && expandedRows.has(row.id) && (
                <tr>
                  <td colSpan={7} className="px-3 py-3 bg-muted/30">
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-muted-foreground">
                        Proyección Mensual {year}
                      </h4>
                      <div className="grid grid-cols-12 gap-1">
                        {monthLabels.map((month, idx) => {
                          const monthKey = MONTH_KEYS[idx]
                          const units = row[monthKey] || 0

                          return (
                            <div
                              key={month}
                              className="text-center p-2 bg-background rounded border"
                            >
                              <div className="text-xs text-muted-foreground">{month}</div>
                              <div className="text-sm font-semibold">{units}</div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </td>
                </tr>
              )}
              </>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

