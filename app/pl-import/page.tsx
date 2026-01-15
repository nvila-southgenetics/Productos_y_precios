"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { BarChart3, Package } from "lucide-react"
import { CompanyFilter } from "@/components/pl-import/CompanyFilter"
import { ProductFilter } from "@/components/pl-import/ProductFilter"
import { MonthDropdown } from "@/components/pl-import/MonthDropdown"
import { ProductSalesTable } from "@/components/pl-import/ProductSalesTable"
import {
  getCompanies,
  getProductsFromSales,
  getAvailablePeriods,
  getMonthlySales,
  getAnnualTotal,
  type MonthlySalesWithProduct,
} from "@/lib/supabase-mcp"

export default function PLImportPage() {
  const [companies, setCompanies] = useState<string[]>([])
  const [products, setProducts] = useState<string[]>([])
  const [selectedCompany, setSelectedCompany] = useState("SouthGenetics LLC Argentina")
  const [selectedProduct, setSelectedProduct] = useState("Todos")
  const [periods, setPeriods] = useState<string[]>([])
  const [monthlyData, setMonthlyData] = useState<Record<string, MonthlySalesWithProduct[]>>({})
  const [totalData, setTotalData] = useState<MonthlySalesWithProduct[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadingPeriods, setLoadingPeriods] = useState<Set<string>>(new Set())
  const loadingRef = useRef<Set<string>>(new Set()) // Ref para rastrear períodos en carga

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
        if (companiesData.length > 0) {
          setSelectedCompany(companiesData[0])
        }
      } catch (error) {
        console.error("Error loading initial data:", error)
      } finally {
        setIsLoading(false)
      }
    }
    loadInitialData()
  }, [])

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
        setPeriods(periodsData)
      } catch (error) {
        console.error("Error loading periods:", error)
      }
    }
    loadPeriods()
  }, [selectedCompany])

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

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <BarChart3 className="h-5 w-5" />
          <h1 className="text-xl font-bold">Filtros de Visualización</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Selecciona una compañía para filtrar las ventas
        </p>
      </div>

      {/* Filtros */}
      <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
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
      </div>

      {/* Sección Principal */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <Package className="h-4 w-4" />
          <h2 className="text-lg font-semibold">Detalle de Productos Vendidos</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-3">
          Lista de productos vendidos con sus cantidades totales
        </p>

        {/* Dropdowns por Mes */}
        <div className="space-y-2">
          {periods.map((periodo) => {
            const sales = monthlyData[periodo] || []
            const isLoading = loadingPeriods.has(periodo)

            return (
              <MonthDropdown
                key={periodo}
                periodo={periodo}
                sales={sales}
                isTotal={false}
                onExpand={loadPeriodData}
                isLoading={isLoading}
                selectedCompany={selectedCompany}
              />
            )
          })}

          {/* Dropdown Total */}
          {totalData.length > 0 && (
            <MonthDropdown 
              periodo="Total" 
              sales={totalData} 
              isTotal={true}
              selectedCompany={selectedCompany}
            />
          )}
        </div>
      </div>
    </div>
  )
}

