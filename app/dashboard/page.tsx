"use client"

import { useState, useEffect, useMemo } from "react"
import { motion } from "framer-motion"
import {
  TrendingUp,
  Award,
  BarChart3,
  DollarSign,
  TrendingDown,
  Package,
  Percent,
} from "lucide-react"
import { DashboardFilters } from "@/components/dashboard/DashboardFilters"
import {
  getCompanies,
  getProductsFromSales,
  getAvailablePeriods,
  getTopSellingProducts,
  getTopMarginProducts,
  getBottomMarginProducts,
  getMostExpensiveProducts,
  getMonthlySalesEvolution,
  type DashboardProduct,
  type MonthlyEvolutionPoint,
} from "@/lib/supabase-mcp"
import { MetricCard } from "@/components/dashboard/MetricCard"
import { ProductRanking } from "@/components/dashboard/ProductRanking"
import { SalesChart } from "@/components/dashboard/SalesChart"
import { MarginChart } from "@/components/dashboard/MarginChart"
import { CategoryDistribution } from "@/components/dashboard/CategoryDistribution"
import { MonthlySalesEvolutionChart } from "@/components/dashboard/MonthlySalesEvolutionChart"

export default function DashboardPage() {
  const [companies, setCompanies] = useState<string[]>([])
  const [products, setProducts] = useState<string[]>([])
  const [selectedCompany, setSelectedCompany] = useState("Todas las compañías")
  const [selectedProduct, setSelectedProduct] = useState("Todos")
  const [selectedYear, setSelectedYear] = useState("Todos")
  const [selectedMonth, setSelectedMonth] = useState("Todos")
  const [availableYears, setAvailableYears] = useState<string[]>([])
  const [topSelling, setTopSelling] = useState<DashboardProduct[]>([])
  const [topMargin, setTopMargin] = useState<DashboardProduct[]>([])
  const [bottomMargin, setBottomMargin] = useState<DashboardProduct[]>([])
  const [mostExpensive, setMostExpensive] = useState<DashboardProduct[]>([])
  const [monthlyEvolution2025, setMonthlyEvolution2025] = useState<MonthlyEvolutionPoint[]>([])
  const [monthlyEvolution2026, setMonthlyEvolution2026] = useState<MonthlyEvolutionPoint[]>([])
  const [chartProductFilter, setChartProductFilter] = useState("Todos")
  const [isEvolutionLoading, setIsEvolutionLoading] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Cargar compañías y productos
  useEffect(() => {
    async function loadInitialData() {
      setIsLoading(true)
      try {
        const [companiesData, productsData] = await Promise.all([
          getCompanies(),
          getProductsFromSales(),
        ])
        setCompanies(companiesData)
        setProducts(productsData)
      } catch (error) {
        console.error("Error loading initial data:", error)
      } finally {
        setIsLoading(false)
      }
    }
    loadInitialData()
  }, [])

  // Cargar años disponibles
  useEffect(() => {
    async function loadYears() {
      if (!selectedCompany) return
      try {
        const periodsData = await getAvailablePeriods(selectedCompany)
        const years = Array.from(
          new Set(periodsData.map((p) => p.split("-")[0]))
        ).sort((a, b) => b.localeCompare(a))
        setAvailableYears(years)
      } catch (error) {
        console.error("Error loading years:", error)
      }
    }
    loadYears()
  }, [selectedCompany])

  // Cargar datos del dashboard
  useEffect(() => {
    async function loadDashboardData() {
      if (!selectedCompany) return
      setIsLoading(true)
      try {
        const [selling, topMarginData, bottomMarginData, expensive] =
          await Promise.all([
            getTopSellingProducts(
              selectedCompany,
              selectedYear !== "Todos" ? selectedYear : undefined,
              selectedMonth !== "Todos" ? selectedMonth : undefined,
              selectedProduct !== "Todos" ? selectedProduct : undefined,
              10
            ),
            getTopMarginProducts(
              selectedCompany,
              selectedYear !== "Todos" ? selectedYear : undefined,
              selectedMonth !== "Todos" ? selectedMonth : undefined,
              selectedProduct !== "Todos" ? selectedProduct : undefined,
              10
            ),
            getBottomMarginProducts(
              selectedCompany,
              selectedYear !== "Todos" ? selectedYear : undefined,
              selectedMonth !== "Todos" ? selectedMonth : undefined,
              selectedProduct !== "Todos" ? selectedProduct : undefined,
              10
            ),
            getMostExpensiveProducts(
              selectedCompany,
              selectedYear !== "Todos" ? selectedYear : undefined,
              selectedMonth !== "Todos" ? selectedMonth : undefined,
              selectedProduct !== "Todos" ? selectedProduct : undefined,
              10
            ),
          ])
        setTopSelling(selling)
        setTopMargin(topMarginData)
        setBottomMargin(bottomMarginData)
        setMostExpensive(expensive)
      } catch (error) {
        console.error("Error loading dashboard data:", error)
      } finally {
        setIsLoading(false)
      }
    }
    loadDashboardData()
  }, [selectedCompany, selectedYear, selectedMonth, selectedProduct])

  // Cargar evolución mensual 2025 vs 2026 (usa el filtro de producto de la gráfica)
  useEffect(() => {
    async function loadEvolution() {
      setIsEvolutionLoading(true)
      try {
        const company =
          selectedCompany === "Todas las compañías" ? undefined : selectedCompany
        const product = chartProductFilter === "Todos" ? undefined : chartProductFilter
        const { year2025, year2026 } = await getMonthlySalesEvolution(company, product)
        setMonthlyEvolution2025(year2025)
        setMonthlyEvolution2026(year2026)
      } catch (error) {
        console.error("Error loading monthly evolution:", error)
      } finally {
        setIsEvolutionLoading(false)
      }
    }
    loadEvolution()
  }, [selectedCompany, chartProductFilter])

  // Calcular métricas agregadas
  const metrics = useMemo(() => {
    const totalSales = topSelling.reduce(
      (sum, p) => sum + p.cantidad_ventas,
      0
    )
    const totalRevenue = topSelling.reduce(
      (sum, p) => sum + (p.gross_sale || 0),
      0
    )
    const totalProfit = topSelling.reduce(
      (sum, p) => sum + (p.gross_profit || 0),
      0
    )
    const avgMargin =
      topSelling.length > 0
        ? topSelling.reduce((sum, p) => sum + p.gross_margin_percent, 0) /
          topSelling.length
        : 0

    return {
      totalSales,
      totalRevenue,
      totalProfit,
      avgMargin,
    }
  }, [topSelling])

  return (
    <div className="min-h-screen bg-gradient-to-r from-blue-900 via-blue-950 to-slate-900">
      <div className="container mx-auto py-8 px-4 max-w-7xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-6"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-white/10 backdrop-blur-sm shadow-lg border border-white/20">
              <BarChart3 className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Dashboard</h1>
              <p className="text-sm text-white/80 mt-1">
                Análisis completo de productos y rendimiento comercial
              </p>
            </div>
          </div>
        </motion.div>

        {/* Filtros */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="mb-6 rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 p-4 shadow-sm"
        >
          <DashboardFilters
            companies={companies}
            products={products}
            availableYears={availableYears}
            selectedCompany={selectedCompany}
            selectedProduct={selectedProduct}
            selectedYear={selectedYear}
            selectedMonth={selectedMonth}
            onCompanyChange={setSelectedCompany}
            onProductChange={setSelectedProduct}
            onYearChange={setSelectedYear}
            onMonthChange={setSelectedMonth}
          />
        </motion.div>

        {/* Contenido */}
        {isLoading ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20"
          >
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4"></div>
            <p className="text-white/80">Cargando datos del dashboard...</p>
          </motion.div>
        ) : (
          <>
            {/* Métricas principales */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6"
            >
              <MetricCard
                title="Total Ventas"
                value={metrics.totalSales.toLocaleString("es-UY")}
                subtitle="Unidades vendidas"
                icon={Package}
                iconColor="text-blue-600"
              />
              <MetricCard
                title="Ingresos Totales"
                value={`$${metrics.totalRevenue.toLocaleString("es-UY", {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}`}
                subtitle="Gross Sales"
                icon={DollarSign}
                iconColor="text-emerald-600"
              />
              <MetricCard
                title="Ganancia Total"
                value={`$${metrics.totalProfit.toLocaleString("es-UY", {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}`}
                subtitle="Gross Profit"
                icon={TrendingUp}
                iconColor="text-amber-600"
              />
              <MetricCard
                title="Margen Promedio"
                value={`${metrics.avgMargin.toFixed(1)}%`}
                subtitle="Por producto"
                icon={Percent}
                iconColor="text-purple-600"
              />
            </motion.div>

            {/* Evolución mensual 2025 vs 2026 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.25 }}
              className="mb-6"
            >
              <MonthlySalesEvolutionChart
                year2025={monthlyEvolution2025}
                year2026={monthlyEvolution2026}
                products={products}
                selectedProduct={chartProductFilter}
                onProductChange={setChartProductFilter}
                isLoading={isEvolutionLoading}
              />
            </motion.div>

            {/* Gráficas principales */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6"
            >
              <SalesChart
                products={topSelling}
                title="Top Productos por Ventas"
                dataKey="cantidad_ventas"
                color="#3b82f6"
              />
              <MarginChart
                products={topMargin}
                title="Distribución de Márgenes"
              />
            </motion.div>

            {/* Distribución por categoría */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="mb-6"
            >
              <CategoryDistribution
                products={topSelling}
                title="Distribución de Ventas por Categoría"
              />
            </motion.div>

            {/* Rankings */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.7 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-4"
            >
              <ProductRanking
                products={topSelling}
                title="Productos Más Vendidos"
                metricLabel="ventas"
                getMetricValue={(p) => p.cantidad_ventas.toLocaleString("es-UY")}
                getMetricColor={(_, index) => {
                  if (index === 0) return "bg-gradient-to-br from-blue-500 to-blue-600"
                  if (index === 1) return "bg-gradient-to-br from-blue-400 to-blue-500"
                  if (index === 2) return "bg-gradient-to-br from-blue-300 to-blue-400"
                  return "bg-slate-400"
                }}
                iconColor="text-blue-600"
              />

              <ProductRanking
                products={mostExpensive}
                title="Productos Más Caros"
                metricLabel="precio unitario"
                getMetricValue={(p) =>
                  `$${(
                    p.overrides?.grossSalesUSD || 0
                  ).toLocaleString("es-UY", {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  })}`
                }
                getMetricColor={(_, index) => {
                  if (index === 0) return "bg-gradient-to-br from-purple-500 to-purple-600"
                  if (index === 1) return "bg-gradient-to-br from-purple-400 to-purple-500"
                  if (index === 2) return "bg-gradient-to-br from-purple-300 to-purple-400"
                  return "bg-slate-400"
                }}
                iconColor="text-purple-600"
              />

              <ProductRanking
                products={topMargin}
                title="Mayor Margen de Ganancia"
                metricLabel="margen"
                getMetricValue={(p) => `${p.gross_margin_percent.toFixed(1)}%`}
                getMetricColor={(_, index) => {
                  if (index === 0) return "bg-gradient-to-br from-emerald-500 to-emerald-600"
                  if (index === 1) return "bg-gradient-to-br from-emerald-400 to-emerald-500"
                  if (index === 2) return "bg-gradient-to-br from-emerald-300 to-emerald-400"
                  return "bg-slate-400"
                }}
                iconColor="text-emerald-600"
              />

              <ProductRanking
                products={bottomMargin}
                title="Menor Margen de Ganancia"
                metricLabel="margen"
                getMetricValue={(p) => `${p.gross_margin_percent.toFixed(1)}%`}
                getMetricColor={(_, index) => {
                  if (index === 0) return "bg-gradient-to-br from-red-500 to-red-600"
                  if (index === 1) return "bg-gradient-to-br from-red-400 to-red-500"
                  if (index === 2) return "bg-gradient-to-br from-red-300 to-red-400"
                  return "bg-slate-400"
                }}
                iconColor="text-red-600"
              />
            </motion.div>
          </>
        )}
      </div>
    </div>
  )
}
