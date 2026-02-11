"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/utils"

interface CompanyBreakdownProps {
  breakdown: Array<{
    compañia: string
    cantidad_ventas: number
    monto_total: number | null
  }>
}

export function CompanyBreakdown({ breakdown }: CompanyBreakdownProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  
  const totalVentas = breakdown.reduce((sum, item) => sum + item.cantidad_ventas, 0)
  const totalMonto = breakdown.reduce((sum, item) => sum + (item.monto_total || 0), 0)
  
  return (
    <div className="relative">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 hover:underline"
      >
        {isExpanded ? (
          <ChevronUp className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )}
        <span>
          {breakdown.length} compañía{breakdown.length !== 1 ? 's' : ''} ({totalVentas.toLocaleString('es-UY')} ventas)
        </span>
      </button>
      
      {isExpanded && (
        <div className="absolute z-10 mt-1 bg-white border rounded-md shadow-lg p-2 min-w-[300px] max-h-[200px] overflow-y-auto">
          <div className="text-xs font-semibold mb-2 text-slate-700">Desglose por compañía:</div>
          <div className="space-y-1">
            {breakdown
              .sort((a, b) => b.cantidad_ventas - a.cantidad_ventas)
              .map((item, idx) => (
                <div key={idx} className="flex justify-between items-center text-xs py-1 border-b border-slate-100 last:border-0">
                  <span className="text-slate-700">{item.compañia}</span>
                  <div className="flex gap-3">
                    <span className="font-medium text-slate-800">{item.cantidad_ventas.toLocaleString('es-UY')}</span>
                    <span className="text-green-600 font-medium">{formatCurrency(item.monto_total || 0)}</span>
                  </div>
                </div>
              ))}
            <div className="flex justify-between items-center text-xs font-semibold pt-1 mt-1 border-t border-slate-300">
              <span className="text-slate-900">Total:</span>
              <div className="flex gap-3">
                <span className="text-slate-900">{totalVentas.toLocaleString('es-UY')}</span>
                <span className="text-green-700">{formatCurrency(totalMonto)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
