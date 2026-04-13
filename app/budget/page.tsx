"use client"

import { useState, useEffect } from "react"
import { Upload, Download, Calculator } from "lucide-react"
import { Button } from "@/components/ui/button"
import { BudgetFilters } from "@/components/budget/BudgetFilters"
import { BudgetTable } from "@/components/budget/BudgetTable"
import { BudgetSummary } from "@/components/budget/BudgetSummary"
import { ImportBudgetDialog } from "@/components/budget/ImportBudgetDialog"
import { supabase } from "@/lib/supabase"
import { usePermissions } from "@/lib/use-permissions"
import { productNameSortKey } from "@/lib/utils"
import { monthsFromRange } from "@/components/filters/MonthRangeFilter"

export default function BudgetPage() {
  const { allowedCountries, canEdit, isAdmin, loading: permLoading } = usePermissions()
  const [selectedYear, setSelectedYear] = useState(2026)
  const [selectedBudgetName, setSelectedBudgetName] = useState<string>("budget")
  const [budgetNames, setBudgetNames] = useState<string[]>(["budget"])
  const [selectedCountries, setSelectedCountries] = useState<string[]>([])
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  const [monthFrom, setMonthFrom] = useState<number>(1)
  const [monthTo, setMonthTo] = useState<number>(12)
  const selectedMonths = monthsFromRange({ fromMonth: monthFrom, toMonth: monthTo })
  const [selectedChannels, setSelectedChannels] = useState<string[]>([])
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [products, setProducts] = useState<string[]>([])

  const allChannelValues = ["Paciente", "Pacientes desc", "Aseguradoras", "Instituciones SFL", "Gobierno", "Distribuidores"]

  // No-admins: un solo país → seleccionarlo; varios → "Todos (mis países)"
  useEffect(() => {
    if (!permLoading && !isAdmin && allowedCountries.length > 0) {
      setSelectedCountries(allowedCountries.length === 1 ? [allowedCountries[0]] : [...allowedCountries])
    }
  }, [permLoading, isAdmin, allowedCountries])

  // Admins: por defecto, seleccionar todos los países.
  useEffect(() => {
    if (!permLoading && isAdmin) {
      // Las mismas opciones que usa BudgetFilters; mantenemos consistencia.
      setSelectedCountries(["AR", "CL", "CO", "MX", "UY", "VE", "PE", "BO", "TT", "BS", "BB", "BM", "KY"])
    }
  }, [permLoading, isAdmin])

  // Por defecto, seleccionar todos los canales.
  useEffect(() => {
    setSelectedChannels(allChannelValues)
  }, [])

  useEffect(() => {
    fetchBudgetNames()
    fetchProducts()
  }, [selectedYear, selectedBudgetName])

  const fetchBudgetNames = async () => {
    try {
      const { data } = await supabase.from("budget").select("budget_name").eq("year", selectedYear)
      const rows = (data ?? []) as any[]
      const names: string[] = [...new Set(
        rows
          .map((r) => String(r?.budget_name || "").trim())
          .filter((x) => Boolean(x))
      )].sort()
      const finalNames: string[] = names.length ? names : ["budget"]
      setBudgetNames(finalNames)
      setSelectedBudgetName((prev) => (finalNames.includes(prev) ? prev : finalNames[0]))
    } catch (error) {
      console.error("Error fetching budget names:", error)
      setBudgetNames(["budget"])
      setSelectedBudgetName("budget")
    }
  }

  const fetchProducts = async () => {
    try {
      const { data: budgetData } = await supabase
        .from("budget")
        .select("product_name")
        .eq("year", selectedYear)
        .eq("budget_name", selectedBudgetName)

      if (budgetData) {
        const uniqueProducts = ([...new Set(budgetData.map((b: { product_name: string }) => b.product_name))] as string[]).sort((a, b) => productNameSortKey(a).localeCompare(productNameSortKey(b), 'es', { sensitivity: 'base' }))
        setProducts(uniqueProducts)
      }
    } catch (error) {
      console.error("Error fetching products:", error)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-r from-blue-900 via-blue-950 to-slate-900">
      <div className="container mx-auto py-8 px-4 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white">Budget - Proyección de Ventas</h1>
            <p className="text-white/80 mt-1">
              Visualiza y analiza las proyecciones de ventas por producto, compañía y mes
            </p>
          </div>

          <div className="flex gap-2">
            {canEdit && (
              <Button 
                variant="outline" 
                size="sm" 
                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                onClick={() => setShowImportDialog(true)}
              >
                <Upload className="w-4 h-4 mr-2" />
                Importar Excel
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              className="bg-white/10 border-white/20 text-white hover:bg-white/20"
              onClick={() => {
                alert("Exportar - Funcionalidad próximamente")
              }}
            >
              <Download className="w-4 h-4 mr-2" />
              Exportar
            </Button>
          </div>
        </div>

        {/* Filtros */}
        <div className="mb-6 rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 p-4 shadow-sm">
          <BudgetFilters
            selectedYear={selectedYear}
            selectedBudgetName={selectedBudgetName}
            budgetNames={budgetNames}
            selectedCountries={selectedCountries}
            selectedProducts={selectedProducts}
            monthFrom={monthFrom}
            monthTo={monthTo}
            selectedChannels={selectedChannels}
            onYearChange={setSelectedYear}
            onBudgetNameChange={setSelectedBudgetName}
            onCountriesChange={setSelectedCountries}
            onProductsChange={setSelectedProducts}
            onMonthRangeChange={({ fromMonth, toMonth }) => {
              setMonthFrom(fromMonth)
              setMonthTo(toMonth)
            }}
            onChannelsChange={setSelectedChannels}
            products={products}
            allowedCountries={allowedCountries}
            showAllCountries={isAdmin}
          />
        </div>

        {/* Resumen financiero */}
        <div className="mb-6">
          <BudgetSummary
            year={selectedYear}
          budgetName={selectedBudgetName}
            countries={selectedCountries}
            products={selectedProducts}
            months={selectedMonths}
            channels={selectedChannels}
          />
        </div>

        {/* Tabla de datos */}
        <BudgetTable
          year={selectedYear}
          budgetName={selectedBudgetName}
            countries={selectedCountries}
          products={selectedProducts}
            months={selectedMonths}
            channels={selectedChannels}
          canEdit={canEdit}
        />

        {/* Dialog de importación */}
        <ImportBudgetDialog open={showImportDialog} onClose={() => setShowImportDialog(false)} budgetName={selectedBudgetName} />
      </div>
    </div>
  )
}

