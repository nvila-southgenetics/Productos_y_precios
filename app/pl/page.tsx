"use client"

import { useState, useEffect, useMemo } from "react"
import { usePermissions } from "@/lib/use-permissions"
import { supabase } from "@/lib/supabase"
import { Select } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { ChevronDown } from "lucide-react"
import { cn, productNameSortKey } from "@/lib/utils"
import { PLTable } from "@/components/pl/PLTable"
import { ProductMultiSearchFilter } from "@/components/dashboard/ProductMultiSearchFilter"
import { MonthRangeFilter } from "@/components/filters/MonthRangeFilter"
import { getCompanies } from "@/lib/supabase-mcp"
import { filterCompaniesByCountries, getCountryForCompany } from "@/lib/auth-constants"
import { companyQueryFromSelection } from "@/lib/company-filter"

const BASE_COUNTRIES = [
  { code: "AR", name: "Argentina" },
  { code: "CL", name: "Chile" },
  { code: "CO", name: "Colombia" },
  { code: "MX", name: "México" },
  { code: "UY", name: "Uruguay" },
  { code: "VE", name: "Venezuela" },
] as const

const CHANNELS = ["Gobierno", "Instituciones SFL", "Paciente", "Pacientes desc", "Aseguradoras", "Distribuidores"]

const CATEGORIES = [
  "Anualidades",
  "Endocrinología",
  "Ginecología",
  "Oncología",
  "Otros",
  "Prenatales",
  "Urología",
]

const selectClass =
  "w-full bg-white/10 border-white/20 text-white focus:border-white/30 focus:ring-white/30"

type Option = { value: string; label: string }
type ModelKey = "real_2026" | "real_2025" | `budget:${string}`

function MultiCheckboxDropdown({
  label,
  options,
  selectedValues,
  onSelectedValuesChange,
  allLabel,
  pendingLabel,
}: {
  label: string
  options: Option[]
  selectedValues: string[]
  onSelectedValuesChange: (values: string[]) => void
  allLabel: string
  /** Mientras no hay opciones (p. ej. permisos cargando), mostrar este texto en lugar de "0 seleccionados". */
  pendingLabel?: string
}) {
  const [open, setOpen] = useState(false)

  const allValues = options.map((o) => o.value)
  const isAll = allValues.length > 0 && selectedValues.length === allValues.length && allValues.every((v) => selectedValues.includes(v))

  const display =
    options.length === 0 && pendingLabel
      ? pendingLabel
      : options.length === 0
        ? "Sin opciones"
        : isAll
          ? allLabel
          : selectedValues.length === 1
            ? options.find((o) => o.value === selectedValues[0])?.label ?? selectedValues[0]
            : `${selectedValues.length} seleccionados`

  const toggle = (v: string) => {
    // UX: si "todos" está activo y se toca una opción,
    // se toma como intención de filtrar solo por esa opción.
    if (isAll && selectedValues.includes(v)) {
      onSelectedValuesChange([v])
      return
    }
    const next = selectedValues.includes(v) ? selectedValues.filter((x) => x !== v) : [...selectedValues, v]
    // Evitamos "0" selección: si se desmarca todo, volvemos a "todos".
    onSelectedValuesChange(next.length === 0 ? allValues : next)
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-white/90">{label}</label>
      <div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-md border px-3 py-2 text-sm",
            "bg-white/10 border-white/20 text-white focus:border-white/30 focus:ring-2 focus:ring-white/30 focus:ring-offset-0 focus:ring-offset-transparent"
          )}
          aria-label={`Alternar ${label}`}
        >
          <span className="truncate">{display}</span>
          <ChevronDown className={cn("h-4 w-4 opacity-70 transition-transform", open && "rotate-180")} />
        </button>

        {open && (
          <div className="mt-1 w-full rounded-md border border-white/20 bg-blue-950/95 backdrop-blur-sm py-2 shadow-lg max-h-64 overflow-y-auto">
            <button
              type="button"
              onClick={() => {
                onSelectedValuesChange(allValues)
                setOpen(false)
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-white/90 hover:bg-white/10"
            >
              <Checkbox checked={isAll} />
              {allLabel}
            </button>

            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggle(opt.value)}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-white/90 hover:bg-white/10"
              >
                <Checkbox checked={selectedValues.includes(opt.value)} />
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function PLPage() {
  const { allowedCountries, isAdmin, canEdit, loading: permLoading } = usePermissions()
  const [modelKey, setModelKey] = useState<ModelKey>("budget:budget")
  const [combineEnabled, setCombineEnabled] = useState(false)
  const [monthModels, setMonthModels] = useState<ModelKey[]>(Array(12).fill("budget:budget"))
  const [budgetNames, setBudgetNames] = useState<string[]>(["budget"])
  // Arrays con multi-selección: si elegís "Todos", guardamos todos los valores posibles.
  const [selectedCountries, setSelectedCountries] = useState<string[]>([])
  const [companies, setCompanies] = useState<string[]>([])
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([])
  const [selectedCategories, setSelectedCategories] = useState<string[]>(CATEGORIES)
  const [productsSelected, setProductsSelected] = useState<string[]>([])
  const [selectedChannels, setSelectedChannels] = useState<string[]>(CHANNELS)
  const [products, setProducts] = useState<string[]>([])
  const [monthFrom, setMonthFrom] = useState<number>(1)
  const [monthTo, setMonthTo] = useState<number>(12)
  const [testMode, setTestMode] = useState<boolean>(false)
  const isBudgetModel = modelKey.startsWith("budget:")
  const selectedBudgetName = isBudgetModel ? modelKey.slice("budget:".length) : "budget"
  const year = modelKey === "real_2025" ? 2025 : 2026
  const budgetYear = 2026

  const allowedCountryCodes = useMemo(
    () => (isAdmin ? [...BASE_COUNTRIES.map((c) => c.code)] : allowedCountries),
    [isAdmin, allowedCountries]
  )

  // Cargar lista de compañías de ventas (mismo origen que Real Import)
  useEffect(() => {
    async function loadCompanies() {
      try {
        const companiesData = await getCompanies()
        const filtered = filterCompaniesByCountries(companiesData, allowedCountryCodes)
        setCompanies(filtered)
        setSelectedCompanies(isAdmin ? [...filtered] : filtered.length ? [filtered[0]] : [])
      } catch (e) {
        console.error("Error loading companies:", e)
        setCompanies([])
        setSelectedCompanies([])
      }
    }
    if (!permLoading) loadCompanies()
  }, [permLoading, isAdmin, allowedCountryCodes.join("|")])

  const companyParam = useMemo(
    () => companyQueryFromSelection(companies, selectedCompanies, isAdmin),
    [companies, selectedCompanies, isAdmin]
  )

  const salesCompanies = useMemo<string[] | null>(() => {
    if (typeof companyParam === "string") {
      return companyParam === "Todas las compañías" ? null : [companyParam]
    }
    return companyParam
  }, [companyParam])

  // En Real, derivamos países desde compañías para overrides/SGA/taxes.
  const countriesFromCompanies = useMemo(() => {
    if (salesCompanies === null) return [...allowedCountryCodes]
    const set = new Set<string>()
    for (const c of salesCompanies) {
      const cc = getCountryForCompany(c)
      if (cc) set.add(cc)
    }
    return set.size ? [...set] : [...allowedCountryCodes]
  }, [salesCompanies, allowedCountryCodes.join("|")])

  useEffect(() => {
    if (!permLoading && allowedCountryCodes.length > 0) {
      setSelectedCountries([...allowedCountryCodes])
    }
  }, [permLoading, allowedCountryCodes])

  useEffect(() => {
    fetchBudgetNames()
    fetchProducts()
    setProductsSelected([])
  }, [selectedCountries, selectedCategories, modelKey, year, selectedBudgetName])

  // Inicializar el mapeo por mes cuando se activa "Combinar"
  useEffect(() => {
    if (!combineEnabled) return
    setMonthModels(Array(12).fill(modelKey))
    // En modo combinar, el "Test" no aplica (mezcla varios modelos).
    setTestMode(false)
  }, [combineEnabled, modelKey])

  const fetchBudgetNames = async () => {
    try {
      let q = supabase.from("budget").select("budget_name").eq("year", budgetYear)
      if (selectedCountries.length) q = q.in("country_code", selectedCountries)
      const { data } = await q
      const rows = (data ?? []) as any[]
      const names: string[] = [...new Set(
        rows
          .map((r) => String(r?.budget_name || "").trim())
          .filter((x) => Boolean(x))
      )].sort()
      const finalNames: string[] = names.length ? names : ["budget"]
      setBudgetNames(finalNames)
      // Si el modelo actual es budget y el nombre ya no existe, saltar al primero disponible.
      if (isBudgetModel) {
        const nextName = finalNames.includes(selectedBudgetName) ? selectedBudgetName : finalNames[0]
        setModelKey(`budget:${nextName}`)
      }
    } catch (e) {
      console.error("Error fetching budget names:", e)
      setBudgetNames(["budget"])
      if (isBudgetModel) setModelKey("budget:budget")
    }
  }

  const fetchProducts = async () => {
    try {
      if (isBudgetModel) {
        let q = supabase.from("budget").select("product_name").eq("year", budgetYear)
        q = q.eq("budget_name", selectedBudgetName)
        if (selectedCountries.length) q = q.in("country_code", selectedCountries)
        const { data } = await q
        if (!data) return
        let names = [...new Set(data.map((b: { product_name: string }) => b.product_name))] as string[]

        if (selectedCategories.length && selectedCategories.length !== CATEGORIES.length) {
          const { data: prods } = await supabase
            .from("products")
            .select("name")
            .in("category", selectedCategories)
          const catNames = new Set(prods?.map((p: { name: string }) => p.name) || [])
          names = names.filter((n) => catNames.has(n))
        }
        setProducts(
          names.sort((a, b) =>
            productNameSortKey(a).localeCompare(productNameSortKey(b), "es", { sensitivity: "base" })
          )
        )
      } else {
        let q = supabase.from("products").select("name, category")
        if (selectedCategories.length && selectedCategories.length !== CATEGORIES.length) {
          q = q.in("category", selectedCategories)
        }
        const { data } = await q
        if (!data) return
        setProducts(
          data
            .map((p: { name: string }) => p.name)
            .sort((a: string, b: string) =>
              productNameSortKey(a).localeCompare(productNameSortKey(b), "es", { sensitivity: "base" })
            )
        )
      }
    } catch (err) {
      console.error(err)
    }
  }

  const countryOptions: Option[] = BASE_COUNTRIES.filter((c) => allowedCountryCodes.includes(c.code)).map((c) => ({
    value: c.code,
    label: c.name,
  }))
  const countriesForUI = selectedCountries.length ? selectedCountries : (allowedCountryCodes[0] ? [allowedCountryCodes[0]] : [])

  const isRealModel = !isBudgetModel
  const countriesForPL = isRealModel ? countriesFromCompanies : countriesForUI
  const plDataReady = !permLoading && countriesForPL.length > 0 && (!isRealModel || companies.length > 0)

  return (
    <div className="min-h-screen bg-gradient-to-r from-blue-900 via-blue-950 to-slate-900">
      <div className="container mx-auto py-8 px-4 max-w-screen-2xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white">P&L</h1>
          <p className="text-white/80 mt-1">
            Estado de resultados por producto, compañía y canal
          </p>
        </div>

        {/* Filters */}
        <div className="mb-6 rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 p-4 shadow-sm">
          {permLoading && (
            <p className="text-sm text-white/60 mb-3 col-span-full">Cargando permisos de usuario…</p>
          )}
          <div className="grid grid-cols-2 md:grid-cols-7 gap-4">
            {/* Modelo */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-white/90">Modelo</label>
              <Select
                value={modelKey}
                onChange={(e) => setModelKey(e.target.value as ModelKey)}
                className={selectClass}
              >
                <option value="real_2026" className="bg-blue-900 text-white">
                  Real 2026
                </option>
                <option value="real_2025" className="bg-blue-900 text-white">
                  Real 2025
                </option>
                {budgetNames.map((n) => (
                  <option key={n} value={`budget:${n}`} className="bg-blue-900 text-white">
                    Budget: {n}
                  </option>
                ))}
              </Select>
            </div>

            {/* País (multi) */}
            <MultiCheckboxDropdown
              label="País"
              options={countryOptions}
              selectedValues={countriesForUI}
              onSelectedValuesChange={setSelectedCountries}
              allLabel={isAdmin ? "Todos los países" : "Todos (mis países)"}
              pendingLabel={permLoading ? "Cargando permisos…" : undefined}
            />

            {/* Compañía (ventas) */}
            {!isBudgetModel && (
              <MultiCheckboxDropdown
                label="Compañía"
                options={companies.map((c) => ({ value: c, label: c }))}
                selectedValues={selectedCompanies.length ? selectedCompanies : companies}
                onSelectedValuesChange={setSelectedCompanies}
                allLabel={isAdmin ? "Todas las compañías" : "Todas (mis compañías)"}
                pendingLabel={permLoading ? "Cargando permisos…" : undefined}
              />
            )}

            {/* Categoría */}
            <MultiCheckboxDropdown
              label="Categoría"
              options={CATEGORIES.map((c) => ({ value: c, label: c }))}
              selectedValues={selectedCategories}
              onSelectedValuesChange={setSelectedCategories}
              allLabel="Todas las categorías"
            />

            {/* Producto */}
            <div className="flex flex-col gap-2">
              <ProductMultiSearchFilter
                products={products}
                selectedProducts={productsSelected}
                onSelectedProductsChange={setProductsSelected}
                allLabel="Todos los productos"
              />
            </div>

            {/* Canal (multi) */}
            <MultiCheckboxDropdown
              label="Canal"
              options={CHANNELS.map((ch) => ({ value: ch, label: ch }))}
              selectedValues={selectedChannels}
              onSelectedValuesChange={setSelectedChannels}
              allLabel="Todos los canales"
            />

            <MonthRangeFilter
              label="Mes"
              fromMonth={monthFrom}
              toMonth={monthTo}
              onChange={({ fromMonth, toMonth }) => {
                setMonthFrom(fromMonth)
                setMonthTo(toMonth)
              }}
            />

            {/* Combinar */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-white/90">Combinar</label>
              <button
                type="button"
                onClick={() => setCombineEnabled((v) => !v)}
                className={`inline-flex items-center justify-center rounded-md px-3 py-2 text-xs font-semibold border transition-colors ${
                  combineEnabled
                    ? "bg-cyan-500/20 border-cyan-400/60 text-cyan-200"
                    : "bg-white/5 border-white/30 text-white/70 hover:bg-white/10"
                }`}
              >
                <span className="mr-2">Combinar</span>
                <span
                  className={`inline-flex h-4 w-8 items-center rounded-full px-0.5 text-[10px] ${
                    combineEnabled ? "bg-cyan-500/80 justify-end" : "bg-slate-500/70 justify-start"
                  }`}
                >
                  <span className="h-3 w-3 rounded-full bg-white" />
                </span>
              </button>
              {combineEnabled && (
                <span className="text-[11px] text-white/50 leading-tight">
                  Seleccioná el modelo arriba de cada mes.
                </span>
              )}
            </div>

            {/* Test toggle */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-white/90">Test</label>
              <button
                type="button"
                onClick={() => setTestMode((v) => !v)}
                disabled={combineEnabled}
                className={`inline-flex items-center justify-center rounded-md px-3 py-2 text-xs font-semibold border transition-colors ${
                  combineEnabled
                    ? "bg-white/5 border-white/15 text-white/30 cursor-not-allowed"
                    : testMode
                      ? "bg-emerald-500/20 border-emerald-400/60 text-emerald-200"
                      : "bg-white/5 border-white/30 text-white/70 hover:bg-white/10"
                }`}
              >
                <span className="mr-2">Test</span>
                <span
                  className={`inline-flex h-4 w-8 items-center rounded-full px-0.5 text-[10px] ${
                    testMode ? "bg-emerald-500/80 justify-end" : "bg-slate-500/70 justify-start"
                  }`}
                >
                  <span className="h-3 w-3 rounded-full bg-white" />
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* P&L Table: no montar hasta tener compañías — evita fetch con countries=[] y carga colgada */}
        {plDataReady ? (
          <PLTable
            key={`${countriesForPL.slice().sort().join(",")}-${(salesCompanies ? salesCompanies.slice().sort().join(",") : "all")}-${modelKey}-${year}`}
            modelo={isBudgetModel ? "budget" : "real"}
            year={year}
            countries={countriesForPL}
            salesCompanies={salesCompanies}
            categories={selectedCategories}
            products={productsSelected}
            channels={selectedChannels}
            canEdit={canEdit}
            monthFrom={monthFrom}
            monthTo={monthTo}
            testMode={testMode}
            budgetName={selectedBudgetName}
            combineEnabled={combineEnabled}
            monthModels={monthModels}
            onMonthModelChange={(monthIdx0, nextKey) => {
              setMonthModels((prev) => prev.map((m, i) => (i === monthIdx0 ? nextKey : m)))
            }}
          />
        ) : permLoading ? (
          <div className="rounded-lg border border-white/20 bg-slate-800/40 px-6 py-16 text-center text-white/70 text-sm">
            Preparando filtros y datos…
          </div>
        ) : (
          <div className="rounded-lg border border-amber-500/35 bg-amber-950/25 px-6 py-10 text-center text-amber-100/95 text-sm max-w-lg mx-auto">
            No hay compañías disponibles para tu usuario (o la sesión no pudo cargarse). Iniciá sesión con una cuenta
            autorizada o pedí en administración que te asignen al menos una compañía.
          </div>
        )}
      </div>
    </div>
  )
}
