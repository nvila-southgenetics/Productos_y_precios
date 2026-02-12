"use client"

import { useState, useEffect } from "react"
import { Upload, Download, Calculator } from "lucide-react"
import { Button } from "@/components/ui/button"
import { BudgetFilters } from "@/components/budget/BudgetFilters"
import { BudgetTable } from "@/components/budget/BudgetTable"
import { BudgetSummary } from "@/components/budget/BudgetSummary"
import { ImportBudgetDialog } from "@/components/budget/ImportBudgetDialog"
import { supabase } from "@/lib/supabase"

export default function BudgetPage() {
  const [selectedYear, setSelectedYear] = useState(2026)
  const [selectedCountry, setSelectedCountry] = useState<string>("all")
  const [selectedProduct, setSelectedProduct] = useState<string>("all")
  const [selectedMonth, setSelectedMonth] = useState<string>("all")
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [products, setProducts] = useState<string[]>([])

  useEffect(() => {
    fetchProducts()
  }, [selectedYear])

  const fetchProducts = async () => {
    try {
      const { data: budgetData } = await supabase
        .from("budget")
        .select("product_name")
        .eq("year", selectedYear)

      if (budgetData) {
        const uniqueProducts = [...new Set(budgetData.map((b) => b.product_name))].sort()
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
              Visualiza y analiza las proyecciones de ventas por producto, país y mes
            </p>
          </div>

          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="bg-white/10 border-white/20 text-white hover:bg-white/20"
              onClick={() => setShowImportDialog(true)}
            >
              <Upload className="w-4 h-4 mr-2" />
              Importar Excel
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="bg-white/10 border-white/20 text-white hover:bg-white/20"
              onClick={() => {
                // TODO: Implementar exportación
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
            selectedCountry={selectedCountry}
            selectedProduct={selectedProduct}
            selectedMonth={selectedMonth}
            onYearChange={setSelectedYear}
            onCountryChange={setSelectedCountry}
            onProductChange={setSelectedProduct}
            onMonthChange={setSelectedMonth}
            products={products}
          />
        </div>

        {/* Resumen financiero */}
        <div className="mb-6">
          <BudgetSummary
            year={selectedYear}
            country={selectedCountry}
            product={selectedProduct}
            month={selectedMonth}
          />
        </div>

        {/* Tabla de datos */}
        <BudgetTable
          year={selectedYear}
          country={selectedCountry}
          product={selectedProduct}
          month={selectedMonth}
        />

        {/* Dialog de importación */}
        <ImportBudgetDialog open={showImportDialog} onClose={() => setShowImportDialog(false)} />
      </div>
    </div>
  )
}

