"use client"

import { TrendingUp, DollarSign, Package, Calendar } from "lucide-react"
import { formatCurrency, formatNumber } from "@/lib/utils"
import type { BudgetSummaryData } from "@/lib/budget-data"

interface BudgetSummaryProps {
  summary: BudgetSummaryData
  loading: boolean
  year: number
  months: string[]
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

export function BudgetSummary({ summary, loading, year, months }: BudgetSummaryProps) {
  if (loading) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        Cargando resumen...
      </div>
    )
  }

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
      {isMonthFiltered && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="w-4 h-4" />
          <span>
            Período: <strong>{periodText}</strong>
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white/10 backdrop-blur-sm p-4 rounded-lg border border-white/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white/70">{unitsLabel}</p>
              <p className="text-2xl font-bold mt-1 text-white">
                {formatNumber(summary.totalUnits, "es-UY")}
              </p>
            </div>
            <Package className="w-8 h-8 text-blue-300" />
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-sm p-4 rounded-lg border border-white/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white/70">{grossSaleLabel}</p>
              <p className="text-2xl font-bold mt-1 text-blue-300">
                {formatCurrency(summary.totalGrossSale)}
              </p>
            </div>
            <DollarSign className="w-8 h-8 text-blue-300" />
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-sm p-4 rounded-lg border border-white/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white/70">{grossProfitLabel}</p>
              <p className="text-2xl font-bold mt-1 text-emerald-300">
                {formatCurrency(summary.totalGrossProfit)}
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-emerald-300" />
          </div>
        </div>

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
