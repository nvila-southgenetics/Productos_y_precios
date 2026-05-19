"use client"

import { useEffect, useMemo, useState } from "react"
import { MedicosFilters } from "@/components/medicos/MedicosFilters"
import { MedicosMatrixTable } from "@/components/medicos/MedicosMatrixTable"
import { usePermissions } from "@/lib/use-permissions"
import { filterCompaniesByCountries } from "@/lib/auth-constants"
import { PRODUCT_CATEGORIES_SORTED } from "@/lib/product-categories"
import {
  getCompanies,
  getMedicoInstitucionSales,
  getMedicosFromVentas,
  getProductsFromSales,
  MEDICOS_PAGE_YEAR,
  type MedicoInstitucionSaleRow,
} from "@/lib/supabase-mcp"

export default function MedicosPage() {
  const { allowedCountries, isAdmin, loading: permLoading } = usePermissions()
  const [companies, setCompanies] = useState<string[]>([])
  const [products, setProducts] = useState<string[]>([])
  const [medicos, setMedicos] = useState<string[]>([])
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([])
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  const [selectedMedicos, setSelectedMedicos] = useState<string[]>([])
  const [selectedCategories, setSelectedCategories] = useState<string[]>(PRODUCT_CATEGORIES_SORTED)
  const [monthFrom, setMonthFrom] = useState(1)
  const [monthTo, setMonthTo] = useState(12)
  const [rows, setRows] = useState<MedicoInstitucionSaleRow[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const companiesForQuery = useMemo(() => {
    if (!companies.length) return []
    const sel = selectedCompanies.length ? selectedCompanies : companies
    const allPicked =
      sel.length === companies.length && companies.every((c) => sel.includes(c))
    if (isAdmin && allPicked) return companies
    return sel
  }, [companies, selectedCompanies, isAdmin])

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
      if (!companies.length || permLoading) return
      try {
        const list = await getMedicosFromVentas({
          year: MEDICOS_PAGE_YEAR,
          monthFrom,
          monthTo,
          companies: companiesForQuery,
        })
        setMedicos(list)
      } catch (e) {
        console.error("Error loading médicos list:", e)
        setMedicos([])
      }
    }
    loadMedicos()
  }, [companies.length, companiesForQuery, monthFrom, monthTo, permLoading])

  useEffect(() => {
    async function loadMatrix() {
      if (!companies.length || permLoading) return
      setIsLoading(true)
      try {
        const allCategories =
          selectedCategories.length === PRODUCT_CATEGORIES_SORTED.length &&
          PRODUCT_CATEGORIES_SORTED.every((c) => selectedCategories.includes(c))
        const data = await getMedicoInstitucionSales({
          year: MEDICOS_PAGE_YEAR,
          monthFrom,
          monthTo,
          companies: companiesForQuery,
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
    companiesForQuery,
    monthFrom,
    monthTo,
    selectedProducts,
    selectedMedicos,
    selectedCategories,
    permLoading,
  ])

  return (
    <div className="min-h-screen bg-gradient-to-r from-blue-900 via-blue-950 to-slate-900">
      <div className="container mx-auto p-6 space-y-6 max-w-[1600px]">
        <div>
          <h1 className="text-2xl font-bold text-white">Médicos</h1>
          <p className="text-sm text-white/80 mt-1">
            Unidades vendidas por médico e institución ({MEDICOS_PAGE_YEAR}). Filas: médicos (agrupables
            por institución). Columnas: total y productos ordenados por ventas.
          </p>
        </div>

        <MedicosFilters
          companies={companies}
          products={products}
          medicos={medicos}
          selectedCompanies={selectedCompanies}
          selectedProducts={selectedProducts}
          selectedMedicos={selectedMedicos}
          selectedCategories={selectedCategories}
          monthFrom={monthFrom}
          monthTo={monthTo}
          onCompaniesChange={setSelectedCompanies}
          onProductsChange={setSelectedProducts}
          onMedicosChange={setSelectedMedicos}
          onCategoriesChange={setSelectedCategories}
          onMonthRangeChange={({ fromMonth, toMonth }) => {
            setMonthFrom(fromMonth)
            setMonthTo(toMonth)
          }}
          showAllCompanies={isAdmin}
        />

        <MedicosMatrixTable rows={rows} isLoading={isLoading || permLoading} />
      </div>
    </div>
  )
}
