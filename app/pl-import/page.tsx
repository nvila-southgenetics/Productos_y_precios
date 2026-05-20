"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { BarChart3, Package, CalendarDays } from "lucide-react"
import { MultiCheckboxDropdown, type MultiSelectOption } from "@/components/filters/MultiCheckboxDropdown"
import { MonthRangeFilter, monthsFromRange } from "@/components/filters/MonthRangeFilter"
import { Select } from "@/components/ui/select"
import { ProductMultiSearchFilter } from "@/components/dashboard/ProductMultiSearchFilter"
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
import { companyQueryFromSelection } from "@/lib/company-filter"

export default function PLImportPage() {
  const { allowedCountries, isAdmin, loading: permLoading } = usePermissions()
  const [companies, setCompanies] = useState<string[]>([])
  const [products, setProducts] = useState<string[]>([])
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([])
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  const [selectedYear, setSelectedYear] = useState("Todos")
  const [monthFrom, setMonthFrom] = useState(1)
  const [monthTo, setMonthTo] = useState(12)
  const [periods, setPeriods] = useState<string[]>([])
  const [availableYears, setAvailableYears] = useState<string[]>([])
  const [monthlyData, setMonthlyData] = useState<Record<string, MonthlySalesWithProduct[]>>({})
  const [totalData, setTotalData] = useState<MonthlySalesWithProduct[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadingPeriods, setLoadingPeriods] = useState<Set<string>>(new Set())
  const loadingRef = useRef<Set<string>>(new Set()) // Ref para rastrear períodos en carga
  const queryKeyRef = useRef(0) // Evita que respuestas viejas pisen el estado

  const companyParam = useMemo(
    () => companyQueryFromSelection(companies, selectedCompanies, isAdmin),
    [companies, selectedCompanies, isAdmin]
  )

  const companyLabelForUi =
    typeof companyParam === "string"
      ? companyParam
      : companyParam.join(" · ")

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
        setSelectedCompanies(isAdmin ? [...filtered] : filtered.length ? [filtered[0]] : [])
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
    const myKey = queryKeyRef.current
    // Verificar si ya está cargando usando ref (síncrono)
    if (loadingRef.current.has(periodo)) {
      return // Ya está en proceso de carga
    }

    // Verificar si ya está cargado (lectura síncrona por cierre no es confiable),
    // se re-chequea antes de setear el resultado.

    // Marcar como cargando
    loadingRef.current.add(periodo)
    setLoadingPeriods((prev) => new Set(prev).add(periodo))

    try {
      const data = await getMonthlySales(companyParam, periodo, selectedProducts.length ? selectedProducts : undefined)
      if (queryKeyRef.current !== myKey) return
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
  }, [companyParam, selectedProducts])

  // Cargar períodos cuando cambia la compañía
  useEffect(() => {
    async function loadPeriods() {
      if (!companies.length) return
      const myKey = ++queryKeyRef.current
      try {
        // Limpiar datos anteriores al cambiar compañía
        setMonthlyData({})
        setTotalData([])
        loadingRef.current.clear() // Limpiar ref también
        setLoadingPeriods(new Set())
        
        const periodsData = await getAvailablePeriods(companyParam)
        if (queryKeyRef.current !== myKey) return
        console.log(`📊 Períodos cargados para ${companyLabelForUi}:`, periodsData)
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
  }, [companies.length, companyParam])

  // Cargar datos de todos los períodos automáticamente cuando cambian los períodos o el producto
  useEffect(() => {
    if (periods.length === 0 || !companies.length) {
      return () => {
        // Cleanup cuando no hay períodos o compañía
      }
    }
    
    const myKey = queryKeyRef.current
    const timeouts: number[] = []
    // Cargar datos de cada período automáticamente
    periods.forEach((periodo, index) => {
      // Delay escalonado para evitar sobrecarga
      const id = window.setTimeout(() => {
        if (queryKeyRef.current !== myKey) return
        loadPeriodData(periodo)
      }, index * 50)
      timeouts.push(id)
    })

    return () => {
      for (const id of timeouts) window.clearTimeout(id)
    }
  }, [periods, selectedProducts, companyParam])

  // Cargar total anual cuando cambian los filtros
  useEffect(() => {
    async function loadTotal() {
      if (!companies.length) return
      const myKey = queryKeyRef.current
      try {
        const total = await getAnnualTotal(companyParam, selectedProducts.length ? selectedProducts : undefined)
        if (queryKeyRef.current !== myKey) return
        setTotalData(total)
      } catch (error) {
        console.error("Error loading total:", error)
      }
    }
    loadTotal()
  }, [companies.length, companyParam, selectedProducts])
  
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
            Elegí una o varias compañías, productos, año y rango de meses (mismo formato que Budget y P&L).
          </p>
        </div>

        {/* Filtros */}
        <div className="mb-6 rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 p-4 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MultiCheckboxDropdown
              label="Compañía"
              options={companies.map((c): MultiSelectOption => ({ value: c, label: c }))}
              selectedValues={
                selectedCompanies.length ? selectedCompanies : companies.map((c) => c)
              }
              onSelectedValuesChange={setSelectedCompanies}
              allLabel={isAdmin ? "Todas las compañías" : "Todas (mis compañías)"}
            />
            <ProductMultiSearchFilter
              products={products}
              selectedProducts={selectedProducts}
              onSelectedProductsChange={setSelectedProducts}
              disabled={products.length === 0}
              allLabel="Todos los productos"
            />
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-white/90">Año</label>
              <Select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="w-full bg-white/10 border-white/20 text-white focus:border-white/30 focus:ring-white/30"
              >
                <option value="Todos" className="bg-blue-900 text-white">
                  Todos
                </option>
                {availableYears.map((y) => (
                  <option key={y} value={y} className="bg-blue-900 text-white">
                    {y}
                  </option>
                ))}
              </Select>
            </div>
            <MonthRangeFilter
              label="Mes"
              fromMonth={monthFrom}
              toMonth={monthTo}
              onChange={({ fromMonth: f, toMonth: t }) => {
                setMonthFrom(f)
                setMonthTo(t)
              }}
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

            const allowedMonthNums = new Set(
              monthsFromRange({ fromMonth: monthFrom, toMonth: monthTo }).map((m) => parseInt(m, 10))
            )

            return yearsToShow.map((year) => {
              const yearPeriods = periodsByYear[year].filter((periodo) => {
                const m = parseInt(periodo.split("-")[1] || "0", 10)
                return allowedMonthNums.has(m)
              })
              
              const showAggregateBreakdown =
                (typeof companyParam === "string" && companyParam === "Todas las compañías") ||
                (Array.isArray(companyParam) && companyParam.length > 1)
              
              // Si es "Todas las compañías", usar totalData de getAnnualTotal que ya tiene el desglose completo
              // Si no, calcular desde los períodos mensuales
              let finalTotalData: MonthlySalesWithProduct[]
              
              if (showAggregateBreakdown && totalData.length > 0) {
                finalTotalData = totalData.filter((item) => String(item.año) === year)
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
                      
                      // Si hay agregación multi-compañía y el sale tiene companyBreakdown, combinarlo
                      if (showAggregateBreakdown && sale.companyBreakdown) {
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
                      if (showAggregateBreakdown && sale.companyBreakdown) {
                        newItem.companyBreakdown = sale.companyBreakdown.map((cb: any) => ({ ...cb }))
                      }
                      
                      acc.push(newItem)
                    }
                  })
                  return acc
                }, [] as MonthlySalesWithProduct[])
              }
              
              // Solo mostrar total si hay datos cargados
              const hasData = yearPeriods.some(p => (monthlyData[p] || []).length > 0) || (showAggregateBreakdown && finalTotalData.length > 0)

              return (
                <YearSection
                  key={year}
                  year={year}
                  periods={yearPeriods}
                  monthlyData={monthlyData}
                  loadingPeriods={loadingPeriods}
                  selectedCompany={companyLabelForUi}
                  onExpandPeriod={loadPeriodData}
                  totalData={finalTotalData.length > 0 && hasData ? finalTotalData : undefined}
                  isAllCompanies={showAggregateBreakdown}
                />
              )
            })
          })()}

          {/* Si no hay períodos, mostrar mensaje */}
          {periods.length === 0 && !isLoading && (
            <div className="text-center py-8 text-white/60">
              <p>No hay períodos disponibles para la selección de compañía(es).</p>
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  )
}

