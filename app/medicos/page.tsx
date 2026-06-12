"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { MedicosFilters } from "@/components/medicos/MedicosFilters"
import { MedicosMatrixTable } from "@/components/medicos/MedicosMatrixTable"
import type { DateRangePreset } from "@/components/filters/DateRangeFilter"
import { usePermissions } from "@/lib/use-permissions"
import { filterCompaniesByCountries } from "@/lib/auth-constants"
import {
  buildCategoryByNameMap,
  filterProductNamesByBusinessGroup,
  PRODUCT_CATEGORIES_SORTED,
  resolveEffectiveCategories,
  resolveEffectiveProductNames,
  type ProductBusinessGroup,
} from "@/lib/product-categories"
import { fetchPlProductCatalog } from "@/lib/pl-product-catalog"
import {
  GENERAL_LLC_COMPANY,
  getCompanies,
  getLlcCountriesFromVentas,
  getMedicoInstitucionSales,
  getMedicosFromVentas,
  getProductsFromSales,
  getVentasFechaBounds,
  type MedicoInstitucionSaleRow,
} from "@/lib/supabase-mcp"

function buildDatePresets(min: string, max: string): DateRangePreset[] {
  const minYear = Number(min.slice(0, 4))
  const maxYear = Number(max.slice(0, 4))
  const years: DateRangePreset[] = []
  for (let y = maxYear; y >= minYear; y--) {
    const desde = `${y}-01-01`
    const hasta = `${y}-12-31`
    years.push({
      id: String(y),
      label: String(y),
      fechaDesde: desde < min ? min : desde,
      fechaHasta: hasta > max ? max : hasta,
    })
  }
  return [
    { id: "all", label: "Todo el histórico", fechaDesde: min, fechaHasta: max },
    ...years,
  ]
}

export default function MedicosPage() {
  const { allowedCountries, isAdmin, loading: permLoading } = usePermissions()
  const [companies, setCompanies] = useState<string[]>([])
  const [llcCountries, setLlcCountries] = useState<string[]>([])
  const [products, setProducts] = useState<string[]>([])
  const [medicos, setMedicos] = useState<string[]>([])
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([])
  const [selectedLlcCountries, setSelectedLlcCountries] = useState<string[]>([])
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  const [selectedMedicos, setSelectedMedicos] = useState<string[]>([])
  const [selectedCategories, setSelectedCategories] = useState<string[]>(PRODUCT_CATEGORIES_SORTED)
  const [businessGroup, setBusinessGroup] = useState<ProductBusinessGroup>("all")
  const [categoryByName, setCategoryByName] = useState<Record<string, string>>({})
  const [fechaBounds, setFechaBounds] = useState<{ min: string; max: string } | null>(null)
  const [fechaDesde, setFechaDesde] = useState("")
  const [fechaHasta, setFechaHasta] = useState("")
  const [rows, setRows] = useState<MedicoInstitucionSaleRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [compareMode, setCompareMode] = useState(false)
  const matrixFetchId = useRef(0)
  const medicosFetchId = useRef(0)
  const llcCountriesFetchId = useRef(0)
  const hasLoadedMatrixOnce = useRef(false)

  const datePresets = useMemo(
    () => (fechaBounds ? buildDatePresets(fechaBounds.min, fechaBounds.max) : []),
    [fechaBounds]
  )

  const dateRangeReady = Boolean(fechaDesde && fechaHasta)

  const companiesForQuery = useMemo(() => {
    if (!companies.length) return []
    const sel = selectedCompanies.length ? selectedCompanies : companies
    const allPicked =
      sel.length === companies.length && companies.every((c) => sel.includes(c))
    if (isAdmin && allPicked) return companies
    return sel
  }, [companies, selectedCompanies, isAdmin])

  const llcSelected = useMemo(
    () => companiesForQuery.includes(GENERAL_LLC_COMPANY),
    [companiesForQuery]
  )

  const llcCountriesForQuery = useMemo(() => {
    if (!llcSelected || !llcCountries.length) return undefined
    const sel = selectedLlcCountries.length ? selectedLlcCountries : llcCountries
    const allPicked =
      sel.length === llcCountries.length &&
      llcCountries.every((country) => sel.includes(country))
    return allPicked ? undefined : sel
  }, [llcSelected, llcCountries, selectedLlcCountries])

  const productsInGroup = useMemo(
    () => filterProductNamesByBusinessGroup(products, categoryByName, businessGroup),
    [products, categoryByName, businessGroup]
  )

  const effectiveCategories = useMemo(
    () => resolveEffectiveCategories(selectedCategories, businessGroup, PRODUCT_CATEGORIES_SORTED),
    [selectedCategories, businessGroup]
  )

  const effectiveProducts = useMemo(
    () => resolveEffectiveProductNames(products, selectedProducts, categoryByName, businessGroup),
    [products, selectedProducts, categoryByName, businessGroup]
  )

  useEffect(() => {
    setSelectedProducts((prev) => {
      const pruned = prev.filter((p) => productsInGroup.includes(p))
      return pruned.length === prev.length ? prev : pruned
    })
  }, [productsInGroup])

  const companiesQueryKey = useMemo(
    () => [...companiesForQuery].sort().join("|"),
    [companiesForQuery]
  )

  const llcCountriesQueryKey = useMemo(
    () =>
      llcCountriesForQuery?.length
        ? [...llcCountriesForQuery].sort().join("|")
        : "__all__",
    [llcCountriesForQuery]
  )

  const productsQueryKey = useMemo(() => {
    if (effectiveProducts === undefined) return "__all__"
    if (effectiveProducts.length === 0) return "__none__"
    return [...effectiveProducts].sort().join("|")
  }, [effectiveProducts])

  const categoriesQueryKey = useMemo(() => {
    if (effectiveCategories === undefined) return "__all__"
    if (effectiveCategories.length === 0) return "__none__"
    return [...effectiveCategories].sort().join("|")
  }, [effectiveCategories])

  const medicosQueryKey = useMemo(
    () => (selectedMedicos.length ? [...selectedMedicos].sort().join("|") : "__all__"),
    [selectedMedicos]
  )

  const salesQueryParams = useMemo(
    () => ({
      fechaDesde,
      fechaHasta,
      companies: companiesForQuery,
      llcCountries: llcCountriesForQuery,
    }),
    [fechaDesde, fechaHasta, companiesQueryKey, llcCountriesQueryKey, companiesForQuery, llcCountriesForQuery]
  )

  const hasLlcCompanyInList = companies.includes(GENERAL_LLC_COMPANY)
  const llcDiscoveryKey = `${fechaDesde}|${fechaHasta}|${hasLlcCompanyInList}`

  useEffect(() => {
    async function loadBounds() {
      try {
        const bounds = await getVentasFechaBounds()
        setFechaBounds(bounds)
        setFechaDesde(bounds.min)
        setFechaHasta(bounds.max)
      } catch (e) {
        console.error("Error loading ventas date bounds:", e)
        const fallback = { min: "2025-01-01", max: new Date().toISOString().slice(0, 10) }
        setFechaBounds(fallback)
        setFechaDesde(fallback.min)
        setFechaHasta(fallback.max)
      }
    }
    if (!permLoading) loadBounds()
  }, [permLoading])

  useEffect(() => {
    async function loadInitial() {
      try {
        const [companiesData, productsData, catalog] = await Promise.all([
          getCompanies(),
          getProductsFromSales(),
          fetchPlProductCatalog(),
        ])
        const filtered = filterCompaniesByCountries(companiesData, allowedCountries)
        setCompanies(filtered)
        setProducts(productsData)
        setCategoryByName(buildCategoryByNameMap(catalog))
        setSelectedCompanies(isAdmin ? [...filtered] : filtered.length ? [...filtered] : [])
      } catch (e) {
        console.error("Error loading médicos page:", e)
      }
    }
    if (!permLoading) loadInitial()
  }, [allowedCountries, isAdmin, permLoading])

  useEffect(() => {
    let cancelled = false
    async function loadMedicos() {
      if (!companies.length || permLoading || !dateRangeReady) return
      const requestId = ++medicosFetchId.current
      try {
        const list = await getMedicosFromVentas(salesQueryParams)
        if (cancelled || requestId !== medicosFetchId.current) return
        setMedicos(list)
      } catch (e) {
        if (cancelled || requestId !== medicosFetchId.current) return
        console.error("Error loading médicos list:", e)
        setMedicos([])
      }
    }
    loadMedicos()
    return () => {
      cancelled = true
    }
  }, [companies.length, permLoading, dateRangeReady, fechaDesde, fechaHasta, companiesQueryKey, llcCountriesQueryKey])

  useEffect(() => {
    let cancelled = false
    async function loadLlcCountries() {
      if (!companies.length || permLoading || !dateRangeReady) return
      if (!hasLlcCompanyInList) {
        setLlcCountries([])
        setSelectedLlcCountries([])
        return
      }

      const requestId = ++llcCountriesFetchId.current
      try {
        const list = await getLlcCountriesFromVentas({
          fechaDesde,
          fechaHasta,
          companies: [GENERAL_LLC_COMPANY],
        })
        if (cancelled || requestId !== llcCountriesFetchId.current) return
        setLlcCountries((prev) => {
          const same =
            prev.length === list.length && prev.every((country, index) => country === list[index])
          return same ? prev : list
        })
        setSelectedLlcCountries((prev) => {
          if (!prev.length) return [...list]
          const stillValid = prev.filter((country) => list.includes(country))
          if (stillValid.length === prev.length) return prev
          if (stillValid.length) return stillValid
          return [...list]
        })
      } catch (e) {
        if (cancelled || requestId !== llcCountriesFetchId.current) return
        console.error("Error loading LLC countries:", e)
        setLlcCountries([])
        setSelectedLlcCountries([])
      }
    }

    loadLlcCountries()
    return () => {
      cancelled = true
    }
  }, [companies.length, permLoading, dateRangeReady, llcDiscoveryKey, hasLlcCompanyInList, fechaDesde, fechaHasta])

  useEffect(() => {
    let cancelled = false
    async function loadMatrix() {
      if (!companies.length || permLoading || !dateRangeReady) return
      const requestId = ++matrixFetchId.current
      if (hasLoadedMatrixOnce.current) {
        setIsRefreshing(true)
      } else {
        setIsLoading(true)
      }
      try {
        const data = await getMedicoInstitucionSales({
          ...salesQueryParams,
          products: effectiveProducts,
          categories: effectiveProducts ? undefined : effectiveCategories,
          medicos: selectedMedicos.length ? selectedMedicos : undefined,
          groupByYear: compareMode,
        })
        if (cancelled || requestId !== matrixFetchId.current) return
        setRows(data)
        hasLoadedMatrixOnce.current = true
      } catch (e) {
        if (cancelled || requestId !== matrixFetchId.current) return
        console.error("Error loading médicos matrix:", e)
        setRows([])
      } finally {
        if (cancelled || requestId !== matrixFetchId.current) return
        setIsLoading(false)
        setIsRefreshing(false)
      }
    }
    loadMatrix()
    return () => {
      cancelled = true
    }
  }, [
    companies.length,
    permLoading,
    dateRangeReady,
    fechaDesde,
    fechaHasta,
    companiesQueryKey,
    llcCountriesQueryKey,
    productsQueryKey,
    categoriesQueryKey,
    medicosQueryKey,
    compareMode,
  ])

  return (
    <div className="min-h-screen bg-gradient-to-r from-blue-900 via-blue-950 to-slate-900">
      <div className="container mx-auto p-6 space-y-6 max-w-[1600px]">
        <div>
          <h1 className="text-2xl font-bold text-white">Médicos</h1>
          <p className="text-sm text-white/80 mt-1">
            Unidades vendidas por médico e institución. Elegí el período con las fechas o un
            atajo (año completo, todo el histórico). Filas: médicos agrupables por institución.
          </p>
        </div>

        <MedicosFilters
          companies={companies}
          llcCountries={llcCountries}
          products={productsInGroup}
          medicos={medicos}
          selectedCompanies={selectedCompanies}
          selectedLlcCountries={selectedLlcCountries}
          selectedProducts={selectedProducts}
          selectedMedicos={selectedMedicos}
          selectedCategories={selectedCategories}
          businessGroup={businessGroup}
          onBusinessGroupChange={setBusinessGroup}
          fechaDesde={fechaDesde}
          fechaHasta={fechaHasta}
          fechaMin={fechaBounds?.min}
          fechaMax={fechaBounds?.max}
          datePresets={datePresets}
          onCompaniesChange={setSelectedCompanies}
          onLlcCountriesChange={setSelectedLlcCountries}
          onProductsChange={setSelectedProducts}
          onMedicosChange={setSelectedMedicos}
          onCategoriesChange={setSelectedCategories}
          onDateRangeChange={({ fechaDesde: d, fechaHasta: h }) => {
            setFechaDesde(d)
            setFechaHasta(h)
          }}
          showAllCompanies={isAdmin}
        />

        <MedicosMatrixTable
          rows={rows}
          isLoading={(isLoading || permLoading || !dateRangeReady) && rows.length === 0}
          isRefreshing={isRefreshing}
          compareMode={compareMode}
          onCompareModeChange={setCompareMode}
        />
      </div>
    </div>
  )
}
