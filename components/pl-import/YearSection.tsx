"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import { MonthDropdown } from "./MonthDropdown"
import { cn } from "@/lib/utils"
import type { MonthlySalesWithProduct } from "@/lib/supabase-mcp"

interface YearSectionProps {
  year: string
  periods: string[]
  monthlyData: Record<string, MonthlySalesWithProduct[]>
  loadingPeriods: Set<string>
  selectedCompany: string
  onExpandPeriod: (periodo: string) => void
  totalData?: MonthlySalesWithProduct[]
  isAllCompanies?: boolean
}

export function YearSection({
  year,
  periods,
  monthlyData,
  loadingPeriods,
  selectedCompany,
  onExpandPeriod,
  totalData,
  isAllCompanies = false,
}: YearSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true)

  // Calcular totales del año
  const yearTotal = periods.reduce((sum, periodo) => {
    const sales = monthlyData[periodo] || []
    return sum + sales.reduce((s, sale) => s + sale.cantidad_ventas, 0)
  }, 0)

  return (
    <div className="border rounded-lg overflow-hidden mb-4">
      {/* Header del Año */}
      <div
        className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 transition-colors cursor-pointer border-b"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="h-5 w-5 text-blue-700" />
          ) : (
            <ChevronRight className="h-5 w-5 text-blue-700" />
          )}
          <span className="font-bold text-lg text-blue-900">{year}</span>
          <span className={cn(
            "text-xs font-semibold px-2 py-1 rounded",
            yearTotal > 0 ? "text-blue-700 bg-blue-100" : "text-slate-500 bg-slate-100"
          )}>
            {yearTotal > 0 ? `Total: ${yearTotal} ventas` : "Sin ventas"}
          </span>
        </div>
      </div>

      {/* Contenido del Año */}
      {isExpanded && (
        <div className="p-3 bg-background space-y-2">
          {periods.map((periodo) => {
            const sales = monthlyData[periodo] || []
            const isLoading = loadingPeriods.has(periodo)

              return (
                <MonthDropdown
                  key={`${selectedCompany}-${periodo}`}
                  periodo={periodo}
                  sales={sales}
                  isTotal={false}
                  onExpand={onExpandPeriod}
                  isLoading={isLoading}
                  selectedCompany={selectedCompany}
                  isAllCompanies={isAllCompanies}
                />
              )
          })}

          {/* Mostrar total anual si está disponible y es el año seleccionado */}
          {totalData && totalData.length > 0 && (
            <MonthDropdown 
              key={`${selectedCompany}-Total-${year}`}
              periodo={`Total ${year}`} 
              sales={totalData} 
              isTotal={true}
              selectedCompany={selectedCompany}
              isAllCompanies={isAllCompanies}
            />
          )}
        </div>
      )}
    </div>
  )
}
