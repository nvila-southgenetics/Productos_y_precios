"use client"

import { useState, useEffect } from "react"
import { ChevronDown, ChevronRight, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { ProductSalesTable, calculateGrossSale, calculateGrossProfit } from "./ProductSalesTable"
import { MonthlyPLModal } from "./MonthlyPLModal"
import { cn, formatCurrency } from "@/lib/utils"
import type { MonthlySalesWithProduct } from "@/lib/supabase-mcp"

interface MonthDropdownProps {
  periodo: string
  sales: MonthlySalesWithProduct[]
  isTotal?: boolean
  onExpand?: (periodo: string) => void
  isLoading?: boolean
  selectedCompany?: string
  isAllCompanies?: boolean
}

const monthNames: Record<string, string> = {
  "01": "Enero",
  "02": "Febrero",
  "03": "Marzo",
  "04": "Abril",
  "05": "Mayo",
  "06": "Junio",
  "07": "Julio",
  "08": "Agosto",
  "09": "Septiembre",
  "10": "Octubre",
  "11": "Noviembre",
  "12": "Diciembre",
}

function formatPeriodo(periodo: string): string {
  if (periodo === "Total") return "Total"
  const parts = periodo.split("-")
  if (parts.length !== 2) return periodo
  const [year, month] = parts
  const monthName = monthNames[month] || month
  return `${monthName} ${year}`
}

export function MonthDropdown({ 
  periodo, 
  sales, 
  isTotal = false, 
  onExpand,
  isLoading = false,
  selectedCompany = "",
  isAllCompanies = false
}: MonthDropdownProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isChecked, setIsChecked] = useState(false)
  const [showPLModal, setShowPLModal] = useState(false)

  // Calcular totales
  const totalCantidad = sales.reduce((sum, sale) => sum + sale.cantidad_ventas, 0)
  const totalGrossSale = sales.reduce((sum, sale) => {
    return sum + calculateGrossSale(sale.overrides, sale.cantidad_ventas)
  }, 0)
  const totalGrossProfit = sales.reduce((sum, sale) => {
    return sum + calculateGrossProfit(sale.overrides, sale.cantidad_ventas)
  }, 0)
  const totalGrossSaleOdoo = sales.reduce((sum, sale) => sum + (sale.monto_total || 0), 0)

  // Cargar datos automáticamente cuando se monta el componente si no hay datos
  useEffect(() => {
    // Guards: evitar cargas innecesarias
    if (isTotal) return // El total se carga por separado
    if (!onExpand) return
    if (sales.length > 0) return // Ya tenemos datos
    if (isLoading) return // Ya está cargando
    
    // Cargar datos automáticamente al montar o cuando sales se vacía
    const timeoutId = setTimeout(() => {
      if (onExpand) {
        onExpand(periodo)
      }
    }, 100) // Pequeño delay para evitar múltiples llamadas
    
    return () => clearTimeout(timeoutId)
  }, [periodo, isTotal, sales.length]) // Incluir sales.length para detectar cuando se limpian los datos

  // Cargar datos cuando se expande (fallback)
  useEffect(() => {
    // Guards: evitar cargas innecesarias
    if (!isExpanded) return
    if (isTotal) return // El total se carga por separado
    if (!onExpand) return
    if (sales.length > 0) return // Ya tenemos datos
    if (isLoading) return // Ya está cargando
    
    // Cargar datos solo si se cumplen todas las condiciones
    const timeoutId = setTimeout(() => {
      if (onExpand) {
        onExpand(periodo)
      }
    }, 0)
    
    return () => clearTimeout(timeoutId)
  }, [isExpanded])

  return (
    <div className="border border-white/20 rounded-lg overflow-hidden bg-white/10 backdrop-blur-sm">
      {/* Header del Dropdown */}
      <div
        className="flex items-center justify-between px-4 py-2.5 bg-white/10 hover:bg-white/15 transition-colors cursor-pointer border-b border-white/10"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2 flex-1">
          <Checkbox
            checked={isChecked}
            onChange={(checked) => {
              setIsChecked(checked)
              // Evitar que se expanda al hacer clic en checkbox
            }}
            onClick={(e) => e.stopPropagation()}
          />
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-white" />
          ) : (
            <ChevronRight className="h-4 w-4 text-white" />
          )}
          <span className="font-medium text-sm text-white">
            {isTotal ? "Total" : formatPeriodo(periodo)}
          </span>
          <span className={cn(
            "text-xs font-semibold px-2 py-0.5 rounded",
            totalCantidad > 0 ? "text-blue-200 bg-blue-500/20" : "text-white/50"
          )}>
            {isLoading ? "Cargando..." : `${totalCantidad.toLocaleString('es-UY')} ventas`}
          </span>
          {/* Totales en vista previa */}
          {!isLoading && sales.length > 0 && (
            <div className="flex items-center gap-3 ml-4 text-xs">
              <span className="text-sky-300 font-medium">
                GS: {formatCurrency(totalGrossSale)}
              </span>
              <span className="text-orange-300 font-medium">
                GP: {formatCurrency(totalGrossProfit)}
              </span>
              <span className="text-emerald-300 font-medium">
                Odoo: {formatCurrency(totalGrossSaleOdoo)}
              </span>
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-white/70 hover:text-white hover:bg-white/10"
          onClick={(e) => {
            e.stopPropagation()
            setShowPLModal(true)
          }}
        >
          <FileText className="h-3 w-3 mr-1" />
          {isTotal ? "P&L Anual" : "P&L"}
        </Button>
      </div>

      {/* Contenido del Dropdown */}
      {isExpanded && (
        <div className="p-3 bg-white/5">
          {isLoading ? (
            <div className="text-center py-6 text-white/60 text-sm">
              Cargando datos...
            </div>
          ) : (
            <ProductSalesTable 
              sales={sales} 
              isAllCompanies={isAllCompanies}
              isTotal={isTotal}
            />
          )}
        </div>
      )}

      {/* Modal de P&L */}
      <MonthlyPLModal
        isOpen={showPLModal}
        onClose={() => setShowPLModal(false)}
        periodo={periodo}
        compañía={selectedCompany}
        productsData={sales}
      />
    </div>
  )
}

