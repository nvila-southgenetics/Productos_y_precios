"use client"

import { useState, useEffect, useMemo, useCallback, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ProductTable, type ProductDeleteScope } from "@/components/products/ProductTable"
import { ProductFilters } from "@/components/products/ProductFilters"
import { ProductMergeDialog } from "@/components/products/ProductMergeDialog"
import { ProductosTableSkeleton } from "@/components/products/ProductosTableSkeleton"
import { MultiCheckboxDropdown } from "@/components/filters/MultiCheckboxDropdown"
import {
  getCompanies,
  getProductsWithOverrides,
  deleteProductFromCountry,
  deleteProductFromAllCountries,
  getTotalSalesByProductIds,
  type ProductWithOverrides,
} from "@/lib/supabase-mcp"
import { usePermissions } from "@/lib/use-permissions"
import { supabase } from "@/lib/supabase"
import { productNameSortKey } from "@/lib/utils"
import { useProductCreateDialog } from "@/components/products/ProductCreateDialogProvider"
import { COUNTRY_CODES_LIST, filterCompaniesByCountries, getCountryForCompany } from "@/lib/auth-constants"
import {
  PRODUCT_CATEGORIES_SORTED,
  productMatchesCategoryFilter,
} from "@/lib/product-categories"
import { filterProductsWithCountriesActivity } from "@/lib/product-country-activity"
import { saveProductosListReturn } from "@/lib/productos-list-return"

const VALID_COUNTRIES = new Set(["UY", "AR", "MX", "CL", "VE", "CO"])

const COUNTRY_NAMES: Record<string, string> = {
  AR: "Argentina",
  CL: "Chile",
  CO: "Colombia",
  MX: "México",
  UY: "Uruguay",
  VE: "Venezuela",
}

function ProductosContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { allowedCountries, canEdit, isAdmin } = usePermissions()
  const canDeleteGlobally =
    isAdmin || allowedCountries.length >= COUNTRY_CODES_LIST.length
  const { openCreateProductDialog } = useProductCreateDialog()
  const [products, setProducts] = useState<ProductWithOverrides[]>([])
  const [filteredProducts, setFilteredProducts] = useState<ProductWithOverrides[]>([])
  const [companies, setCompanies] = useState<string[]>([])
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("")
  const [selectedTipo, setSelectedTipo] = useState("")
  const [reviewFilter, setReviewFilter] = useState<"all" | "reviewed" | "not_reviewed">("all")
  const [sortBy, setSortBy] = useState<"name" | "sales_desc">("name")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [salesCountByProductId, setSalesCountByProductId] = useState<Record<string, number>>({})
  const [budgetUnitsByProductId, setBudgetUnitsByProductId] = useState<Record<string, number>>({})
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false)
  const [productsToMerge, setProductsToMerge] = useState<ProductWithOverrides[]>([])
  const [isMerging, setIsMerging] = useState(false)

  const activeCountryCodes = useMemo(() => {
    const out = new Set<string>()
    for (const c of selectedCompanies) {
      const cc = getCountryForCompany(c)
      if (cc) out.add(cc)
    }
    return Array.from(out)
  }, [selectedCompanies])

  /** País efectivo para detalle, revisado y eliminar (derivado de compañías). */
  const selectedCountry = useMemo(() => {
    if (activeCountryCodes.length === 1) return activeCountryCodes[0]
    if (activeCountryCodes.includes("AR")) return "AR"
    return activeCountryCodes[0] ?? "AR"
  }, [activeCountryCodes])

  /** Catálogo completo: todas las compañías tildadas (una por una o todas). */
  const allCompaniesSelected = useMemo(() => {
    if (!companies.length || !selectedCompanies.length) return false
    const set = new Set(selectedCompanies)
    return companies.length === selectedCompanies.length && companies.every((c) => set.has(c))
  }, [companies, selectedCompanies])

  const marketLabel = useMemo(() => {
    if (!selectedCompanies.length) return ""
    if (selectedCompanies.length === 1) {
      const cc = getCountryForCompany(selectedCompanies[0])
      return cc ? COUNTRY_NAMES[cc] ?? cc : selectedCompanies[0]
    }
    if (activeCountryCodes.length === 1) {
      return COUNTRY_NAMES[activeCountryCodes[0]] ?? activeCountryCodes[0]
    }
    return `${activeCountryCodes.map((c) => COUNTRY_NAMES[c] ?? c).join(", ")}`
  }, [selectedCompanies, activeCountryCodes])

  // Restaurar filtros desde la URL
  useEffect(() => {
    const q = searchParams.get("q")
    const category = searchParams.get("category")
    const tipo = searchParams.get("tipo")
    const review = searchParams.get("review")
    const sort = searchParams.get("sort")
    if (q !== null) setSearchQuery(q)
    if (category !== null) setSelectedCategory(category)
    if (tipo !== null) setSelectedTipo(tipo)
    if (review === "reviewed" || review === "not_reviewed" || review === "all") {
      setReviewFilter(review)
    }
    if (sort === "sales_desc" || sort === "name") {
      setSortBy(sort)
    }
  }, [searchParams])

  // Cargar compañías (mismo origen que P&L/Real Import)
  useEffect(() => {
    async function loadCompanies() {
      try {
        const companiesData = await getCompanies()
        const filtered = filterCompaniesByCountries(companiesData, allowedCountries)
        setCompanies(filtered)
      } catch (e) {
        console.error("Error loading companies:", e)
        setCompanies([])
      }
    }
    if (allowedCountries.length) loadCompanies()
  }, [allowedCountries])

  const [filtersReady, setFiltersReady] = useState(false)

  // Restaurar compañías desde URL (también al volver atrás desde detalle)
  useEffect(() => {
    if (!companies.length) return

    const companiesParam = searchParams.get("companies")
    if (companiesParam) {
      const picked = companiesParam
        .split(",")
        .map((s) => s.trim())
        .filter((c) => companies.includes(c))
      if (picked.length) {
        setSelectedCompanies(picked)
        setFiltersReady(true)
        return
      }
    }
    const legacyCountry = searchParams.get("country")
    if (legacyCountry && VALID_COUNTRIES.has(legacyCountry)) {
      const matching = companies.filter((c) => getCountryForCompany(c) === legacyCountry)
      if (matching.length) {
        setSelectedCompanies(matching)
        setFiltersReady(true)
        return
      }
    }
    if (!companiesParam && !legacyCountry) {
      setSelectedCompanies(companies)
    }
    setFiltersReady(true)
  }, [searchParams, companies])

  const listReturnUrl = useMemo(() => {
    const params = new URLSearchParams()
    if (
      selectedCompanies.length > 0 &&
      companies.length > 0 &&
      selectedCompanies.length < companies.length
    ) {
      params.set("companies", selectedCompanies.join(","))
    }
    if (debouncedSearch) params.set("q", debouncedSearch)
    if (selectedCategory) params.set("category", selectedCategory)
    if (selectedTipo) params.set("tipo", selectedTipo)
    if (reviewFilter !== "all") params.set("review", reviewFilter)
    if (sortBy !== "name") params.set("sort", sortBy)
    const query = params.toString()
    return query ? `/productos?${query}` : "/productos"
  }, [
    selectedCompanies,
    companies.length,
    debouncedSearch,
    selectedCategory,
    selectedTipo,
    reviewFilter,
    sortBy,
  ])

  // Debounce búsqueda: evita router.replace y refiltrado en cada tecla.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 400)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Mantener la URL en sync
  useEffect(() => {
    if (!filtersReady || !companies.length) return

    const current =
      typeof window !== "undefined" ? window.location.pathname + (window.location.search || "") : ""
    if (current !== listReturnUrl) {
      router.replace(listReturnUrl, { scroll: false })
    }
    saveProductosListReturn(listReturnUrl)
  }, [filtersReady, companies.length, listReturnUrl, router])

  const categories = PRODUCT_CATEGORIES_SORTED

  const tipos = useMemo(() => {
    const tps = new Set<string>()
    products.forEach((p) => {
      if (p.tipo) tps.add(p.tipo)
    })
    return Array.from(tps).sort()
  }, [products])

  const reloadProducts = useCallback(async () => {
    if (!filtersReady) return

    if (!activeCountryCodes.length || !selectedCompanies.length) {
      setProducts([])
      setSalesCountByProductId({})
      setBudgetUnitsByProductId({})
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)
    try {
      const dataAll = await getProductsWithOverrides()
      const productIds = dataAll.map((p) => p.id)
      const MONTH_KEYS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"] as const

      const salesEntries = await Promise.all(
        activeCountryCodes.map(async (cc) => {
          const companiesForCountry = selectedCompanies.filter((c) => getCountryForCompany(c) === cc)
          const counts = await getTotalSalesByProductIds(productIds, {
            companies: companiesForCountry,
          })
          return [cc, counts] as const
        })
      )
      const salesByCountry: Record<string, Record<string, number>> = Object.fromEntries(salesEntries)

      const displaySales: Record<string, number> = {}
      for (const id of productIds) {
        displaySales[id] = activeCountryCodes.reduce(
          (sum, cc) => sum + (salesByCountry[cc]?.[id] ?? 0),
          0
        )
      }
      setSalesCountByProductId(displaySales)

      const nameToId = new Map(dataAll.map((p) => [p.name, p.id]))
      const budgetByCountry: Record<string, Record<string, number>> = {}
      for (const cc of activeCountryCodes) {
        budgetByCountry[cc] = {}
        for (const id of productIds) budgetByCountry[cc][id] = 0
      }

      const productNames = dataAll.map((p) => p.name)
      if (productNames.length > 0) {
        const { data: budgetData, error: budgetError } = await supabase
          .from("budget")
          .select(["product_id", "product_name", "country_code", ...MONTH_KEYS].join(","))
          .eq("year", 2026)
          .eq("budget_name", "budget")
          .in("country_code", activeCountryCodes)
          .in("product_name", productNames)

        if (!budgetError && Array.isArray(budgetData)) {
          for (const r of budgetData as {
            product_id?: string
            product_name?: string
            country_code?: string
            [k: string]: unknown
          }[]) {
            const cc = r.country_code
            if (!cc || !budgetByCountry[cc]) continue
            const id = r.product_id || nameToId.get(String(r.product_name ?? ""))
            if (!id) continue
            const units = MONTH_KEYS.reduce((sum, k) => sum + Number(r[k] ?? 0), 0)
            budgetByCountry[cc][id] = (budgetByCountry[cc][id] ?? 0) + units
          }
        } else if (budgetError) {
          console.error("Error fetching budget units:", budgetError)
        }
      }

      const displayBudget: Record<string, number> = {}
      for (const id of productIds) {
        displayBudget[id] = activeCountryCodes.reduce(
          (sum, cc) => sum + (budgetByCountry[cc]?.[id] ?? 0),
          0
        )
      }
      setBudgetUnitsByProductId(displayBudget)

      const list = allCompaniesSelected
        ? dataAll
        : filterProductsWithCountriesActivity(
            dataAll,
            activeCountryCodes,
            salesByCountry,
            budgetByCountry
          )
      const sortedData = list.sort((a, b) =>
        productNameSortKey(a.name).localeCompare(productNameSortKey(b.name), "es", { sensitivity: "base" })
      )
      setProducts(sortedData)
      if (sortedData.length === 0) {
        setError(
          dataAll.length === 0
            ? "No se encontraron productos. Verifica la conexión con la base de datos."
            : `No hay productos con ventas, budget o precios cargados para ${marketLabel || "el mercado seleccionado"}.`
        )
      }
    } catch (error) {
      console.error("Error loading products:", error)
      setError(error instanceof Error ? error.message : "Error al cargar los productos")
    } finally {
      setIsLoading(false)
    }
  }, [activeCountryCodes, selectedCompanies, marketLabel, allCompaniesSelected, companies.length, filtersReady])

  useEffect(() => {
    if (!filtersReady) return
    reloadProducts()
  }, [reloadProducts, filtersReady])

  const showTableLoading = !filtersReady || isLoading || companies.length === 0

  // Filtrar y ordenar productos
  useEffect(() => {
    let filtered = [...products]

    if (debouncedSearch) {
      const query = debouncedSearch.toLowerCase()
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          (p.alias || "").toLowerCase().includes(query) ||
          (p.description && p.description.toLowerCase().includes(query))
      )
    }

    if (selectedCategory) {
      filtered = filtered.filter((p) =>
        productMatchesCategoryFilter(p.category, new Set([selectedCategory]))
      )
    }

    if (selectedTipo) {
      filtered = filtered.filter((p) => p.tipo === selectedTipo)
    }

    if (reviewFilter !== "all") {
      filtered = filtered.filter((p) => {
        const override = p.country_overrides?.find((o) => o.country_code === selectedCountry)
        const reviewed = override?.overrides?.reviewed || false
        return reviewFilter === "reviewed" ? reviewed : !reviewed
      })
    }

    if (sortBy === "sales_desc") {
      filtered.sort((a, b) => {
        const sa = salesCountByProductId[a.id] ?? 0
        const sb = salesCountByProductId[b.id] ?? 0
        if (sb !== sa) return sb - sa
        return productNameSortKey(a.name).localeCompare(productNameSortKey(b.name), "es", { sensitivity: "base" })
      })
    } else {
      filtered.sort((a, b) =>
        productNameSortKey(a.name).localeCompare(productNameSortKey(b.name), "es", { sensitivity: "base" })
      )
    }

    setFilteredProducts(filtered)
  }, [products, debouncedSearch, selectedCategory, selectedTipo, reviewFilter, sortBy, selectedCountry, salesCountByProductId])

  const handleDeleteProduct = async (product: ProductWithOverrides, scope: ProductDeleteScope) => {
    try {
      if (scope === "all-countries") {
        await deleteProductFromAllCountries(product.id)
      } else if (scope === "current-country") {
        await deleteProductFromCountry(product.id, selectedCountry)
      } else {
        for (const countryCode of scope.countryCodes) {
          await deleteProductFromCountry(product.id, countryCode)
        }
      }

      await reloadProducts()
    } catch (error) {
      console.error("Error deleting product:", error)
      alert(`Error al eliminar el producto: ${error instanceof Error ? error.message : "Error desconocido"}`)
      throw error
    }
  }

  const handleReviewToggle = async (productId: string, countryCode: string, checked: boolean) => {
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id !== productId) return p
        return {
          ...p,
          country_overrides: (p.country_overrides || []).map((o) =>
            o.country_code === countryCode
              ? { ...o, overrides: { ...o.overrides, reviewed: checked } }
              : o
          ),
        }
      })
    )
  }

  const handleRequestMerge = (productsToMergeInput: ProductWithOverrides[]) => {
    if (productsToMergeInput.length < 2) return
    setProductsToMerge(productsToMergeInput)
    setMergeDialogOpen(true)
  }

  const handleConfirmMergePreview = async (
    mergedFrom: ProductWithOverrides[],
    chosenFields: {
      name: string
      category?: string | null
      tipo?: string | null
      aliasFromProductId?: string
      basePriceFromProductId?: string
      costBaseProductId?: string
    }
  ) => {
    if (isMerging) return
    setIsMerging(true)
    try {
      const response = await fetch("/api/products/merge", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productIds: mergedFrom.map((p) => p.id),
          name: chosenFields.name,
          category: chosenFields.category,
          tipo: chosenFields.tipo,
          aliasFromProductId: chosenFields.aliasFromProductId,
          basePriceFromProductId: chosenFields.basePriceFromProductId,
          costBaseProductId: chosenFields.costBaseProductId,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const message = errorData?.error || "No se pudo fusionar los productos."
        alert(message)
        return
      }

      const result = await response.json()
      const { newProductId, mergedProduct, stats } = result

      const resumenLineas: string[] = []
      if (mergedProduct?.name) {
        resumenLineas.push(`Nuevo producto: ${mergedProduct.name}`)
      }
      if (stats) {
        if (typeof stats.ventasReasignadas === "number") {
          resumenLineas.push(`Ventas reasignadas: ${stats.ventasReasignadas}`)
        }
        if (typeof stats.budgetsReasignados === "number") {
          resumenLineas.push(`Budgets reasignados: ${stats.budgetsReasignados}`)
        }
      }
      if (resumenLineas.length) {
        alert(resumenLineas.join("\n"))
      }

      await reloadProducts()

      if (newProductId) {
        router.push(
          `/productos/${newProductId}?country=${selectedCountry}&returnTo=${encodeURIComponent(listReturnUrl)}`
        )
      }
    } catch (error) {
      console.error("Error al fusionar productos:", error)
      alert("Ocurrió un error inesperado al fusionar los productos.")
    } finally {
      setIsMerging(false)
    }
  }

  const handleOpenCreateDialog = () => {
    if (!canEdit) return
    openCreateProductDialog({
      defaultName: "",
      onCreated: async (product) => {
        router.push(
          `/productos/${product.id}?country=${selectedCountry}&returnTo=${encodeURIComponent(listReturnUrl)}`
        )
      },
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-r from-blue-900 via-blue-950 to-slate-900">
      <div className="container mx-auto py-8 px-4 max-w-7xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Productos</h1>
            <p className="text-white/80 mt-1">
              Tildá cada compañía que quieras ver. Con todas tildadas se listan todos los productos; con una o varias, solo los activos en ese mercado.
              {marketLabel ? (
                <span className="block text-white/60 text-sm mt-1">
                  Mostrando: <span className="text-white/90 font-medium">{marketLabel}</span>
                  {selectedCompanies.length === 1 ? ` · ${selectedCompanies[0]}` : null}
                </span>
              ) : null}
            </p>
          </div>
          <Button
            className="bg-white/10 hover:bg-white/20 border border-white/20 text-white backdrop-blur-sm"
            onClick={handleOpenCreateDialog}
          >
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Producto
          </Button>
        </div>

        <div className="mb-6 rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 p-4 shadow-sm">
          <label className="text-sm font-semibold mb-3 block text-white/90">Compañía</label>
          <MultiCheckboxDropdown
            label="Compañía"
            hideLabel
            allLabel="Todas las compañías"
            pendingLabel="Cargando compañías…"
            options={companies.map((c) => ({ value: c, label: c }))}
            selectedValues={selectedCompanies.length ? selectedCompanies : companies}
            onSelectedValuesChange={setSelectedCompanies}
            className="w-full md:w-[520px]"
          />
        </div>

        <div className="mb-6 rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 p-4 shadow-sm">
          <ProductFilters
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
            selectedTipo={selectedTipo}
            onTipoChange={setSelectedTipo}
            categories={categories}
            tipos={tipos}
            reviewFilter={reviewFilter}
            onReviewFilterChange={(v) => setReviewFilter(v as "all" | "reviewed" | "not_reviewed")}
            sortBy={sortBy}
            onSortByChange={(v) => setSortBy(v as "name" | "sales_desc")}
          />
        </div>

        {showTableLoading ? (
          <ProductosTableSkeleton showReviewColumn={canEdit} />
        ) : error ? (
          <div className="rounded-lg border border-red-400/30 bg-red-500/10 backdrop-blur-sm p-4">
            <p className="text-red-200 font-medium">Error al cargar productos</p>
            <p className="text-red-300 text-sm mt-1">{error}</p>
          </div>
        ) : (
          <div className="transition-opacity duration-300 ease-out">
          <ProductTable
            products={filteredProducts}
            selectedCountry={selectedCountry}
            listReturnUrl={listReturnUrl}
            salesCountByProductId={salesCountByProductId}
            budgetUnitsByProductId={budgetUnitsByProductId}
            onViewProduct={() => {}}
            onEditProduct={() => {}}
            onDeleteProduct={handleDeleteProduct}
            onReviewToggle={handleReviewToggle}
            canEdit={canEdit}
            allowedCountries={allowedCountries}
            canDeleteGlobally={canDeleteGlobally}
            onRequestMerge={handleRequestMerge}
          />
          </div>
        )}

        <ProductMergeDialog
          open={mergeDialogOpen}
          onOpenChange={setMergeDialogOpen}
          products={productsToMerge}
          onConfirm={handleConfirmMergePreview}
        />
      </div>
    </div>
  )
}

export default function ProductosPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-r from-blue-900 via-blue-950 to-slate-900">
          <div className="container mx-auto py-8 px-4 max-w-7xl">
            <div className="h-9 w-48 rounded-md bg-white/10 animate-pulse mb-6" />
            <div className="mb-6 rounded-lg bg-white/10 border border-white/20 p-4">
              <div className="h-10 w-full max-w-[520px] rounded-md bg-white/10 animate-pulse" />
            </div>
            <ProductosTableSkeleton />
          </div>
        </div>
      }
    >
      <ProductosContent />
    </Suspense>
  )
}
