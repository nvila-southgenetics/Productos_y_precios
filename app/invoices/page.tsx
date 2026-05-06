"use client"

import { useEffect, useMemo, useState } from "react"
import { BarChart3 } from "lucide-react"
import {
  Bar,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  BarChart,
} from "recharts"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { cn, formatCurrency, formatDate, formatNumber } from "@/lib/utils"
import {
  getCountryMonthAmounts,
  getCountryMonthCollectionPercentages,
  getInvoiceCompanies,
  getInvoiceMetrics,
  getInvoicesPage,
  getMonthlyInvoicesSummary,
  type InvoiceCountryMonthAmounts,
  type InvoiceCountryMonthPercentages,
  type InvoiceMetrics,
  type InvoiceRow,
} from "@/lib/invoices"

const PAGE_SIZE = 15

function paymentBadgeClass(paymentState: string | null): string {
  if (paymentState === "paid") {
    return "bg-emerald-100 text-emerald-800 border-emerald-200"
  }
  if (paymentState === "not_paid") {
    return "bg-red-100 text-red-800 border-red-200"
  }
  if (paymentState === "in_payment") {
    return "bg-amber-100 text-amber-800 border-amber-200"
  }
  return "bg-slate-100 text-slate-800 border-slate-200"
}

function paymentLabel(paymentState: string | null): string {
  if (!paymentState) return "sin estado"
  return paymentState
}

function formatMonthHeader(monthKey: string): string {
  const [yearPart, monthPart] = monthKey.split("-")
  const month = Number(monthPart)
  const year = Number(yearPart)
  if (!Number.isFinite(month) || !Number.isFinite(year)) return monthKey
  const date = new Date(year, month - 1, 1)
  const monthLabel = date.toLocaleDateString("es-ES", { month: "short" }).replace(".", "")
  const shortYear = String(year).slice(-2)
  return `${monthLabel.charAt(0).toUpperCase()}${monthLabel.slice(1)}-${shortYear}`
}

function percentageDotClass(value: number): string {
  if (value >= 85) return "bg-emerald-500"
  if (value >= 70) return "bg-yellow-400"
  return "bg-red-500"
}

export default function InvoicesPage() {
  const [metrics, setMetrics] = useState<InvoiceMetrics>({
    total: 0,
    paid: 0,
    notPaid: 0,
    inPayment: 0,
    billedAmount: 0,
    collectedAmount: 0,
    inProcessAmount: 0,
  })
  const paidAndInProcessCount = metrics.paid + metrics.inPayment
  const paidAndInProcessAmount = metrics.collectedAmount + metrics.inProcessAmount
  const [monthlyData, setMonthlyData] = useState<Array<{ month: string; paid: number; notPaid: number; inPayment: number }>>([])
  const [activeView, setActiveView] = useState<"overview" | "country-amounts" | "country-percentages">("overview")
  const [countryAmounts, setCountryAmounts] = useState<InvoiceCountryMonthAmounts>({
    months: [],
    rows: [],
    totalsByMonth: {},
    grandTotal: 0,
  })
  const [countryPercentages, setCountryPercentages] = useState<InvoiceCountryMonthPercentages>({
    months: [],
    rows: [],
  })
  const [rows, setRows] = useState<InvoiceRow[]>([])
  const [companies, setCompanies] = useState<string[]>([])
  const [paymentState, setPaymentState] = useState<"all" | "paid" | "not_paid" | "in_payment">("all")
  const [companyName, setCompanyName] = useState("all")
  const [numberQuery, setNumberQuery] = useState("")
  const [clientQuery, setClientQuery] = useState("")
  const [page, setPage] = useState(1)
  const [totalRows, setTotalRows] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isTableLoading, setIsTableLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const totalPages = useMemo(() => Math.max(1, Math.ceil(totalRows / PAGE_SIZE)), [totalRows])

  useEffect(() => {
    async function loadStaticSections() {
      setIsLoading(true)
      setError(null)
      try {
        const [countryAmountsResult, countryPercentagesResult, metricsResult, monthlyResult, companiesResult] = await Promise.all([
          getCountryMonthAmounts(),
          getCountryMonthCollectionPercentages(),
          getInvoiceMetrics(),
          getMonthlyInvoicesSummary(),
          getInvoiceCompanies(),
        ])
        setCountryAmounts(countryAmountsResult)
        setCountryPercentages(countryPercentagesResult)
        setMetrics(metricsResult)
        setMonthlyData(monthlyResult)
        setCompanies(companiesResult)
      } catch (err) {
        console.error(err)
        setError("No se pudieron cargar las métricas de cobranza.")
      } finally {
        setIsLoading(false)
      }
    }
    loadStaticSections()
  }, [])

  useEffect(() => {
    async function loadTable() {
      setIsTableLoading(true)
      setError(null)
      try {
        const result = await getInvoicesPage({
          page,
          pageSize: PAGE_SIZE,
          paymentState,
          companyName,
          numberQuery,
          clientQuery,
        })
        setRows(result.rows)
        setTotalRows(result.total)
      } catch (err) {
        console.error(err)
        setError("No se pudo cargar la tabla de facturas.")
      } finally {
        setIsTableLoading(false)
      }
    }
    loadTable()
  }, [page, paymentState, companyName, numberQuery, clientQuery])

  useEffect(() => {
    setPage(1)
  }, [paymentState, companyName, numberQuery, clientQuery])

  return (
    <div className="min-h-screen bg-gradient-to-r from-blue-900 via-blue-950 to-slate-900">
      <div className="container mx-auto py-8 px-4 max-w-7xl">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-white/10 backdrop-blur-sm shadow-lg border border-white/20">
              <BarChart3 className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Cobranza</h1>
              <p className="text-sm text-white/80 mt-1">Análisis de estado de pago y detalle por cliente</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <div className="mb-4 flex flex-wrap gap-2">
          <Button
            variant={activeView === "overview" ? "default" : "outline"}
            onClick={() => setActiveView("overview")}
            className={cn(
              "text-sm",
              activeView === "overview"
                ? "bg-white text-slate-900 hover:bg-slate-100"
                : "bg-transparent text-white border-white/40 hover:bg-white/10"
            )}
          >
            Vista general
          </Button>
          <Button
            variant={activeView === "country-amounts" ? "default" : "outline"}
            onClick={() => setActiveView("country-amounts")}
            className={cn(
              "text-sm",
              activeView === "country-amounts"
                ? "bg-white text-slate-900 hover:bg-slate-100"
                : "bg-transparent text-white border-white/40 hover:bg-white/10"
            )}
          >
            Facturado por mes y país
          </Button>
          <Button
            variant={activeView === "country-percentages" ? "default" : "outline"}
            onClick={() => setActiveView("country-percentages")}
            className={cn(
              "text-sm",
              activeView === "country-percentages"
                ? "bg-white text-slate-900 hover:bg-slate-100"
                : "bg-transparent text-white border-white/40 hover:bg-white/10"
            )}
          >
            % de cobranza por mes y país
          </Button>
        </div>

        {activeView === "overview" && (
          <>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <div className="rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 p-4">
            <p className="text-sm text-white/70">Total de facturas</p>
            <p className="text-2xl font-semibold text-white">{formatNumber(metrics.total)}</p>
          </div>
          <div className="rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 p-4">
            <p className="text-sm text-white/70">Total pagas</p>
            <p className="text-2xl font-semibold text-emerald-300">{formatNumber(metrics.paid)}</p>
          </div>
          <div className="rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 p-4">
            <p className="text-sm text-white/70">Total no pagas</p>
            <p className="text-2xl font-semibold text-red-300">{formatNumber(metrics.notPaid)}</p>
          </div>
          <div className="rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 p-4">
            <p className="text-sm text-white/70">Total en proceso</p>
            <p className="text-2xl font-semibold text-amber-300">{formatNumber(metrics.inPayment)}</p>
          </div>
          <div className="rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 p-4">
            <p className="text-sm text-white/70">Pagado + En proceso de pago</p>
            <p className="text-2xl font-semibold text-cyan-300">{formatNumber(paidAndInProcessCount)}</p>
            <p className="text-sm font-medium text-cyan-200 mt-1">{formatCurrency(paidAndInProcessAmount)}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 p-4">
            <p className="text-sm text-white/70">Total facturado (monto)</p>
            <p className="text-2xl font-semibold text-white">{formatCurrency(metrics.billedAmount)}</p>
          </div>
          <div className="rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 p-4">
            <p className="text-sm text-white/70">Total cobrado (monto)</p>
            <p className="text-2xl font-semibold text-emerald-300">{formatCurrency(metrics.collectedAmount)}</p>
          </div>
          <div className="rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 p-4">
            <p className="text-sm text-white/70">Total en proceso (monto)</p>
            <p className="text-2xl font-semibold text-amber-300">{formatCurrency(metrics.inProcessAmount)}</p>
          </div>
        </div>

        <div className="rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 p-4 mb-6">
          <h2 className="text-white text-lg font-semibold mb-3">Pagas vs no pagas por mes</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="month" stroke="#cbd5e1" />
                <YAxis stroke="#cbd5e1" />
                <Tooltip />
                <Legend />
                <Bar dataKey="paid" name="Pagas" fill="#10b981" />
                <Bar dataKey="notPaid" name="No pagas" fill="#ef4444" />
                <Bar dataKey="inPayment" name="En proceso" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        </>
        )}

        {activeView === "country-amounts" && (
          <div className="rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 p-4 mb-6">
            <h2 className="text-white text-lg font-semibold mb-1">Facturado por mes y país</h2>
            <p className="text-sm text-white/80 mb-4">Monto total facturado por cada país y mes de factura.</p>
            <div className="overflow-x-auto rounded-md border border-white/20">
              <table className="min-w-full text-sm bg-white text-slate-900">
                <thead className="bg-slate-100">
                  <tr className="text-left text-slate-700">
                    <th className="px-3 py-2 font-semibold sticky left-0 bg-slate-100">País</th>
                    {countryAmounts.months.map((month) => (
                      <th key={month} className="px-3 py-2 font-semibold whitespace-nowrap">
                        {formatMonthHeader(month)}
                      </th>
                    ))}
                    <th className="px-3 py-2 font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {countryAmounts.rows.map((row) => (
                    <tr key={row.country} className="border-t border-slate-200">
                      <td className="px-3 py-2 font-medium sticky left-0 bg-white">{row.country}</td>
                      {countryAmounts.months.map((month) => (
                        <td key={`${row.country}-${month}`} className="px-3 py-2 whitespace-nowrap">
                          {formatNumber(row.values[month] ?? 0)}
                        </td>
                      ))}
                      <td className="px-3 py-2 font-semibold whitespace-nowrap">{formatNumber(row.total)}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-slate-300 bg-slate-50">
                    <td className="px-3 py-2 font-semibold sticky left-0 bg-slate-50">Total</td>
                    {countryAmounts.months.map((month) => (
                      <td key={`total-${month}`} className="px-3 py-2 font-semibold whitespace-nowrap">
                        {formatNumber(countryAmounts.totalsByMonth[month] ?? 0)}
                      </td>
                    ))}
                    <td className="px-3 py-2 font-bold whitespace-nowrap">{formatNumber(countryAmounts.grandTotal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeView === "country-percentages" && (
          <div className="rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 p-4 mb-6">
            <h2 className="text-white text-lg font-semibold mb-1">% de cobranza por mes y país</h2>
            <p className="text-sm text-white/80 mb-4">Porcentaje cobrado (monto pagado / monto facturado) por cada país y mes.</p>
            <div className="overflow-x-auto rounded-md border border-white/20">
              <table className="min-w-full text-sm bg-white text-slate-900">
                <thead className="bg-slate-100">
                  <tr className="text-left text-slate-700">
                    <th className="px-3 py-2 font-semibold sticky left-0 bg-slate-100">País</th>
                    {countryPercentages.months.map((month) => (
                      <th key={month} className="px-3 py-2 font-semibold whitespace-nowrap">
                        {formatMonthHeader(month)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {countryPercentages.rows.map((row) => (
                    <tr key={row.country} className="border-t border-slate-200">
                      <td className="px-3 py-2 font-medium sticky left-0 bg-white">{row.country}</td>
                      {countryPercentages.months.map((month) => {
                        const value = row.values[month] ?? 0
                        return (
                          <td key={`${row.country}-${month}`} className="px-3 py-2 whitespace-nowrap">
                            <span className="inline-flex items-center gap-2">
                              <span className={cn("h-3 w-3 rounded-full", percentageDotClass(value))} />
                              {formatNumber(value, "es-UY", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}%
                            </span>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 p-4">
          <div className="flex flex-col md:flex-row gap-3 mb-4">
            <div className="w-full md:w-56">
              <p className="text-xs text-white/80 mb-1">Estado de pago</p>
              <Select
                value={paymentState}
                onChange={(e) => setPaymentState(e.target.value as typeof paymentState)}
                className="bg-white text-slate-900"
              >
                <option value="all">Todos los estados</option>
                <option value="paid">Pagas</option>
                <option value="not_paid">No pagas</option>
                <option value="in_payment">En proceso</option>
              </Select>
            </div>
            <div className="w-full md:w-72">
              <p className="text-xs text-white/80 mb-1">Empresa</p>
              <Select value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="bg-white text-slate-900">
                <option value="all">Todas las empresas</option>
                {companies.map((company) => (
                  <option key={company} value={company}>
                    {company}
                  </option>
                ))}
              </Select>
            </div>
            <div className="w-full md:w-64">
              <p className="text-xs text-white/80 mb-1">Numero</p>
              <Input
                value={numberQuery}
                onChange={(e) => setNumberQuery(e.target.value)}
                placeholder="Buscar por numero de factura"
                className="bg-white text-slate-900 placeholder:text-slate-500"
              />
            </div>
            <div className="w-full md:w-72">
              <p className="text-xs text-white/80 mb-1">Cliente</p>
              <Input
                value={clientQuery}
                onChange={(e) => setClientQuery(e.target.value)}
                placeholder="Buscar por nombre del cliente"
                className="bg-white text-slate-900 placeholder:text-slate-500"
              />
            </div>
          </div>

          <p className="text-sm text-white/80 mb-3">Resultados: {formatNumber(totalRows)}</p>

          <div className="overflow-x-auto rounded-md border border-white/20">
            <table className="min-w-full text-sm bg-white text-slate-900">
              <thead className="bg-slate-100">
                <tr className="text-left text-slate-700">
                  <th className="px-3 py-2 font-semibold">Numero</th>
                  <th className="px-3 py-2 font-semibold">Cliente</th>
                  <th className="px-3 py-2 font-semibold">Empresa</th>
                  <th className="px-3 py-2 font-semibold">Fecha</th>
                  <th className="px-3 py-2 font-semibold">Estado de pago</th>
                  <th className="px-3 py-2 font-semibold">PMS</th>
                </tr>
              </thead>
              <tbody>
                {isTableLoading ? (
                  <tr>
                    <td className="px-3 py-8 text-center text-slate-600" colSpan={6}>
                      Cargando facturas...
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td className="px-3 py-8 text-center text-slate-600" colSpan={6}>
                      No hay facturas para los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id} className="border-t border-slate-200 text-slate-900">
                      <td className="px-3 py-2 text-slate-900">{row.name || "-"}</td>
                      <td className="px-3 py-2 text-slate-900">{row.invoice_partner_display_name || "-"}</td>
                      <td className="px-3 py-2 text-slate-900">{row.company_name || "-"}</td>
                      <td className="px-3 py-2 text-slate-900">{row.invoice_date ? formatDate(row.invoice_date) : "-"}</td>
                      <td className="px-3 py-2">
                        <Badge className={cn("border", paymentBadgeClass(row.payment_state))}>
                          {paymentLabel(row.payment_state)}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-slate-900">{row.x_studio_pms_en_ficha || "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-white/80">
              Pagina {page} de {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page === 1}
                className="bg-white text-slate-900 hover:bg-slate-100"
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={page === totalPages}
                className="bg-white text-slate-900 hover:bg-slate-100"
              >
                Siguiente
              </Button>
            </div>
          </div>
        </div>

        {isLoading && <p className="mt-3 text-sm text-white/70">Cargando métricas y gráfico...</p>}
      </div>
    </div>
  )
}
