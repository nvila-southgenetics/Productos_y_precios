"use client"

import Link from "next/link"
import { AlertTriangle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/utils"
import { CompanyBreakdown } from "./CompanyBreakdown"
import type { MonthlySalesWithProduct } from "@/lib/supabase-mcp"

interface ProductSalesTableProps {
  sales: MonthlySalesWithProduct[]
  isAllCompanies?: boolean
  isTotal?: boolean
}

const categoryColors: Record<string, string> = {
  "Ginecología": "bg-pink-500/20 text-pink-200 border-pink-400/30",
  "Oncología": "bg-red-500/20 text-red-200 border-red-400/30",
  "Urología": "bg-blue-500/20 text-blue-200 border-blue-400/30",
  "Endocrinología": "bg-purple-500/20 text-purple-200 border-purple-400/30",
  "Prenatales": "bg-emerald-500/20 text-emerald-200 border-emerald-400/30",
  "Anualidades": "bg-yellow-500/20 text-yellow-200 border-yellow-400/30",
  "Carrier": "bg-blue-500/20 text-blue-200 border-blue-400/30",
  "Nutrición": "bg-emerald-500/20 text-emerald-200 border-emerald-400/30",
  "Otros": "bg-gray-500/20 text-gray-200 border-gray-400/30",
}

const tipoColors: Record<string, string> = {
  "Sangre": "bg-red-500/20 text-red-200 border-red-400/30",
  "Corte de Tejido": "bg-blue-500/20 text-blue-200 border-blue-400/30",
  "Punción": "bg-purple-500/20 text-purple-200 border-purple-400/30",
  "Biopsia endometrial": "bg-pink-500/20 text-pink-200 border-pink-400/30",
  "Hisopado bucal": "bg-emerald-500/20 text-emerald-200 border-emerald-400/30",
  "Sangre y corte tejido": "bg-orange-500/20 text-orange-200 border-orange-400/30",
  "Orina": "bg-cyan-500/20 text-cyan-200 border-cyan-400/30",
}

function calculateGrossSale(overrides: MonthlySalesWithProduct['overrides'], cantidad: number): number {
  const grossSalesUSD = overrides?.grossSalesUSD || 0
  return grossSalesUSD * cantidad
}

function calculateGrossProfit(overrides: MonthlySalesWithProduct['overrides'], cantidad: number): number {
  const grossSalesUSD = overrides?.grossSalesUSD || 0
  const commercialDiscountUSD = overrides?.commercialDiscountUSD || 0
  const salesRevenueUSD = grossSalesUSD - commercialDiscountUSD

  // Sumar todos los costos
  const totalCostOfSalesUSD =
    (overrides?.productCostUSD || 0) +
    (overrides?.kitCostUSD || 0) +
    (overrides?.paymentFeeUSD || 0) +
    (overrides?.bloodDrawSampleUSD || 0) +
    (overrides?.sanitaryPermitsUSD || 0) +
    (overrides?.externalCourierUSD || 0) +
    (overrides?.internalCourierUSD || 0) +
    (overrides?.physiciansFeesUSD || 0) +
    (overrides?.salesCommissionUSD || 0)

  const grossProfitUSD = salesRevenueUSD - totalCostOfSalesUSD
  return grossProfitUSD * cantidad
}

export function ProductSalesTable({ sales, isAllCompanies = false, isTotal = false }: ProductSalesTableProps) {
  if (sales.length === 0) {
    return (
      <div className="text-center py-6 text-white/60 text-sm">
        No hay ventas para este período
      </div>
    )
  }

  return (
    <div className="rounded-md border border-white/20 overflow-x-auto bg-[#1e4d7b]/35 backdrop-blur-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/20 bg-[#1e4d7b]/55">
            <th className="px-3 py-2 text-left align-middle font-medium text-xs text-white">Producto</th>
            <th className="px-3 py-2 text-left align-middle font-medium text-xs text-white">Compañía</th>
            <th className="px-3 py-2 text-right align-middle font-medium text-xs text-white">Cantidad</th>
            <th className="px-3 py-2 text-right align-middle font-medium text-xs text-white">Gross Sale</th>
            <th className="px-3 py-2 text-right align-middle font-medium text-xs text-white">Gross Profit</th>
            <th className="px-3 py-2 text-right align-middle font-medium text-xs text-white">Total Amount (Odoo)</th>
          </tr>
        </thead>
        <tbody>
          {sales.map((sale, index) => {
            const grossSale = calculateGrossSale(sale.overrides, sale.cantidad_ventas)
            const grossProfit = calculateGrossProfit(sale.overrides, sale.cantidad_ventas)
            const totalAmount = sale.monto_total || 0

            const hasNoGrossSale = grossSale === 0
            const hasNoGrossProfit = grossProfit === 0

            return (
              <tr key={index} className="border-b border-white/10 bg-[#1e4d7b]/30 hover:bg-[#1e4d7b]/45 transition-colors">
                <td className="px-3 py-2">
                  <div className="flex flex-col gap-1">
                    {sale.product_id ? (
                      <Link
                        href={`/productos/${sale.product_id}`}
                        className="font-medium text-white hover:text-white/80 hover:underline text-sm"
                      >
                        {sale.producto}
                      </Link>
                    ) : (
                      <span className="font-medium text-sm text-white/90">{sale.producto}</span>
                    )}
                    <div className="flex gap-1 flex-wrap">
                      {sale.category && (
                        <Badge
                          className={`${categoryColors[sale.category] || categoryColors["Otros"]} border px-1.5 py-0.5 text-xs`}
                        >
                          {sale.category}
                        </Badge>
                      )}
                      {sale.tipo && (
                        <Badge
                          className={`${tipoColors[sale.tipo] || "bg-gray-500/20 text-gray-200 border-gray-400/30"} border px-1.5 py-0.5 text-xs`}
                        >
                          {sale.tipo}
                        </Badge>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2">
                  {isAllCompanies && sale.companyBreakdown && sale.companyBreakdown.length > 0 ? (
                    <CompanyBreakdown breakdown={sale.companyBreakdown} />
                  ) : (
                    <span className="text-xs text-white/80">{sale.compañia}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  <span className="font-medium text-sm text-white/90">{sale.cantidad_ventas.toLocaleString('es-UY')}</span>
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <span className={hasNoGrossSale ? "text-white/50 text-sm" : "text-sky-300 font-medium text-sm"}>
                      {formatCurrency(grossSale)}
                    </span>
                    {hasNoGrossSale && (
                      <span title="Este producto no tiene precios configurados para este país">
                        <AlertTriangle className="h-3 w-3 text-yellow-300" />
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <span className={hasNoGrossProfit ? "text-white/50 text-sm" : "text-orange-300 font-medium text-sm"}>
                      {formatCurrency(grossProfit)}
                    </span>
                    {hasNoGrossProfit && (
                      <span title="Este producto no tiene precios configurados para este país">
                        <AlertTriangle className="h-3 w-3 text-yellow-300" />
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2 text-right">
                  <span className="text-emerald-300 font-medium text-sm">
                    {formatCurrency(totalAmount)}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

