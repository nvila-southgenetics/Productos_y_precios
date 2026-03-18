"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ChevronDown, ChevronRight, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"
import { formatCurrency, productNameSortKey, displayProductName } from "@/lib/utils"
import { useProductCreateDialog } from "@/components/products/ProductCreateDialogProvider"

interface BudgetRow {
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

interface BudgetTableProps {
  year: number
  country: string
  /** Array vacío = todos. */
  products: string[]
  month: string
  channel: string
  /** Cuando country === "all" y hay varios países permitidos (no-admin), filtrar por estos. */
  allowedCountryCodes?: string[]
  /** Permite crear productos desde el budget cuando no existen. */
  canEdit?: boolean
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

export function BudgetTable({ year, country, products, month, channel, allowedCountryCodes, canEdit }: BudgetTableProps) {
  const [data, setData] = useState<BudgetRow[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [creatingProductFor, setCreatingProductFor] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const { openCreateProductDialog } = useProductCreateDialog()

  useEffect(() => {
    fetchBudgetData()
  }, [year, country, products, month, channel, allowedCountryCodes])

  const fetchBudgetData = async () => {
    setLoading(true)
    try {
      let query = supabase.from("budget").select("*").eq("year", year)

      if (country !== "all") {
        query = query.eq("country_code", country)
      } else if (allowedCountryCodes?.length) {
        query = query.in("country_code", allowedCountryCodes)
      }

      if (products.length > 0) {
        query = query.in("product_name", products)
      }

      // Filtrar por canal si no es "all"
      if (channel !== "all") {
        query = query.eq("channel", channel)
      }

      const { data: budgetData, error } = await query

      if (error) throw error
      if (!budgetData || budgetData.length === 0) {
        setData([])
        setLoading(false)
        return
      }

      // Obtener productos únicos para hacer join con overrides
      type RawBudgetRow = { product_id: string | null; product_name: string; channel: string }
      const productIds = budgetData
        .map((b: RawBudgetRow) => b.product_id)
        .filter((id: string | null): id is string => id !== null)

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

      // Determinar si estamos filtrando por mes
      const isMonthFiltered = month !== "all"
      const monthIndex = isMonthFiltered ? parseInt(month) - 1 : -1
      const monthKey = isMonthFiltered ? MONTH_KEYS[monthIndex] : null

      type RawRow = { id: string; country: string; country_code: string; product_id: string | null; product_name: string; channel: string; total_units?: number } & Record<string, unknown>

      // Cuando channel = "all", agrupar por (country_code, product_name) y sumar unidades
      // Cuando channel es específico, mostrar cada fila directamente
      let rowsToProcess: RawRow[]

      if (channel === "all") {
        // Agrupar por (country_code, product_name) - usar la primera fila como base y sumar meses
        const grouped = new Map<string, RawRow>()
        for (const row of budgetData as RawRow[]) {
          const key = `${row.country_code}|${row.product_name}`
          if (!grouped.has(key)) {
            grouped.set(key, { ...row })
          } else {
            const existing = grouped.get(key)!
            for (const mk of MONTH_KEYS) {
              (existing as Record<string, unknown>)[mk as string] = (Number(existing[mk as string] ?? 0) + Number(row[mk as string] ?? 0))
            }
          }
        }
        rowsToProcess = Array.from(grouped.values())
      } else {
        rowsToProcess = budgetData as RawRow[]
      }

      // Procesar datos y calcular financieros
      const processedData: BudgetRow[] = await Promise.all(
        rowsToProcess.map(async (row: RawRow) => {
          const productId = row.product_id || productMap.get(row.product_name) || null

          let totalGrossSale = 0
          let totalGrossProfit = 0
          let monthlyUnits = 0
          let monthlyGrossSale = 0
          let monthlyGrossProfit = 0
          let rowTotalUnits = MONTH_KEYS.reduce((sum, mk) => sum + Number(row[mk as string] ?? 0), 0)

          if (isMonthFiltered && monthKey) {
            monthlyUnits = Number(row[monthKey as keyof RawRow] ?? 0)
          } else {
            monthlyUnits = rowTotalUnits
          }

          if (productId) {
            // Buscar override para este producto, país y canal específico (o Paciente como fallback)
            const channelToQuery = channel !== "all" ? channel : "Paciente"
            let overrideQuery = supabase
              .from("product_country_overrides")
              .select("overrides, channel")
              .eq("product_id", productId)
              .eq("country_code", row.country_code)

            // Intentar canal específico primero, si no hay fallback a cualquiera
            const { data: channelOverride } = await overrideQuery
              .eq("channel", channelToQuery)
              .maybeSingle()

            let overrideDataObj: Record<string, number> = {}
            if (channelOverride?.overrides) {
              overrideDataObj = channelOverride.overrides
            } else {
              // Fallback: tomar el primero disponible para este país
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
            const commercialDiscountUSDPerUnit = overrideDataObj.commercialDiscountUSD || 0
            const grossProfitUSD = calculateGrossProfit(overrideDataObj)

            if (channel === "all") {
              // Para "todos los canales", calcular la contribución de cada canal por separado
              // Buscamos todos los registros de budget para este producto/país y multiplicamos por sus overrides
              const channelRows = (budgetData as RawRow[]).filter(
                r => r.country_code === row.country_code && r.product_name === row.product_name
              )
              let sumGrossSale = 0
              let sumGrossProfit = 0
              let sumCommercialDiscount = 0

              await Promise.all(channelRows.map(async (cr) => {
                const crProductId = cr.product_id || productMap.get(cr.product_name) || null
                if (!crProductId) return
                const crUnits = isMonthFiltered && monthKey
                  ? Number(cr[monthKey as string] ?? 0)
                  : MONTH_KEYS.reduce((s, mk) => s + Number(cr[mk as string] ?? 0), 0)

                const { data: crOverride } = await supabase
                  .from("product_country_overrides")
                  .select("overrides")
                  .eq("product_id", crProductId)
                  .eq("country_code", cr.country_code)
                  .eq("channel", cr.channel)
                  .maybeSingle()

                const crOverrideObj = crOverride?.overrides || overrideDataObj
                sumGrossSale += (crOverrideObj.grossSalesUSD || 0) * crUnits
                sumGrossProfit += calculateGrossProfit(crOverrideObj) * crUnits
                sumCommercialDiscount += (crOverrideObj.commercialDiscountUSD || 0) * crUnits
              }))

              totalGrossSale = sumGrossSale
              totalGrossProfit = sumGrossProfit
              if (isMonthFiltered) {
                monthlyGrossSale = sumGrossSale
                monthlyGrossProfit = sumGrossProfit
              }
              return {
                id: row.id,
                country: row.country as string,
                country_code: row.country_code,
                product_name: row.product_name,
                product_id: productId,
                jan: Number(row.jan ?? 0), feb: Number(row.feb ?? 0), mar: Number(row.mar ?? 0),
                apr: Number(row.apr ?? 0), may: Number(row.may ?? 0), jun: Number(row.jun ?? 0),
                jul: Number(row.jul ?? 0), aug: Number(row.aug ?? 0), sep: Number(row.sep ?? 0),
                oct: Number(row.oct ?? 0), nov: Number(row.nov ?? 0), dec: Number(row.dec ?? 0),
                total_units: rowTotalUnits,
                total_gross_sale: totalGrossSale,
                total_gross_profit: totalGrossProfit,
                monthly_units: monthlyUnits,
                monthly_gross_sale: monthlyGrossSale,
                monthly_gross_profit: monthlyGrossProfit,
                commercial_discount: sumCommercialDiscount,
                monthly_commercial_discount: isMonthFiltered ? sumCommercialDiscount : 0,
              }
            }

            totalGrossSale = grossSaleUSD * rowTotalUnits
            totalGrossProfit = grossProfitUSD * rowTotalUnits

            if (isMonthFiltered && monthKey) {
              monthlyGrossSale = grossSaleUSD * monthlyUnits
              monthlyGrossProfit = grossProfitUSD * monthlyUnits
            }

            return {
              id: row.id,
              country: row.country as string,
              country_code: row.country_code,
              product_name: row.product_name,
              product_id: productId,
              jan: Number(row.jan ?? 0), feb: Number(row.feb ?? 0), mar: Number(row.mar ?? 0),
              apr: Number(row.apr ?? 0), may: Number(row.may ?? 0), jun: Number(row.jun ?? 0),
              jul: Number(row.jul ?? 0), aug: Number(row.aug ?? 0), sep: Number(row.sep ?? 0),
              oct: Number(row.oct ?? 0), nov: Number(row.nov ?? 0), dec: Number(row.dec ?? 0),
              total_units: rowTotalUnits,
              total_gross_sale: totalGrossSale,
              total_gross_profit: totalGrossProfit,
              monthly_units: monthlyUnits,
              monthly_gross_sale: monthlyGrossSale,
              monthly_gross_profit: monthlyGrossProfit,
              commercial_discount: commercialDiscountUSDPerUnit * rowTotalUnits,
              monthly_commercial_discount: isMonthFiltered && monthKey
                ? commercialDiscountUSDPerUnit * monthlyUnits
                : 0,
            }
          }

          return {
            id: row.id,
            country: row.country as string,
            country_code: row.country_code,
            product_name: row.product_name,
            product_id: null,
            jan: Number(row.jan ?? 0), feb: Number(row.feb ?? 0), mar: Number(row.mar ?? 0),
            apr: Number(row.apr ?? 0), may: Number(row.may ?? 0), jun: Number(row.jun ?? 0),
            jul: Number(row.jul ?? 0), aug: Number(row.aug ?? 0), sep: Number(row.sep ?? 0),
            oct: Number(row.oct ?? 0), nov: Number(row.nov ?? 0), dec: Number(row.dec ?? 0),
            total_units: rowTotalUnits,
            total_gross_sale: 0,
            total_gross_profit: 0,
            monthly_units: monthlyUnits,
            monthly_gross_sale: 0,
            monthly_gross_profit: 0,
            commercial_discount: 0,
            monthly_commercial_discount: 0,
          }
        })
      )

      // Ordenar por país y luego por producto (ignorar "[" al inicio del nombre)
      processedData.sort((a, b) => {
        if (a.country !== b.country) {
          return a.country.localeCompare(b.country)
        }
        return productNameSortKey(a.product_name).localeCompare(productNameSortKey(b.product_name), "es", { sensitivity: "base" })
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

  const handleCreateProductFromBudget = async (row: BudgetRow) => {
    if (!canEdit || !row.product_name || creating) return
    setCreating(true)
    setCreatingProductFor(row.id)

    openCreateProductDialog({
      defaultName: row.product_name,
      onCreated: async (product) => {
        try {
          await supabase
            .from("budget")
            .update({ product_id: product.id })
            .eq("year", year)
            .eq("product_name", row.product_name)
          await fetchBudgetData()
        } catch (error) {
          console.error("Error al vincular producto creado a budget:", error)
          alert("No se pudo vincular el producto al budget. Intenta nuevamente.")
        } finally {
          setCreating(false)
          setCreatingProductFor(null)
        }
      },
      onCancel: () => {
        setCreating(false)
        setCreatingProductFor(null)
      },
    })
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
                    <div className="flex items-center gap-2">
                      {row.product_id ? (
                        <Link
                          href={`/productos/${row.product_id}`}
                          className="text-blue-300 hover:text-blue-200 hover:underline text-sm font-medium"
                        >
                          {displayProductName(row.product_name)}
                        </Link>
                      ) : (
                        <>
                          <span className="text-white/70 text-sm">
                            {displayProductName(row.product_name)}
                          </span>
                          {canEdit && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 text-green-300 hover:text-green-200 hover:bg-white/10"
                              title="Crear producto y vincular"
                              onClick={() => handleCreateProductFromBudget(row)}
                              disabled={creating && creatingProductFor === row.id}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          )}
                        </>
                      )}
                    </div>
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

