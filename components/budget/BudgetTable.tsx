"use client"

import { useState } from "react"
import Link from "next/link"
import { ChevronDown, ChevronRight, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"
import { formatCurrency, formatNumber, displayProductLabelFromName } from "@/lib/utils"
import { useProductCreateDialog } from "@/components/products/ProductCreateDialogProvider"
import { BUDGET_MONTH_KEYS, type BudgetRow } from "@/lib/budget-data"

interface BudgetTableProps {
  data: BudgetRow[]
  aliasByName: Record<string, string>
  loading: boolean
  year: number
  months: string[]
  canEdit?: boolean
  onProductLinked?: () => void
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

function calculateMargin(grossSale: number, grossProfit: number, commercialDiscount: number = 0): number {
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

export function BudgetTable({
  data,
  aliasByName,
  loading,
  year,
  months,
  canEdit,
  onProductLinked,
}: BudgetTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [creatingProductFor, setCreatingProductFor] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const { openCreateProductDialog } = useProductCreateDialog()

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
          onProductLinked?.()
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
  const allMonthsSelected = months.length === 12
  const isMonthFiltered = !allMonthsSelected
  const monthName = isMonthFiltered
    ? months.length === 1
      ? MONTH_NAMES[parseInt(months[0], 10) - 1]
      : `${months.length} meses`
    : ""

  return (
    <div className="border border-white/20 rounded-lg overflow-hidden bg-white/10 backdrop-blur-sm shadow-sm">
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
            const grossSale = isMonthFiltered ? row.monthly_gross_sale || 0 : row.total_gross_sale
            const grossProfit = isMonthFiltered ? row.monthly_gross_profit || 0 : row.total_gross_profit
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
                          {displayProductLabelFromName(row.product_name, aliasByName)}
                        </Link>
                      ) : (
                        <>
                          <span className="text-white/70 text-sm">
                            {displayProductLabelFromName(row.product_name, aliasByName)}
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
                      ? formatNumber(row.monthly_units || 0, "es-UY")
                      : formatNumber(row.total_units, "es-UY")}
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

                {!isMonthFiltered && expandedRows.has(row.id) && (
                  <tr key={`${row.id}-detail`}>
                    <td colSpan={7} className="px-3 py-3 bg-white/5">
                      <div className="space-y-2">
                        <h4 className="text-xs font-semibold text-white/70">
                          Proyección Mensual {year}
                        </h4>
                        <div className="grid grid-cols-12 gap-1">
                          {monthLabels.map((month, idx) => {
                            const monthKey = BUDGET_MONTH_KEYS[idx]
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
