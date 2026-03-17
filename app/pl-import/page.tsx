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
import { usePermissions } from "@/lib/use-permissions"
import { filterCompaniesByCountries } from "@/lib/auth-constants"

export default function PLImportPage() {
  const { allowedCountries, isAdmin, loading: permLoading } = usePermissions()
  const [companies, setCompanies] = useState<string[]>([])
  const [products, setProducts] = useState<string[]>([])
  const [selectedCompany, setSelectedCompany] = useState("Todas las compañías")
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
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
        const filtered = filterCompaniesByCountries(companiesData, allowedCountries)
        setCompanies(filtered)
        setProducts(productsData)
        // Para no-admins, auto-seleccionar la primera compañía permitida
        if (!isAdmin && filtered.length > 0) {
          setSelectedCompany(filtered[0])
        }
      } catch (error) {
        console.error("Error loading initial data:", error)
      } finally {
        setIsLoading(false)
      }
    }
    if (!permLoading) loadInitialData()
  }, [allowedCountries, isAdmin, permLoading])

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
      const data = await getMonthlySales(selectedCompany, periodo, selectedProducts.length ? selectedProducts : undefined)
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
  }, [selectedCompany, selectedProducts])

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
    if (periods.length === 0 || !selectedCompany) {
      return () => {
        // Cleanup cuando no hay períodos o compañía
      }
    }
    
    // Cargar datos de cada período automáticamente
    periods.forEach((periodo, index) => {
      // Delay escalonado para evitar sobrecarga
      setTimeout(() => {
        loadPeriodData(periodo)
      }, index * 50)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periods, selectedProducts])

  // Cargar total anual cuando cambian los filtros
  useEffect(() => {
    async function loadTotal() {
      if (!selectedCompany) return
      try {
        const total = await getAnnualTotal(selectedCompany, selectedProducts.length ? selectedProducts : undefined)
        setTotalData(total)
      } catch (error) {
        console.error("Error loading total:", error)
      }
    }
    loadTotal()
  }, [selectedCompany, selectedProducts])
  
  // Limpiar datos cuando cambia el producto
  useEffect(() => {
    setMonthlyData({})
    loadingRef.current.clear() // Limpiar ref también
    setLoadingPeriods(new Set())
  }, [selectedProducts])

  // Cargar ventas al seleccionar una fecha en el calendario
  useEffect(() => {
    let cancelled = false
    
    if (!selectedCalendarDate) {
      setSalesByDate([])
    } else {
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
    }
    
    return () => {
      cancelled = true
    }
  }, [selectedCalendarDate])

  return (
    <div className="min-h-screen bg-gradient-to-r from-blue-900 via-blue-950 to-slate-900">
      <div className="container mx-auto py-8 px-4 max-w-7xl">
        {/* Calendario: ventas por día */}
        <div className="mb-6 rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <CalendarDays className="h-5 w-5 text-white" />
            <h1 className="text-xl font-bold text-white">Ventas por fecha</h1>
          </div>
          <p className="text-sm text-white/70 mb-3">
            Selecciona un día para ver todas las ventas de esa fecha
          </p>
          <div className="flex flex-wrap items-start gap-6">
            <SalesCalendar
              selectedDate={selectedCalendarDate}
              onSelectDate={setSelectedCalendarDate}
            />
            {selectedCalendarDate && (
              <div className="flex-1 min-w-0 rounded-lg border border-white/20 bg-white/10 backdrop-blur-sm p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-white mb-3">
                  Ventas del {format(new Date(selectedCalendarDate + "T12:00:00"), "EEEE d 'de' MMMM yyyy", { locale: es })}
                </h3>
                {loadingSalesByDate ? (
                  <p className="text-sm text-white/60">Cargando...</p>
                ) : salesByDate.length === 0 ? (
                  <p className="text-sm text-white/60">No hay ventas registradas para esta fecha.</p>
                ) : (
                  <div className="overflow-x-auto max-h-[320px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-white/10 border-b border-white/20">
                        <tr>
                          <th className="text-left py-2 px-2 font-semibold text-white">Compañía</th>
                          <th className="text-left py-2 px-2 font-semibold text-white">Producto</th>
                          <th className="text-right py-2 px-2 font-semibold text-white">Monto (USD)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {salesByDate.map((v) => (
                          <tr key={v.id} className="border-b border-white/10 hover:bg-white/5">
                            <td className="py-2 px-2 text-white/80">{v.company}</td>
                            <td className="py-2 px-2 text-white/80">{v.test}</td>
                            <td className="py-2 px-2 text-right font-medium text-white">
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
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="h-5 w-5 text-white" />
            <h2 className="text-xl font-bold text-white">Filtros de Visualización</h2>
          </div>
          <p className="text-sm text-white/80">
            Selecciona una compañía para filtrar las ventas
          </p>
        </div>

        {/* Filtros */}
        <div className="mb-6 rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 p-4 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <CompanyFilter
          companies={companies}
          selectedCompany={selectedCompany}
          onCompanyChange={setSelectedCompany}
          showAllCompanies={isAdmin}
        />
        <ProductFilter
          products={products}
          selectedProducts={selectedProducts}
          onProductsChange={setSelectedProducts}
        />
            <YearFilter
              years={availableYears}
              selectedYear={selectedYear}
              onYearChange={setSelectedYear}
            />
          </div>
        </div>

        {/* Sección Principal */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Package className="h-4 w-4 text-white" />
            <h2 className="text-lg font-semibold text-white">Detalle de Productos Vendidos</h2>
          </div>
          <p className="text-sm text-white/70 mb-3">
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
              
              // Calcular total anual para este año específico
              const isAllCompanies = selectedCompany === "Todas las compañías"
              
              // Si es "Todas las compañías", usar totalData de getAnnualTotal que ya tiene el desglose completo
              // Si no, calcular desde los períodos mensuales
              let finalTotalData: MonthlySalesWithProduct[]
              
              if (isAllCompanies && totalData.length > 0) {
                finalTotalData = totalData
              } else {
                // Calcular total anual desde los períodos mensuales
                finalTotalData = yearPeriods.reduce((acc, periodo) => {
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
                      
                      // Si es "Todas las compañías" y el sale tiene companyBreakdown, combinarlo
                      if (isAllCompanies && sale.companyBreakdown) {
                        if (!existing.companyBreakdown) {
                          existing.companyBreakdown = []
                        }
                        sale.companyBreakdown.forEach((cb: any) => {
                          const existingBreakdown = existing.companyBreakdown!.find((eb: any) => eb.compañia === cb.compañia)
                          if (existingBreakdown) {
                            existingBreakdown.cantidad_ventas += cb.cantidad_ventas
                            existingBreakdown.monto_total = (existingBreakdown.monto_total || 0) + (cb.monto_total || 0)
                          } else {
                            existing.companyBreakdown!.push({ ...cb })
                          }
                        })
                      }
                    } else {
                      const newItem: any = {
                        ...sale,
                        periodo: `Total ${year}`,
                        mes: 0,
                        año: parseInt(year),
                      }
                      
                      // Si es "Todas las compañías" y tiene companyBreakdown, copiarlo
                      if (isAllCompanies && sale.companyBreakdown) {
                        newItem.companyBreakdown = sale.companyBreakdown.map((cb: any) => ({ ...cb }))
                      }
                      
                      acc.push(newItem)
                    }
                  })
                  return acc
                }, [] as MonthlySalesWithProduct[])
              }
              
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
            <div className="text-center py-8 text-white/60">
              <p>No hay períodos disponibles para la compañía seleccionada.</p>
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  )
}

