"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/utils"
import type { MonthlySalesWithProduct } from "@/lib/supabase-mcp"

interface MonthlyPLModalProps {
  isOpen: boolean
  onClose: () => void
  periodo: string
  compañía: string
  productsData: MonthlySalesWithProduct[]
}

interface ConsolidatedCosts {
  grossSalesUSD: number
  commercialDiscountUSD: number
  salesRevenueUSD: number
  productCostUSD: number
  kitCostUSD: number
  paymentFeeUSD: number
  bloodDrawSampleUSD: number
  sanitaryPermitsUSD: number
  externalCourierUSD: number
  internalCourierUSD: number
  physiciansFeesUSD: number
  salesCommissionUSD: number
  totalCostOfSalesUSD: number
  grossProfitUSD: number
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

export function MonthlyPLModal({
  isOpen,
  onClose,
  periodo,
  compañía,
  productsData,
}: MonthlyPLModalProps) {
  const [consolidatedCosts, setConsolidatedCosts] = useState<ConsolidatedCosts | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen && productsData.length > 0) {
      calculateConsolidatedCosts()
    } else if (isOpen && productsData.length === 0) {
      setConsolidatedCosts(null)
    }
  }, [isOpen, productsData])

  const calculateConsolidatedCosts = () => {
    setLoading(true)

    try {
      // Inicializar totales en 0
      const totals: ConsolidatedCosts = {
        grossSalesUSD: 0,
        commercialDiscountUSD: 0,
        salesRevenueUSD: 0,
        productCostUSD: 0,
        kitCostUSD: 0,
        paymentFeeUSD: 0,
        bloodDrawSampleUSD: 0,
        sanitaryPermitsUSD: 0,
        externalCourierUSD: 0,
        internalCourierUSD: 0,
        physiciansFeesUSD: 0,
        salesCommissionUSD: 0,
        totalCostOfSalesUSD: 0,
        grossProfitUSD: 0,
      }

      // Iterar sobre cada producto vendido
      for (const product of productsData) {
        const cantidad = product.cantidad_ventas
        const overrides = product.overrides || {}

        // Sumar cada concepto multiplicado por la cantidad
        totals.grossSalesUSD += (overrides.grossSalesUSD || 0) * cantidad
        totals.commercialDiscountUSD += (overrides.commercialDiscountUSD || 0) * cantidad
        totals.productCostUSD += (overrides.productCostUSD || 0) * cantidad
        totals.kitCostUSD += (overrides.kitCostUSD || 0) * cantidad
        totals.paymentFeeUSD += (overrides.paymentFeeUSD || 0) * cantidad
        totals.bloodDrawSampleUSD += (overrides.bloodDrawSampleUSD || 0) * cantidad
        totals.sanitaryPermitsUSD += (overrides.sanitaryPermitsUSD || 0) * cantidad
        totals.externalCourierUSD += (overrides.externalCourierUSD || 0) * cantidad
        totals.internalCourierUSD += (overrides.internalCourierUSD || 0) * cantidad
        totals.physiciansFeesUSD += (overrides.physiciansFeesUSD || 0) * cantidad
        totals.salesCommissionUSD += (overrides.salesCommissionUSD || 0) * cantidad
      }

      // Calcular valores derivados
      totals.salesRevenueUSD = totals.grossSalesUSD - totals.commercialDiscountUSD
      totals.totalCostOfSalesUSD =
        totals.productCostUSD +
        totals.kitCostUSD +
        totals.paymentFeeUSD +
        totals.bloodDrawSampleUSD +
        totals.sanitaryPermitsUSD +
        totals.externalCourierUSD +
        totals.internalCourierUSD +
        totals.physiciansFeesUSD +
        totals.salesCommissionUSD
      totals.grossProfitUSD = totals.salesRevenueUSD - totals.totalCostOfSalesUSD

      setConsolidatedCosts(totals)
    } catch (error) {
      console.error("Error calculating consolidated costs:", error)
    } finally {
      setLoading(false)
    }
  }

  const calculatePercentage = (value: number, total: number): string => {
    if (total === 0) return "0.00"
    return ((value / total) * 100).toFixed(2)
  }

  const formatPeriodo = (periodo: string): string => {
    if (periodo === "Total") return "Total"
    const parts = periodo.split("-")
    if (parts.length !== 2) return periodo
    const [year, month] = parts
    const monthName = monthNames[month] || month
    return `${monthName} ${year}`
  }

  const totalProducts = productsData.reduce((sum, p) => sum + p.cantidad_ventas, 0)

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogClose onClose={onClose} />
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            P&L - {formatPeriodo(periodo)}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Info del mes */}
          <div className="bg-blue-50 p-3 rounded-lg">
            <p className="text-sm font-medium text-blue-900">{compañía}</p>
            <p className="text-xs text-blue-700">
              Total de productos vendidos: {totalProducts.toLocaleString("es-UY")}
            </p>
          </div>

          {loading ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Calculando costos consolidados...
            </div>
          ) : consolidatedCosts ? (
            <>
              {/* Tabla de costos consolidada */}
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-muted/50 px-4 py-2 border-b">
                  <h3 className="text-sm font-semibold">Cálculo de Costos Consolidado</h3>
                </div>

                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/30 border-b">
                      <th className="text-left px-3 py-2 font-medium text-xs">Concepto</th>
                      <th className="text-right px-3 py-2 font-medium text-xs">💵 USD</th>
                      <th className="text-right px-3 py-2 font-medium text-xs">📊 %</th>
                      <th className="text-right px-3 py-2 font-medium text-xs">Cuenta</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {/* Gross Sales */}
                    <tr>
                      <td className="px-3 py-2">Gross Sales (sin IVA)</td>
                      <td className="px-3 py-2 text-right font-medium">
                        {formatCurrency(consolidatedCosts.grossSalesUSD)}
                      </td>
                      <td className="px-3 py-2 text-right">100.00%</td>
                      <td className="px-3 py-2 text-right text-xs text-muted-foreground">4.1.1.6</td>
                    </tr>

                    {/* Commercial Discount */}
                    <tr>
                      <td className="px-3 py-2">Commercial Discount</td>
                      <td className="px-3 py-2 text-right">
                        {formatCurrency(consolidatedCosts.commercialDiscountUSD)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {calculatePercentage(
                          consolidatedCosts.commercialDiscountUSD,
                          consolidatedCosts.grossSalesUSD
                        )}
                        %
                      </td>
                      <td className="px-3 py-2 text-right text-xs text-muted-foreground">4.1.1.10</td>
                    </tr>

                    {/* Sales Revenue */}
                    <tr className="bg-muted/30">
                      <td className="px-3 py-2 font-semibold">Sales Revenue</td>
                      <td className="px-3 py-2 text-right font-semibold">
                        {formatCurrency(consolidatedCosts.salesRevenueUSD)}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold">
                        {calculatePercentage(
                          consolidatedCosts.salesRevenueUSD,
                          consolidatedCosts.grossSalesUSD
                        )}
                        %
                      </td>
                      <td className="px-3 py-2 text-right text-xs text-muted-foreground">-</td>
                    </tr>

                    {/* Header: Cost of Sales */}
                    <tr className="bg-muted/50">
                      <td colSpan={4} className="px-3 py-2 text-xs font-semibold text-muted-foreground">
                        --- Cost of Sales ---
                      </td>
                    </tr>

                    {/* Product Cost */}
                    <tr>
                      <td className="px-3 py-2">Product Cost</td>
                      <td className="px-3 py-2 text-right">
                        {formatCurrency(consolidatedCosts.productCostUSD)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {calculatePercentage(
                          consolidatedCosts.productCostUSD,
                          consolidatedCosts.grossSalesUSD
                        )}
                        %
                      </td>
                      <td className="px-3 py-2 text-right text-xs text-muted-foreground">5.1.1.6</td>
                    </tr>

                    {/* Kit Cost */}
                    <tr>
                      <td className="px-3 py-2">Kit Cost</td>
                      <td className="px-3 py-2 text-right">
                        {formatCurrency(consolidatedCosts.kitCostUSD)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {calculatePercentage(consolidatedCosts.kitCostUSD, consolidatedCosts.grossSalesUSD)}%
                      </td>
                      <td className="px-3 py-2 text-right text-xs text-muted-foreground">5.1.4.1.4</td>
                    </tr>

                    {/* Payment Fee Costs */}
                    <tr>
                      <td className="px-3 py-2">Payment Fee Costs</td>
                      <td className="px-3 py-2 text-right">
                        {formatCurrency(consolidatedCosts.paymentFeeUSD)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {calculatePercentage(consolidatedCosts.paymentFeeUSD, consolidatedCosts.grossSalesUSD)}%
                      </td>
                      <td className="px-3 py-2 text-right text-xs text-muted-foreground">-</td>
                    </tr>

                    {/* Blood Drawn & Sample Handling */}
                    <tr>
                      <td className="px-3 py-2">Blood Drawn & Sample Handling</td>
                      <td className="px-3 py-2 text-right">
                        {formatCurrency(consolidatedCosts.bloodDrawSampleUSD)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {calculatePercentage(
                          consolidatedCosts.bloodDrawSampleUSD,
                          consolidatedCosts.grossSalesUSD
                        )}
                        %
                      </td>
                      <td className="px-3 py-2 text-right text-xs text-muted-foreground">5.1.4.1.2</td>
                    </tr>

                    {/* Sanitary Permits */}
                    <tr>
                      <td className="px-3 py-2">Sanitary Permits to export blood</td>
                      <td className="px-3 py-2 text-right">
                        {formatCurrency(consolidatedCosts.sanitaryPermitsUSD)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {calculatePercentage(
                          consolidatedCosts.sanitaryPermitsUSD,
                          consolidatedCosts.grossSalesUSD
                        )}
                        %
                      </td>
                      <td className="px-3 py-2 text-right text-xs text-muted-foreground">5.1.x.x</td>
                    </tr>

                    {/* External Courier */}
                    <tr>
                      <td className="px-3 py-2">External Courier</td>
                      <td className="px-3 py-2 text-right">
                        {formatCurrency(consolidatedCosts.externalCourierUSD)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {calculatePercentage(
                          consolidatedCosts.externalCourierUSD,
                          consolidatedCosts.grossSalesUSD
                        )}
                        %
                      </td>
                      <td className="px-3 py-2 text-right text-xs text-muted-foreground">5.1.2.4.2</td>
                    </tr>

                    {/* Internal Courier */}
                    <tr>
                      <td className="px-3 py-2">Internal Courier</td>
                      <td className="px-3 py-2 text-right">
                        {formatCurrency(consolidatedCosts.internalCourierUSD)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {calculatePercentage(
                          consolidatedCosts.internalCourierUSD,
                          consolidatedCosts.grossSalesUSD
                        )}
                        %
                      </td>
                      <td className="px-3 py-2 text-right text-xs text-muted-foreground">5.1.2.4.1</td>
                    </tr>

                    {/* Physicians Fees */}
                    <tr>
                      <td className="px-3 py-2">Physicians Fees</td>
                      <td className="px-3 py-2 text-right">
                        {formatCurrency(consolidatedCosts.physiciansFeesUSD)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {calculatePercentage(
                          consolidatedCosts.physiciansFeesUSD,
                          consolidatedCosts.grossSalesUSD
                        )}
                        %
                      </td>
                      <td className="px-3 py-2 text-right text-xs text-muted-foreground">5.1.4.1.1</td>
                    </tr>

                    {/* Sales Commission */}
                    <tr>
                      <td className="px-3 py-2">Sales Commission</td>
                      <td className="px-3 py-2 text-right">
                        {formatCurrency(consolidatedCosts.salesCommissionUSD)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {calculatePercentage(
                          consolidatedCosts.salesCommissionUSD,
                          consolidatedCosts.grossSalesUSD
                        )}
                        %
                      </td>
                      <td className="px-3 py-2 text-right text-xs text-muted-foreground">6.1.1.06</td>
                    </tr>

                    {/* Total Cost of Sales */}
                    <tr className="bg-muted/30">
                      <td className="px-3 py-2 font-semibold">Total Cost of Sales</td>
                      <td className="px-3 py-2 text-right font-semibold">
                        {formatCurrency(consolidatedCosts.totalCostOfSalesUSD)}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold">
                        {calculatePercentage(
                          consolidatedCosts.totalCostOfSalesUSD,
                          consolidatedCosts.grossSalesUSD
                        )}
                        %
                      </td>
                      <td className="px-3 py-2 text-right text-xs text-muted-foreground">-</td>
                    </tr>

                    {/* Gross Profit */}
                    <tr className="bg-green-50">
                      <td className="px-3 py-2 font-bold text-green-900">Gross Profit</td>
                      <td className="px-3 py-2 text-right font-bold text-green-900">
                        {formatCurrency(consolidatedCosts.grossProfitUSD)}
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-green-900">
                        {calculatePercentage(consolidatedCosts.grossProfitUSD, consolidatedCosts.grossSalesUSD)}%
                      </td>
                      <td className="px-3 py-2 text-right text-xs text-muted-foreground">-</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No hay datos disponibles para este período
            </div>
          )}

          {/* Botones de acción */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose} size="sm">
              Cerrar
            </Button>
            <Button
              variant="default"
              onClick={() => {
                // TODO: Implementar exportación PDF
                alert("Exportar PDF - Funcionalidad próximamente")
              }}
              size="sm"
            >
              📥 Exportar PDF
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}



