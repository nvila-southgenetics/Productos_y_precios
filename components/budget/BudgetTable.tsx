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
  commercial_discount?: number
  monthly_commercial_discount?: number
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

function calculateMargin(grossSale: number, grossProfit: number, commercialDiscount: number = 0): number {
  // El margen se calcula sobre Sales Revenue (Gross Sales - Commercial Discount), no sobre Gross Sales
  const salesRevenue = grossSale - commercialDiscount
  if (salesRevenue === 0) return 0
  return (grossProfit / salesRevenue) * 100
}

function formatMargin(margin: number): string {
  if (margin === 0) return "-"
  return `${margin.toFixed(1)}%`
}

function getMarginColor(margin: number): string {
  if (margin >= 50) return "text-emerald-300"
  if (margin >= 30) return "text-blue-300"
  if (margin >= 20) return "text-yellow-300"
  if (margin >= 10) return "text-orange-300"
  return "text-red-300"
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
      // IMPORTANTE: Hacer query individual para cada override para asegurar el país correcto
      const processedData: BudgetRow[] = await Promise.all(
        budgetData.map(async (row) => {
          const productId = row.product_id || productMap.get(row.product_name) || null

          let totalGrossSale = 0
          let totalGrossProfit = 0
          let monthlyUnits = row.total_units || 0
          let monthlyGrossSale = 0
          let monthlyGrossProfit = 0
          let commercialDiscountUSD = 0

          if (productId) {
            // CRÍTICO: Buscar el override ESPECÍFICO para este producto Y este país
            // Priorizar el override "default" si hay múltiples
            const { data: overrideData } = await supabase
              .from("product_country_overrides")
              .select("overrides, cl_config_type, mx_config_type, col_config_type")
              .eq("product_id", productId)
              .eq("country_code", row.country_code)
              .order("cl_config_type", { ascending: true }) // "default" viene primero alfabéticamente
              .order("mx_config_type", { ascending: true })
              .order("col_config_type", { ascending: true })
              .limit(1)
              .maybeSingle()

            // Si no hay override "default", tomar el primero disponible
            const override = overrideData || null
            const overrideDataObj = override?.overrides || {}

            const grossSaleUSD = overrideDataObj.grossSalesUSD || 0
            commercialDiscountUSD = overrideDataObj.commercialDiscountUSD || 0
            const grossProfitUSD = calculateGrossProfit(overrideDataObj)

            // Debug log (solo en desarrollo)
            if (process.env.NODE_ENV === "development" && grossSaleUSD === 0) {
              console.warn(
                `⚠️ No se encontró override para ${row.product_name} en ${row.country_code} (product_id: ${productId})`
              )
            }

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
          // Guardar commercialDiscount para el cálculo del margen
          commercial_discount: commercialDiscountUSD * row.total_units,
          monthly_commercial_discount: isMonthFiltered && monthKey 
            ? commercialDiscountUSD * (row[monthKey as keyof typeof row] || 0)
            : 0,
        }
        })
      )

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
      <div className="text-center py-12 text-white/80 text-sm">
        Cargando datos...
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-white/60 text-sm">
        No hay datos de presupuesto para los filtros seleccionados
      </div>
    )
  }

  const monthLabels = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"]
  const isMonthFiltered = month !== "all"
  const monthName = isMonthFiltered ? MONTH_NAMES[parseInt(month) - 1] : ""

  return (
    <div className="border border-white/20 rounded-lg overflow-hidden bg-white/10 backdrop-blur-sm shadow-sm">
      {/* Indicador de mes filtrado */}
      {isMonthFiltered && (
        <div className="bg-white/10 px-4 py-2 border-b border-white/20">
          <p className="text-sm text-white/90">
            📅 Mostrando proyecciones para <strong>{monthName} {year}</strong>
          </p>
        </div>
      )}

      <table className="w-full text-sm">
        <thead className="bg-white/10 border-b border-white/20">
          <tr>
            <th className="text-left px-3 py-2 font-medium text-xs text-white">País</th>
            <th className="text-left px-3 py-2 font-medium text-xs text-white">Producto</th>
            <th className="text-right px-3 py-2 font-medium text-xs text-white">
              {isMonthFiltered ? `Unidades (${monthName})` : "Total Unidades"}
            </th>
            <th className="text-right px-3 py-2 font-medium text-xs text-white">Gross Sale</th>
            <th className="text-right px-3 py-2 font-medium text-xs text-white">Gross Profit</th>
            <th className="text-right px-3 py-2 font-medium text-xs text-white">Margen</th>
            {!isMonthFiltered && (
              <th className="text-center px-3 py-2 font-medium text-xs text-white">Detalle</th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10">
          {data.map((row) => {
            // Calcular margen según si hay filtro de mes o no
            const grossSale = isMonthFiltered
              ? row.monthly_gross_sale || 0
              : row.total_gross_sale
            const grossProfit = isMonthFiltered
              ? row.monthly_gross_profit || 0
              : row.total_gross_profit
            const commercialDiscount = isMonthFiltered
              ? row.monthly_commercial_discount || 0
              : row.commercial_discount || 0
            const margin = calculateMargin(grossSale, grossProfit, commercialDiscount)

            return (
              <>
                <tr key={row.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-3 py-2 text-sm text-white/90">{row.country}</td>
                  <td className="px-3 py-2">
                    {row.product_id ? (
                      <Link
                        href={`/productos/${row.product_id}`}
                        className="text-blue-300 hover:text-blue-200 hover:underline text-sm font-medium"
                      >
                        {row.product_name}
                      </Link>
                    ) : (
                      <span className="text-white/70 text-sm">{row.product_name}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-sm text-white">
                    {isMonthFiltered
                      ? (row.monthly_units || 0).toLocaleString("es-UY")
                      : row.total_units.toLocaleString("es-UY")}
                  </td>
                  <td className="px-3 py-2 text-right text-blue-300 font-medium text-sm">
                    {formatCurrency(grossSale)}
                  </td>
                  <td className="px-3 py-2 text-right text-emerald-300 font-medium text-sm">
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
                        className="h-6 w-6 p-0 text-white/70 hover:text-white hover:bg-white/10"
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
                  <td colSpan={7} className="px-3 py-3 bg-white/5">
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-white/70">
                        Proyección Mensual {year}
                      </h4>
                      <div className="grid grid-cols-12 gap-1">
                        {monthLabels.map((month, idx) => {
                          const monthKey = MONTH_KEYS[idx]
                          const units = row[monthKey] || 0

                          return (
                            <div
                              key={month}
                              className="text-center p-2 bg-white/10 rounded border border-white/20"
                            >
                              <div className="text-xs text-white/60">{month}</div>
                              <div className="text-sm font-semibold text-white">{units}</div>
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

