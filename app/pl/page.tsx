"use client"

import { useState, useEffect } from "react"
import { usePermissions } from "@/lib/use-permissions"
import { supabase } from "@/lib/supabase"
import { Select } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { ChevronDown } from "lucide-react"
import { cn, productNameSortKey } from "@/lib/utils"
import { PLTable } from "@/components/pl/PLTable"
import { ProductMultiSearchFilter } from "@/components/dashboard/ProductMultiSearchFilter"

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

function MultiCheckboxDropdown({
  label,
  options,
  selectedValues,
  onSelectedValuesChange,
  allLabel,
}: {
  label: string
  options: Option[]
  selectedValues: string[]
  onSelectedValuesChange: (values: string[]) => void
  allLabel: string
}) {
  const [open, setOpen] = useState(false)

  const allValues = options.map((o) => o.value)
  const isAll = allValues.length > 0 && selectedValues.length === allValues.length && allValues.every((v) => selectedValues.includes(v))

  const display =
    isAll ? allLabel : selectedValues.length === 1 ? options.find((o) => o.value === selectedValues[0])?.label ?? selectedValues[0] : `${selectedValues.length} seleccionados`

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
  const [modelo, setModelo] = useState<"budget" | "real">("budget")
  // Arrays con multi-selección: si elegís "Todos", guardamos todos los valores posibles.
  const [selectedCountries, setSelectedCountries] = useState<string[]>([])
  const [selectedCategories, setSelectedCategories] = useState<string[]>(CATEGORIES)
  const [productsSelected, setProductsSelected] = useState<string[]>([])
  const [selectedChannels, setSelectedChannels] = useState<string[]>(CHANNELS)
  const [products, setProducts] = useState<string[]>([])
  // YTD por defecto: hasta diciembre
  const [ytdMonth, setYtdMonth] = useState<number>(12)
  const [testMode, setTestMode] = useState<boolean>(false)
  const year = 2026

  const allowedCountryCodes = isAdmin
    ? [...BASE_COUNTRIES.map((c) => c.code)]
    : allowedCountries

  useEffect(() => {
    if (!permLoading && allowedCountryCodes.length > 0) {
      setSelectedCountries([allowedCountryCodes[0]])
    }
  }, [permLoading, isAdmin, allowedCountries])

  useEffect(() => {
    fetchProducts()
    setProductsSelected([])
  }, [selectedCountries, selectedCategories, modelo, year])

  const fetchProducts = async () => {
    try {
      if (modelo === "budget") {
        let q = supabase.from("budget").select("product_name").eq("year", year)
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

  return (
    <div className="min-h-screen bg-gradient-to-r from-blue-900 via-blue-950 to-slate-900">
      <div className="container mx-auto py-8 px-4 max-w-screen-2xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white">P&L</h1>
          <p className="text-white/80 mt-1">
            Estado de resultados por producto, país y canal
          </p>
        </div>

        {/* Filters */}
        <div className="mb-6 rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 p-4 shadow-sm">
          <div className="grid grid-cols-2 md:grid-cols-7 gap-4">
            {/* Modelo */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-white/90">Modelo</label>
              <Select
                value={modelo}
                onChange={(e) => setModelo(e.target.value as "budget" | "real")}
                className={selectClass}
              >
                <option value="budget" className="bg-blue-900 text-white">
                  Budget
                </option>
                <option value="real" className="bg-blue-900 text-white">
                  Real 2026
                </option>
              </Select>
            </div>

            {/* Países (multi) */}
            <MultiCheckboxDropdown
              label="Países"
              options={countryOptions}
              selectedValues={countriesForUI}
              onSelectedValuesChange={setSelectedCountries}
              allLabel={isAdmin ? "Todos los países" : "Todos (mis países)"}
            />

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

            {/* Hasta mes (YTD) */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-white/90">Hasta mes (YTD)</label>
              <Select
                value={ytdMonth.toString()}
                onChange={(e) => setYtdMonth(parseInt(e.target.value) || 12)}
                className={selectClass}
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1} className="bg-blue-900 text-white">
                    {new Date(2000, i, 1).toLocaleDateString("es-UY", { month: "long" }).replace(/^\w/, (c) => c.toUpperCase())}
                  </option>
                ))}
              </Select>
            </div>

            {/* Test toggle */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-white/90">Test</label>
              <button
                type="button"
                onClick={() => setTestMode((v) => !v)}
                className={`inline-flex items-center justify-center rounded-md px-3 py-2 text-xs font-semibold border transition-colors ${
                  testMode
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

        {/* P&L Table */}
        <PLTable
          modelo={modelo}
          year={year}
          countries={countriesForUI}
          categories={selectedCategories}
          products={productsSelected}
          channels={selectedChannels}
          canEdit={canEdit}
          ytdMonth={ytdMonth}
          testMode={testMode}
        />
      </div>
    </div>
  )
}
