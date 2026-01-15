"use client"

import Link from "next/link"
import { AlertTriangle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/utils"
import type { MonthlySalesWithProduct } from "@/lib/supabase-mcp"

interface ProductSalesTableProps {
  sales: MonthlySalesWithProduct[]
}

const categoryColors: Record<string, string> = {
  "Ginecología": "bg-pink-100 text-pink-700 border-pink-300",
  "Oncología": "bg-red-100 text-red-700 border-red-300",
  "Urología": "bg-blue-100 text-blue-700 border-blue-300",
  "Endocrinología": "bg-purple-100 text-purple-700 border-purple-300",
  "Prenatales": "bg-green-100 text-green-700 border-green-300",
  "Anualidades": "bg-yellow-100 text-yellow-700 border-yellow-300",
  "Carrier": "bg-blue-100 text-blue-700 border-blue-300",
  "Nutrición": "bg-green-100 text-green-700 border-green-300",
  "Otros": "bg-gray-100 text-gray-700 border-gray-300",
}

const tipoColors: Record<string, string> = {
  "Sangre": "bg-red-100 text-red-700 border-red-300",
  "Corte de Tejido": "bg-blue-100 text-blue-700 border-blue-300",
  "Punción": "bg-purple-100 text-purple-700 border-purple-300",
  "Biopsia endometrial": "bg-pink-100 text-pink-700 border-pink-300",
  "Hisopado bucal": "bg-green-100 text-green-700 border-green-300",
  "Sangre y corte tejido": "bg-orange-100 text-orange-700 border-orange-300",
  "Orina": "bg-cyan-100 text-cyan-700 border-cyan-300",
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

export function ProductSalesTable({ sales }: ProductSalesTableProps) {
  if (sales.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground text-sm">
        No hay ventas para este período
      </div>
    )
  }

  return (
    <div className="rounded-md border overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-3 py-2 text-left align-middle font-medium text-xs">Producto</th>
            <th className="px-3 py-2 text-left align-middle font-medium text-xs">Compañía</th>
            <th className="px-3 py-2 text-right align-middle font-medium text-xs">Cantidad</th>
            <th className="px-3 py-2 text-right align-middle font-medium text-xs">Gross Sale</th>
            <th className="px-3 py-2 text-right align-middle font-medium text-xs">Gross Profit</th>
            <th className="px-3 py-2 text-right align-middle font-medium text-xs">Total Amount (Odoo)</th>
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
              <tr key={index} className="border-b hover:bg-muted/50 transition-colors">
                <td className="px-3 py-2">
                  <div className="flex flex-col gap-1">
                    {sale.product_id ? (
                      <Link
                        href={`/productos/${sale.product_id}`}
                        className="font-medium text-primary hover:underline text-sm"
                      >
                        {sale.producto}
                      </Link>
                    ) : (
                      <span className="font-medium text-sm">{sale.producto}</span>
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
                          className={`${tipoColors[sale.tipo] || "bg-gray-100 text-gray-700 border-gray-300"} border px-1.5 py-0.5 text-xs`}
                        >
                          {sale.tipo}
                        </Badge>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2">
                  <span className="text-xs">{sale.compañia}</span>
                </td>
                <td className="px-3 py-2 text-right">
                  <span className="font-medium text-sm">{sale.cantidad_ventas.toLocaleString('es-UY')}</span>
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <span className={hasNoGrossSale ? "text-muted-foreground text-sm" : "text-blue-600 font-medium text-sm"}>
                      {formatCurrency(grossSale)}
                    </span>
                    {hasNoGrossSale && (
                      <AlertTriangle
                        className="h-3 w-3 text-amber-500"
                        title="Este producto no tiene precios configurados para este país"
                      />
                    )}
                  </div>
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <span className={hasNoGrossProfit ? "text-muted-foreground text-sm" : "text-orange-600 font-medium text-sm"}>
                      {formatCurrency(grossProfit)}
                    </span>
                    {hasNoGrossProfit && (
                      <AlertTriangle
                        className="h-3 w-3 text-amber-500"
                        title="Este producto no tiene precios configurados para este país"
                      />
                    )}
                  </div>
                </td>
                <td className="px-3 py-2 text-right">
                  <span className="text-green-600 font-medium text-sm">
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

