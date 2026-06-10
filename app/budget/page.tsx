"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { Upload, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { BudgetFilters } from "@/components/budget/BudgetFilters"
import { BudgetTable } from "@/components/budget/BudgetTable"
import { BudgetSummary } from "@/components/budget/BudgetSummary"
import { ImportBudgetDialog } from "@/components/budget/ImportBudgetDialog"
import { supabase } from "@/lib/supabase"
import { usePermissions } from "@/lib/use-permissions"
import { productNameSortKey } from "@/lib/utils"
import { monthsFromRange } from "@/components/filters/MonthRangeFilter"
import {
  fetchBudgetBundle,
  type BudgetRow,
  type BudgetSummaryData,
} from "@/lib/budget-data"
import {
  buildCategoryByNameMap,
  filterProductNamesByBusinessGroup,
  resolveEffectiveProductNames,
  type ProductBusinessGroup,
} from "@/lib/product-categories"
import { fetchPlProductCatalog } from "@/lib/pl-product-catalog"

export default function BudgetPage() {
  const { allowedCountries, canEdit, isAdmin, loading: permLoading } = usePermissions()
  const [selectedYear, setSelectedYear] = useState(2026)
  const [selectedBudgetName, setSelectedBudgetName] = useState<string>("budget")
  const [budgetNames, setBudgetNames] = useState<string[]>(["budget"])
  const [selectedCountries, setSelectedCountries] = useState<string[]>([])
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  const [businessGroup, setBusinessGroup] = useState<ProductBusinessGroup>("all")
  const [categoryByName, setCategoryByName] = useState<Record<string, string>>({})
  const [monthFrom, setMonthFrom] = useState<number>(1)
  const [monthTo, setMonthTo] = useState<number>(12)
  const [selectedChannels, setSelectedChannels] = useState<string[]>([])
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [products, setProducts] = useState<string[]>([])
  const selectedMonths = useMemo(
    () => monthsFromRange({ fromMonth: monthFrom, toMonth: monthTo }),
    [monthFrom, monthTo]
  )
  const monthsKey = selectedMonths.join(",")
  const countriesKey = selectedCountries.join(",")
  const productsInGroup = useMemo(
    () => filterProductNamesByBusinessGroup(products, categoryByName, businessGroup),
    [products, categoryByName, businessGroup]
  )

  const effectiveProducts = useMemo(
    () =>
      resolveEffectiveProductNames(products, selectedProducts, categoryByName, businessGroup) ?? [],
    [products, selectedProducts, categoryByName, businessGroup]
  )

  const productsKey = effectiveProducts.join(",")
  const channelsKey = selectedChannels.join(",")

  const [tableRows, setTableRows] = useState<BudgetRow[]>([])
  const [summary, setSummary] = useState<BudgetSummaryData>({
    totalUnits: 0,
    totalGrossSale: 0,
    totalGrossProfit: 0,
    avgGrossMargin: 0,
  })
  const [aliasByName, setAliasByName] = useState<Record<string, string>>({})
  const [budgetLoading, setBudgetLoading] = useState(true)
  const fetchRequestId = useRef(0)
  const countriesInitialized = useRef(false)

  const allChannelValues = ["Paciente", "Pacientes desc", "Aseguradoras", "Instituciones SFL", "Gobierno", "Distribuidores"]

  useEffect(() => {
    if (permLoading || countriesInitialized.current) return
    countriesInitialized.current = true
    if (isAdmin) {
      setSelectedCountries(["AR", "CL", "CO", "MX", "UY", "VE", "PE", "BO", "TT", "BS", "BB", "BM", "KY"])
    } else if (allowedCountries.length > 0) {
      setSelectedCountries(
        allowedCountries.length === 1 ? [allowedCountries[0]] : [...allowedCountries]
      )
    }
  }, [permLoading, isAdmin, allowedCountries])

  useEffect(() => {
    setSelectedChannels(allChannelValues)
  }, [])

  useEffect(() => {
    async function loadInitial() {
      try {
        const catalog = await fetchPlProductCatalog()
        setCategoryByName(buildCategoryByNameMap(catalog))
      } catch (error) {
        console.error("Error loading product categories:", error)
      }
      await Promise.all([fetchBudgetNames(), fetchProducts()])
    }
    void loadInitial()
  }, [selectedYear, selectedBudgetName])

  useEffect(() => {
    setSelectedProducts((prev) => {
      const pruned = prev.filter((p) => productsInGroup.includes(p))
      return pruned.length === prev.length ? prev : pruned
    })
  }, [productsInGroup])

  const fetchBudgetNames = async () => {
    try {
      const { data } = await supabase.from("budget").select("budget_name").eq("year", selectedYear)
      const rows = (data ?? []) as { budget_name?: string }[]
      const names: string[] = [...new Set(
        rows.map((r) => String(r?.budget_name || "").trim()).filter(Boolean)
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
        const uniqueProducts = ([...new Set(budgetData.map((b: { product_name: string }) => b.product_name))] as string[]).sort((a, b) =>
          productNameSortKey(a).localeCompare(productNameSortKey(b), "es", { sensitivity: "base" })
        )
        setProducts(uniqueProducts)
      }
    } catch (error) {
      console.error("Error fetching products:", error)
    }
  }

  const reloadBudgetData = useCallback(async () => {
    const requestId = ++fetchRequestId.current
    setBudgetLoading(true)
    try {
      const bundle = await fetchBudgetBundle({
        year: selectedYear,
        budgetName: selectedBudgetName,
        countries: selectedCountries,
        products: effectiveProducts,
        months: selectedMonths,
        channels: selectedChannels,
      })
      if (requestId !== fetchRequestId.current) return
      setTableRows(bundle.tableRows)
      setSummary(bundle.summary)
      setAliasByName(bundle.aliasByName)
    } catch (error) {
      if (requestId !== fetchRequestId.current) return
      console.error("Error fetching budget bundle:", error)
      setTableRows([])
      setSummary({ totalUnits: 0, totalGrossSale: 0, totalGrossProfit: 0, avgGrossMargin: 0 })
      setAliasByName({})
    } finally {
      if (requestId === fetchRequestId.current) setBudgetLoading(false)
    }
  }, [
    selectedYear,
    selectedBudgetName,
    countriesKey,
    productsKey,
    monthsKey,
    channelsKey,
  ])

  useEffect(() => {
    if (permLoading || !countriesInitialized.current) return
    reloadBudgetData()
  }, [reloadBudgetData, permLoading])

  return (
    <div className="min-h-screen bg-gradient-to-r from-blue-900 via-blue-950 to-slate-900">
      <div className="container mx-auto py-8 px-4 max-w-7xl">
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
            businessGroup={businessGroup}
            onBusinessGroupChange={setBusinessGroup}
            onYearChange={setSelectedYear}
            onBudgetNameChange={setSelectedBudgetName}
            onCountriesChange={setSelectedCountries}
            onProductsChange={setSelectedProducts}
            onMonthRangeChange={({ fromMonth, toMonth }) => {
              setMonthFrom(fromMonth)
              setMonthTo(toMonth)
            }}
            onChannelsChange={setSelectedChannels}
            products={productsInGroup}
            allowedCountries={allowedCountries}
            showAllCountries={isAdmin}
          />
        </div>

        <div className="mb-6">
          <BudgetSummary summary={summary} loading={budgetLoading} year={selectedYear} months={selectedMonths} />
        </div>

        <BudgetTable
          data={tableRows}
          aliasByName={aliasByName}
          loading={budgetLoading}
          year={selectedYear}
          months={selectedMonths}
          canEdit={canEdit}
          onProductLinked={reloadBudgetData}
        />

        <ImportBudgetDialog open={showImportDialog} onClose={() => setShowImportDialog(false)} budgetName={selectedBudgetName} />
      </div>
    </div>
  )
}
