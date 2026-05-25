"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { BarChart3, Wallet } from "lucide-react"
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
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { cn, formatCurrency, formatNumber } from "@/lib/utils"
import {
  formatPaymentPeriod,
  PAYMENTS_MIN_YEAR,
  getMonthlyPaymentsSummary,
  getPaymentCompanies,
  getPaymentCountryMonthAmounts,
  getPaymentMetrics,
  getPaymentsPage,
  type PaymentCountryMonthAmounts,
  type PaymentMetrics,
  type PaymentRow,
} from "@/lib/payments"

const PAGE_SIZE = 15

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

export default function PaymentsPage() {
  const [metrics, setMetrics] = useState<PaymentMetrics>({
    total: 0,
    totalAmount: 0,
    withDate: 0,
    withoutDate: 0,
  })
  const [monthlyData, setMonthlyData] = useState<Array<{ month: string; count: number; amount: number }>>([])
  const [activeView, setActiveView] = useState<"overview" | "country-amounts">("overview")
  const [countryAmounts, setCountryAmounts] = useState<PaymentCountryMonthAmounts>({
    months: [],
    rows: [],
    totalsByMonth: {},
    grandTotal: 0,
  })
  const [rows, setRows] = useState<PaymentRow[]>([])
  const [companies, setCompanies] = useState<Array<{ id: number; name: string }>>([])
  const [companyId, setCompanyId] = useState<string>("all")
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
        const [countryAmountsResult, metricsResult, monthlyResult, companiesResult] = await Promise.all([
          getPaymentCountryMonthAmounts(),
          getPaymentMetrics(),
          getMonthlyPaymentsSummary(),
          getPaymentCompanies(),
        ])
        setCountryAmounts(countryAmountsResult)
        setMetrics(metricsResult)
        setMonthlyData(monthlyResult)
        setCompanies(companiesResult)
      } catch (err) {
        console.error(err)
        setError("No se pudieron cargar las métricas de pagos.")
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
        const result = await getPaymentsPage({
          page,
          pageSize: PAGE_SIZE,
          companyId: companyId === "all" ? "all" : Number(companyId),
          numberQuery,
          clientQuery,
        })
        setRows(result.rows)
        setTotalRows(result.total)
      } catch (err) {
        console.error(err)
        setError("No se pudo cargar la tabla de pagos.")
      } finally {
        setIsTableLoading(false)
      }
    }
    loadTable()
  }, [page, companyId, numberQuery, clientQuery])

  useEffect(() => {
    setPage(1)
  }, [companyId, numberQuery, clientQuery])

  return (
    <div className="min-h-screen bg-gradient-to-r from-blue-900 via-blue-950 to-slate-900">
      <div className="container mx-auto py-8 px-4 max-w-7xl">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-white/10 backdrop-blur-sm shadow-lg border border-white/20">
              <Wallet className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Pagos cobrados</h1>
              <p className="text-sm text-white/80 mt-1">
                Pagos registrados en Odoo desde {PAYMENTS_MIN_YEAR} — detalle y montos por país
              </p>
            </div>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <Link href="/invoices">
            <Button
              variant="outline"
              className="text-sm bg-transparent text-white border-white/40 hover:bg-white/10"
            >
              <BarChart3 className="h-4 w-4 mr-1.5" />
              Facturas
            </Button>
          </Link>
          <Button
            variant="default"
            className="text-sm bg-white text-slate-900 hover:bg-slate-100"
            disabled
          >
            Pagos
          </Button>
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
            Cobrado por mes y país
          </Button>
        </div>

        {activeView === "overview" && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 p-4">
                <p className="text-sm text-white/70">Total de pagos</p>
                <p className="text-2xl font-semibold text-white">{formatNumber(metrics.total)}</p>
              </div>
              <div className="rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 p-4">
                <p className="text-sm text-white/70">Monto total cobrado</p>
                <p className="text-2xl font-semibold text-emerald-300">{formatCurrency(metrics.totalAmount)}</p>
              </div>
              <div className="rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 p-4">
                <p className="text-sm text-white/70">Con período identificado</p>
                <p className="text-2xl font-semibold text-cyan-300">{formatNumber(metrics.withDate)}</p>
              </div>
              <div className="rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 p-4">
                <p className="text-sm text-white/70">Sin fecha en producto</p>
                <p className="text-2xl font-semibold text-amber-300">{formatNumber(metrics.withoutDate)}</p>
              </div>
            </div>

            <div className="rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 p-4 mb-6">
              <h2 className="text-white text-lg font-semibold mb-1">Pagos por mes</h2>
              <p className="text-sm text-white/80 mb-3">
                Cantidad y monto desde {PAYMENTS_MIN_YEAR} según la fecha de inicio del período en el producto.
              </p>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="month" stroke="#cbd5e1" />
                    <YAxis yAxisId="left" stroke="#cbd5e1" />
                    <YAxis yAxisId="right" orientation="right" stroke="#cbd5e1" />
                    <Tooltip />
                    <Legend />
                    <Bar yAxisId="left" dataKey="count" name="Cantidad" fill="#38bdf8" />
                    <Bar yAxisId="right" dataKey="amount" name="Monto (USD)" fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}

        {activeView === "country-amounts" && (
          <div className="rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 p-4 mb-6">
            <h2 className="text-white text-lg font-semibold mb-1">Cobrado por mes y país</h2>
            <p className="text-sm text-white/80 mb-4">
              Monto total cobrado por cada país y mes desde {PAYMENTS_MIN_YEAR} (fecha de inicio del período del producto).
            </p>
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
                    <td className="px-3 py-2 font-bold whitespace-nowrap">
                      {formatNumber(countryAmounts.grandTotal)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 p-4">
          <div className="flex flex-col md:flex-row gap-3 mb-4">
            <div className="w-full md:w-72">
              <p className="text-xs text-white/80 mb-1">Empresa</p>
              <Select
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                className="bg-white text-slate-900"
              >
                <option value="all">Todas las empresas</option>
                {companies.map((company) => (
                  <option key={company.id} value={String(company.id)}>
                    {company.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="w-full md:w-64">
              <p className="text-xs text-white/80 mb-1">Número</p>
              <Input
                value={numberQuery}
                onChange={(e) => setNumberQuery(e.target.value)}
                placeholder="Buscar por número de pago"
                className="bg-white text-slate-900 placeholder:text-slate-500"
              />
            </div>
            <div className="w-full md:w-72">
              <p className="text-xs text-white/80 mb-1">Contacto</p>
              <Input
                value={clientQuery}
                onChange={(e) => setClientQuery(e.target.value)}
                placeholder="Buscar por nombre del contacto"
                className="bg-white text-slate-900 placeholder:text-slate-500"
              />
            </div>
          </div>

          <p className="text-sm text-white/80 mb-3">Resultados: {formatNumber(totalRows)}</p>

          <div className="overflow-x-auto rounded-md border border-white/20">
            <table className="min-w-full text-sm bg-white text-slate-900">
              <thead className="bg-slate-100">
                <tr className="text-left text-slate-700">
                  <th className="px-3 py-2 font-semibold">Número</th>
                  <th className="px-3 py-2 font-semibold">Contacto</th>
                  <th className="px-3 py-2 font-semibold">Empresa</th>
                  <th className="px-3 py-2 font-semibold">Período</th>
                  <th className="px-3 py-2 font-semibold">Monto</th>
                  <th className="px-3 py-2 font-semibold">Producto</th>
                  <th className="px-3 py-2 font-semibold">PMS</th>
                </tr>
              </thead>
              <tbody>
                {isTableLoading ? (
                  <tr>
                    <td className="px-3 py-8 text-center text-slate-600" colSpan={7}>
                      Cargando pagos...
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td className="px-3 py-8 text-center text-slate-600" colSpan={7}>
                      No hay pagos para los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id} className="border-t border-slate-200 text-slate-900">
                      <td className="px-3 py-2">{row.numero || "-"}</td>
                      <td className="px-3 py-2">{row.contacto || "-"}</td>
                      <td className="px-3 py-2">{row.company_name || "-"}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {formatPaymentPeriod(row.fecha, row.producto) || "-"}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">{formatCurrency(row.total ?? 0)}</td>
                      <td className="px-3 py-2 max-w-xs truncate" title={row.producto ?? undefined}>
                        {row.producto || "-"}
                      </td>
                      <td className="px-3 py-2">{row.pms_en_ficha || row.pms || "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-white/80">
              Página {page} de {totalPages}
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
