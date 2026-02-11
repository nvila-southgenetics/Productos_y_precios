"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { BarChart3, Package, CalendarDays } from "lucide-react"
import { CompanyFilter } from "@/components/pl-import/CompanyFilter"
import { ProductFilter } from "@/components/pl-import/ProductFilter"
import { YearFilter } from "@/components/pl-import/YearFilter"
import { YearSection } from "@/components/pl-import/YearSection"
import { MonthDropdown } from "@/components/pl-import/MonthDropdown"
import { SalesCalendar } from "@/components/pl-import/SalesCalendar"
import {
  getCompanies,
  getProductsFromSales,
  getAvailablePeriods,
  getMonthlySales,
  getAnnualTotal,
  getSalesByDate,
  type MonthlySalesWithProduct,
  type VentaByDate,
} from "@/lib/supabase-mcp"

export default function PLImportPage() {
  const [companies, setCompanies] = useState<string[]>([])
  const [products, setProducts] = useState<string[]>([])
  const [selectedCompany, setSelectedCompany] = useState("Todas las compañías")
  const [selectedProduct, setSelectedProduct] = useState("Todos")
  const [selectedYear, setSelectedYear] = useState("Todos")
  const [periods, setPeriods] = useState<string[]>([])
  const [availableYears, setAvailableYears] = useState<string[]>([])
  const [monthlyData, setMonthlyData] = useState<Record<string, MonthlySalesWithProduct[]>>({})
  const [totalData, setTotalData] = useState<MonthlySalesWithProduct[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadingPeriods, setLoadingPeriods] = useState<Set<string>>(new Set())
  const loadingRef = useRef<Set<string>>(new Set()) // Ref para rastrear períodos en carga

  // Calendario: ventas por fecha
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null)
  const [salesByDate, setSalesByDate] = useState<VentaByDate[]>([])
  const [loadingSalesByDate, setLoadingSalesByDate] = useState(false)

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
        // Mantener "Todas las compañías" como valor por defecto
      } catch (error) {
        console.error("Error loading initial data:", error)
      } finally {
        setIsLoading(false)
      }
    }
    loadInitialData()
  }, [])

  // Función para cargar datos de un período específico - MEMOIZADA para evitar loops infinitos
  const loadPeriodData = useCallback(async (periodo: string) => {
    // Verificar si ya está cargando usando ref (síncrono)
    if (loadingRef.current.has(periodo)) {
      return // Ya está en proceso de carga
    }

    // Verificar si ya está cargado
    setMonthlyData((prev) => {
      if (prev[periodo] && prev[periodo].length > 0) {
        return prev // Ya está cargado
      }
      return prev
    })

    // Marcar como cargando
    loadingRef.current.add(periodo)
    setLoadingPeriods((prev) => new Set(prev).add(periodo))

    try {
      const data = await getMonthlySales(selectedCompany, periodo, selectedProduct)
      setMonthlyData((prev) => {
        // Solo actualizar si no existe
        if (prev[periodo] && prev[periodo].length > 0) {
          return prev
        }
        return { ...prev, [periodo]: data }
      })
    } catch (error) {
      console.error(`Error loading period ${periodo}:`, error)
    } finally {
      // Remover de loading
      loadingRef.current.delete(periodo)
      setLoadingPeriods((prev) => {
        const newSet = new Set(prev)
        newSet.delete(periodo)
        return newSet
      })
    }
  }, [selectedCompany, selectedProduct])

  // Cargar períodos cuando cambia la compañía
  useEffect(() => {
    async function loadPeriods() {
      if (!selectedCompany) return
      try {
        // Limpiar datos anteriores al cambiar compañía
        setMonthlyData({})
        setTotalData([])
        loadingRef.current.clear() // Limpiar ref también
        setLoadingPeriods(new Set())
        
        const periodsData = await getAvailablePeriods(selectedCompany)
        console.log(`📊 Períodos cargados para ${selectedCompany}:`, periodsData)
        setPeriods(periodsData)
        
        // Extraer años únicos de los períodos
        const years = Array.from(
          new Set(periodsData.map((p) => p.split("-")[0]))
        ).sort((a, b) => b.localeCompare(a)) // Ordenar descendente (años más recientes primero)
        console.log(`📅 Años disponibles:`, years)
        setAvailableYears(years)
        
        // Resetear año seleccionado al cambiar compañía
        setSelectedYear("Todos")
      } catch (error) {
        console.error("Error loading periods:", error)
      }
    }
    loadPeriods()
  }, [selectedCompany])

  // Cargar datos de todos los períodos automáticamente cuando cambian los períodos o el producto
  useEffect(() => {
    if (periods.length === 0 || !selectedCompany) return
    
    // Cargar datos de cada período automáticamente
    periods.forEach((periodo, index) => {
      // Delay escalonado para evitar sobrecarga
      setTimeout(() => {
        loadPeriodData(periodo)
      }, index * 50)
    })
  }, [periods, selectedProduct, loadPeriodData])

  // Cargar total anual cuando cambian los filtros
  useEffect(() => {
    async function loadTotal() {
      if (!selectedCompany) return
      try {
        const total = await getAnnualTotal(selectedCompany, selectedProduct)
        setTotalData(total)
      } catch (error) {
        console.error("Error loading total:", error)
      }
    }
    loadTotal()
  }, [selectedCompany, selectedProduct])
  
  // Limpiar datos cuando cambia el producto
  useEffect(() => {
    setMonthlyData({})
    loadingRef.current.clear() // Limpiar ref también
    setLoadingPeriods(new Set())
  }, [selectedProduct])

  // Cargar ventas al seleccionar una fecha en el calendario
  useEffect(() => {
    if (!selectedCalendarDate) {
      setSalesByDate([])
      return
    }
    let cancelled = false
    setLoadingSalesByDate(true)
    getSalesByDate(selectedCalendarDate)
      .then((data) => {
        if (!cancelled) setSalesByDate(data)
      })
      .catch((err) => {
        if (!cancelled) console.error("Error loading sales by date:", err)
      })
      .finally(() => {
        if (!cancelled) setLoadingSalesByDate(false)
      })
    return () => {
      cancelled = true
    }
  }, [selectedCalendarDate])

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      {/* Calendario: ventas por día */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <CalendarDays className="h-5 w-5 text-blue-600" />
          <h1 className="text-xl font-bold">Ventas por fecha</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-3">
          Selecciona un día para ver todas las ventas de esa fecha
        </p>
        <div className="flex flex-wrap items-start gap-6">
          <SalesCalendar
            selectedDate={selectedCalendarDate}
            onSelectDate={setSelectedCalendarDate}
          />
          {selectedCalendarDate && (
            <div className="flex-1 min-w-0 rounded-lg border border-blue-200/50 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-blue-900 mb-3">
                Ventas del {format(new Date(selectedCalendarDate + "T12:00:00"), "EEEE d 'de' MMMM yyyy", { locale: es })}
              </h3>
              {loadingSalesByDate ? (
                <p className="text-sm text-slate-500">Cargando...</p>
              ) : salesByDate.length === 0 ? (
                <p className="text-sm text-slate-500">No hay ventas registradas para esta fecha.</p>
              ) : (
                <div className="overflow-x-auto max-h-[320px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-blue-50 border-b border-blue-200">
                      <tr>
                        <th className="text-left py-2 px-2 font-semibold text-blue-900">Compañía</th>
                        <th className="text-left py-2 px-2 font-semibold text-blue-900">Producto</th>
                        <th className="text-right py-2 px-2 font-semibold text-blue-900">Monto (USD)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {salesByDate.map((v) => (
                        <tr key={v.id} className="border-b border-slate-100 hover:bg-blue-50/50">
                          <td className="py-2 px-2 text-slate-700">{v.company}</td>
                          <td className="py-2 px-2 text-slate-700">{v.test}</td>
                          <td className="py-2 px-2 text-right font-medium text-slate-800">
                            {typeof v.amount === "number" ? v.amount.toFixed(2) : v.amount}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <BarChart3 className="h-5 w-5" />
          <h2 className="text-xl font-bold">Filtros de Visualización</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Selecciona una compañía para filtrar las ventas
        </p>
      </div>

      {/* Filtros */}
      <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <CompanyFilter
          companies={companies}
          selectedCompany={selectedCompany}
          onCompanyChange={setSelectedCompany}
        />
        <ProductFilter
          products={products}
          selectedProduct={selectedProduct}
          onProductChange={setSelectedProduct}
        />
        <YearFilter
          years={availableYears}
          selectedYear={selectedYear}
          onYearChange={setSelectedYear}
        />
      </div>

      {/* Sección Principal */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <Package className="h-4 w-4" />
          <h2 className="text-lg font-semibold">Detalle de Productos Vendidos</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-3">
          Lista de productos vendidos con sus cantidades totales, agrupados por año
        </p>

        {/* Agrupar períodos por año */}
        <div className="space-y-4">
          {(() => {
            // Agrupar períodos por año
            const periodsByYear: Record<string, string[]> = {}
            
            periods.forEach((periodo) => {
              const year = periodo.split("-")[0]
              if (!periodsByYear[year]) {
                periodsByYear[year] = []
              }
              periodsByYear[year].push(periodo)
            })

            // Ordenar años descendente (más reciente primero)
            const sortedYears = Object.keys(periodsByYear).sort((a, b) => b.localeCompare(a))

            // Si hay filtro de año, mostrar solo ese año
            const yearsToShow = selectedYear === "Todos" 
              ? sortedYears 
              : sortedYears.filter(y => y === selectedYear)

            return yearsToShow.map((year) => {
              const yearPeriods = periodsByYear[year]
              
              // Calcular total anual para este año específico agregando las ventas de los períodos del año
              const isAllCompanies = selectedCompany === "Todas las compañías"
              const yearTotalData = yearPeriods.reduce((acc, periodo) => {
                const sales = monthlyData[periodo] || []
                sales.forEach((sale) => {
                  const existing = acc.find((item) => item.producto === sale.producto)
                  if (existing) {
                    existing.cantidad_ventas += sale.cantidad_ventas
                    existing.monto_total = (existing.monto_total || 0) + (sale.monto_total || 0)
                    // Recalcular precio promedio
                    if (existing.cantidad_ventas > 0 && existing.monto_total) {
                      existing.precio_promedio = existing.monto_total / existing.cantidad_ventas
                    }
                    
                    // Si es "Todas las compañías", mantener el desglose por compañía
                    if (isAllCompanies) {
                      if (!existing.companyBreakdown) {
                        existing.companyBreakdown = []
                      }
                      const companyBreakdown = existing.companyBreakdown.find((cb: any) => cb.compañia === sale.compañia)
                      if (companyBreakdown) {
                        companyBreakdown.cantidad_ventas += sale.cantidad_ventas
                        companyBreakdown.monto_total = (companyBreakdown.monto_total || 0) + (sale.monto_total || 0)
                      } else {
                        existing.companyBreakdown.push({
                          compañia: sale.compañia,
                          cantidad_ventas: sale.cantidad_ventas,
                          monto_total: sale.monto_total || 0
                        })
                      }
                    }
                  } else {
                    const newItem: any = {
                      ...sale,
                      periodo: `Total ${year}`,
                      mes: 0,
                      año: parseInt(year),
                    }
                    
                    // Si es "Todas las compañías", agregar desglose por compañía
                    if (isAllCompanies) {
                      newItem.companyBreakdown = [{
                        compañia: sale.compañia,
                        cantidad_ventas: sale.cantidad_ventas,
                        monto_total: sale.monto_total || 0
                      }]
                    }
                    
                    acc.push(newItem)
                  }
                })
                return acc
              }, [] as MonthlySalesWithProduct[])
              
              // Si es "Todas las compañías" y hay totalData de getAnnualTotal, usar ese en lugar del cálculo local
              // porque getAnnualTotal ya tiene el desglose completo por compañía
              const finalTotalData = isAllCompanies && totalData.length > 0 ? totalData : yearTotalData
              
              // Solo mostrar total si hay datos cargados
              const hasData = yearPeriods.some(p => (monthlyData[p] || []).length > 0) || (isAllCompanies && totalData.length > 0)

              return (
                <YearSection
                  key={year}
                  year={year}
                  periods={yearPeriods}
                  monthlyData={monthlyData}
                  loadingPeriods={loadingPeriods}
                  selectedCompany={selectedCompany}
                  onExpandPeriod={loadPeriodData}
                  totalData={finalTotalData.length > 0 && hasData ? finalTotalData : undefined}
                  isAllCompanies={isAllCompanies}
                />
              )
            })
          })()}

          {/* Si no hay períodos, mostrar mensaje */}
          {periods.length === 0 && !isLoading && (
            <div className="text-center py-8 text-muted-foreground">
              <p>No hay períodos disponibles para la compañía seleccionada.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

