"use client"

import { useEffect, useMemo, useState } from "react"
import { MedicosFilters } from "@/components/medicos/MedicosFilters"
import { MedicosMatrixTable } from "@/components/medicos/MedicosMatrixTable"
import type { DateRangePreset } from "@/components/filters/DateRangeFilter"
import { usePermissions } from "@/lib/use-permissions"
import { filterCompaniesByCountries } from "@/lib/auth-constants"
import { PRODUCT_CATEGORIES_SORTED } from "@/lib/product-categories"
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
  const [fechaBounds, setFechaBounds] = useState<{ min: string; max: string } | null>(null)
  const [fechaDesde, setFechaDesde] = useState("")
  const [fechaHasta, setFechaHasta] = useState("")
  const [rows, setRows] = useState<MedicoInstitucionSaleRow[]>([])
  const [isLoading, setIsLoading] = useState(true)

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

  const salesQueryParams = useMemo(
    () => ({
      fechaDesde,
      fechaHasta,
      companies: companiesForQuery,
      llcCountries: llcCountriesForQuery,
    }),
    [fechaDesde, fechaHasta, companiesForQuery, llcCountriesForQuery]
  )

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
        const [companiesData, productsData] = await Promise.all([
          getCompanies(),
          getProductsFromSales(),
        ])
        const filtered = filterCompaniesByCountries(companiesData, allowedCountries)
        setCompanies(filtered)
        setProducts(productsData)
        setSelectedCompanies(isAdmin ? [...filtered] : filtered.length ? [...filtered] : [])
      } catch (e) {
        console.error("Error loading médicos page:", e)
      }
    }
    if (!permLoading) loadInitial()
  }, [allowedCountries, isAdmin, permLoading])

  useEffect(() => {
    async function loadMedicos() {
      if (!companies.length || permLoading || !dateRangeReady) return
      try {
        const list = await getMedicosFromVentas(salesQueryParams)
        setMedicos(list)
      } catch (e) {
        console.error("Error loading médicos list:", e)
        setMedicos([])
      }
    }
    loadMedicos()
  }, [companies.length, permLoading, dateRangeReady, salesQueryParams])

  useEffect(() => {
    async function loadLlcCountries() {
      if (!companies.length || permLoading || !dateRangeReady) return
      if (!companies.includes(GENERAL_LLC_COMPANY)) {
        setLlcCountries([])
        setSelectedLlcCountries([])
        return
      }

      try {
        const list = await getLlcCountriesFromVentas({
          ...salesQueryParams,
          companies: [GENERAL_LLC_COMPANY],
        })
        const sameCountries =
          list.length === llcCountries.length &&
          list.every((country, index) => country === llcCountries[index])
        if (!sameCountries) {
          setLlcCountries(list)
        }
        setSelectedLlcCountries((prev) => {
          const prevWasAllSelected =
            llcCountries.length > 0 &&
            prev.length === llcCountries.length &&
            llcCountries.every((country) => prev.includes(country))
          if (prevWasAllSelected) return [...list]
          const stillValid = prev.filter((country) => list.includes(country))
          if (stillValid.length) return stillValid
          return [...list]
        })
      } catch (e) {
        console.error("Error loading LLC countries:", e)
        setLlcCountries([])
        setSelectedLlcCountries([])
      }
    }

    loadLlcCountries()
  }, [companies, llcCountries, permLoading, dateRangeReady, salesQueryParams])

  useEffect(() => {
    async function loadMatrix() {
      if (!companies.length || permLoading || !dateRangeReady) return
      setIsLoading(true)
      try {
        const allCategories =
          selectedCategories.length === PRODUCT_CATEGORIES_SORTED.length &&
          PRODUCT_CATEGORIES_SORTED.every((c) => selectedCategories.includes(c))
        const data = await getMedicoInstitucionSales({
          ...salesQueryParams,
          products: selectedProducts.length ? selectedProducts : undefined,
          categories: allCategories ? undefined : selectedCategories,
          medicos: selectedMedicos.length ? selectedMedicos : undefined,
        })
        setRows(data)
      } catch (e) {
        console.error("Error loading médicos matrix:", e)
        setRows([])
      } finally {
        setIsLoading(false)
      }
    }
    loadMatrix()
  }, [
    companies.length,
    permLoading,
    dateRangeReady,
    salesQueryParams,
    selectedProducts,
    selectedMedicos,
    selectedCategories,
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
          products={products}
          medicos={medicos}
          selectedCompanies={selectedCompanies}
          selectedLlcCountries={selectedLlcCountries}
          selectedProducts={selectedProducts}
          selectedMedicos={selectedMedicos}
          selectedCategories={selectedCategories}
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

        <MedicosMatrixTable rows={rows} isLoading={isLoading || permLoading || !dateRangeReady} />
      </div>
    </div>
  )
}
