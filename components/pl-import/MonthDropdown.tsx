"use client"

import { useState, useEffect } from "react"
import { ChevronDown, ChevronRight, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { ProductSalesTable } from "./ProductSalesTable"
import { MonthlyPLModal } from "./MonthlyPLModal"
import { cn } from "@/lib/utils"
import type { MonthlySalesWithProduct } from "@/lib/supabase-mcp"

interface MonthDropdownProps {
  periodo: string
  sales: MonthlySalesWithProduct[]
  isTotal?: boolean
  onExpand?: (periodo: string) => void
  isLoading?: boolean
  selectedCompany?: string
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
  selectedCompany = ""
}: MonthDropdownProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isChecked, setIsChecked] = useState(false)
  const [showPLModal, setShowPLModal] = useState(false)

  const totalCantidad = sales.reduce((sum, sale) => sum + sale.cantidad_ventas, 0)

  // Cargar datos solo cuando se expande y no hay datos
  useEffect(() => {
    // Guards: evitar cargas innecesarias
    if (!isExpanded) return
    if (isTotal) return // El total se carga por separado
    if (!onExpand) return
    if (sales.length > 0) return // Ya tenemos datos
    
    // Cargar datos solo si se cumplen todas las condiciones
    // Usar setTimeout para evitar llamadas síncronas que causen loops
    const timeoutId = setTimeout(() => {
      onExpand(periodo)
    }, 0)
    
    return () => clearTimeout(timeoutId)
  }, [isExpanded, periodo, isTotal, sales.length]) // Incluir sales.length pero con guard

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Header del Dropdown */}
      <div
        className="flex items-center justify-between px-4 py-2.5 bg-muted/50 hover:bg-muted/70 transition-colors cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <Checkbox
            checked={isChecked}
            onChange={(checked) => {
              setIsChecked(checked)
              // Evitar que se expanda al hacer clic en checkbox
            }}
            onClick={(e) => e.stopPropagation()}
          />
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          <span className="font-medium text-sm">
            {isTotal ? "Total" : formatPeriodo(periodo)}
          </span>
          <span className="text-xs text-muted-foreground">
            (Total: {totalCantidad})
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
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
        <div className="p-3 bg-background">
          {isLoading ? (
            <div className="text-center py-6 text-muted-foreground text-sm">
              Cargando datos...
            </div>
          ) : (
            <ProductSalesTable sales={sales} />
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

