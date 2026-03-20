"use client"

import { Select } from "@/components/ui/select"
import { ProductMultiSearchFilter } from "@/components/dashboard/ProductMultiSearchFilter"
import { Checkbox } from "@/components/ui/checkbox"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { useState } from "react"

interface BudgetFiltersProps {
  selectedYear: number
  selectedCountries: string[]
  selectedProducts: string[]
  selectedMonths: string[]
  selectedChannels: string[]
  onYearChange: (year: number) => void
  onCountriesChange: (countries: string[]) => void
  onProductsChange: (products: string[]) => void
  onMonthsChange: (months: string[]) => void
  onChannelsChange: (channels: string[]) => void
  countries?: string[]
  products?: string[]
  allowedCountries?: string[]
  showAllCountries?: boolean
}

const CHANNELS = [
  { value: "Paciente", label: "Paciente" },
  { value: "Pacientes desc", label: "Pacientes desc" },
  { value: "Aseguradoras", label: "Aseguradoras" },
  { value: "Instituciones SFL", label: "Instituciones SFL" },
  { value: "Gobierno", label: "Gobierno" },
  { value: "Distribuidores", label: "Distribuidores" },
]

type Option = { value: string; label: string }

function MultiCheckboxDropdown({
  label,
  options,
  selectedValues,
  onSelectedValuesChange,
  allLabel,
  hideLabel = false,
}: {
  label: string
  options: Option[]
  selectedValues: string[]
  onSelectedValuesChange: (values: string[]) => void
  allLabel: string
  hideLabel?: boolean
}) {
  const [open, setOpen] = useState(false)

  const allValues = options.map((o) => o.value)
  const isAll = allValues.length > 0 && selectedValues.length === allValues.length && allValues.every((v) => selectedValues.includes(v))
  const display =
    isAll
      ? allLabel
      : selectedValues.length === 1
        ? options.find((o) => o.value === selectedValues[0])?.label ?? selectedValues[0]
        : `${selectedValues.length} seleccionados`

  const toggle = (v: string) => {
    // UX: si está seleccionado "todo", al clickear una opción pasamos directo a esa opción sola.
    if (isAll && selectedValues.includes(v)) {
      onSelectedValuesChange([v])
      return
    }
    const next = selectedValues.includes(v) ? selectedValues.filter((x) => x !== v) : [...selectedValues, v]
    onSelectedValuesChange(next.length === 0 ? allValues : next)
  }

  return (
    <div className="flex flex-col gap-2">
      {!hideLabel && <label className="text-sm font-medium text-white/90">{label}</label>}
      <div className="w-full">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-md border px-3 py-2 text-sm",
            "bg-white/10 border-white/20 text-white focus:border-white/30 focus:ring-2 focus:ring-white/30"
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

const MONTH_OPTIONS: Option[] = [
  { value: "1", label: "Enero" },
  { value: "2", label: "Febrero" },
  { value: "3", label: "Marzo" },
  { value: "4", label: "Abril" },
  { value: "5", label: "Mayo" },
  { value: "6", label: "Junio" },
  { value: "7", label: "Julio" },
  { value: "8", label: "Agosto" },
  { value: "9", label: "Septiembre" },
  { value: "10", label: "Octubre" },
  { value: "11", label: "Noviembre" },
  { value: "12", label: "Diciembre" },
]

const countries = [
  { code: "all", name: "Todos los países" },
  { code: "AR", name: "Argentina" },
  { code: "CL", name: "Chile" },
  { code: "CO", name: "Colombia" },
  { code: "MX", name: "México" },
  { code: "UY", name: "Uruguay" },
  { code: "VE", name: "Venezuela" },
  { code: "PE", name: "Perú" },
  { code: "BO", name: "Bolivia" },
  { code: "TT", name: "Trinidad y Tobago" },
  { code: "BS", name: "Bahamas" },
  { code: "BB", name: "Barbados" },
  { code: "BM", name: "Bermuda" },
  { code: "KY", name: "Cayman Islands" },
]

export function BudgetFilters({
  selectedYear,
  selectedCountries,
  selectedProducts,
  selectedMonths,
  selectedChannels,
  onYearChange,
  onCountriesChange,
  onProductsChange,
  onMonthsChange,
  onChannelsChange,
  products = [],
  allowedCountries,
  showAllCountries = true,
}: BudgetFiltersProps) {
  // Opciones de países disponibles para este usuario.
  const filteredCountries = showAllCountries
    ? countries.filter((c) => c.code !== "all")
    : allowedCountries?.length
      ? countries.filter((c) => allowedCountries.includes(c.code))
      : countries.filter((c) => c.code !== "all")

  const countryOptions: Option[] = filteredCountries.map((c) => ({ value: c.code, label: c.name }))
  const allCountriesLabel = allowedCountries?.length && allowedCountries.length > 1 ? "Todos (mis países)" : "Todos los países"

  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-white/90">Año</label>
        <Select
          value={selectedYear.toString()}
          onChange={(e) => onYearChange(parseInt(e.target.value))}
          className="w-full bg-white/10 border-white/20 text-white focus:border-white/30 focus:ring-white/30"
        >
          <option value="2025" className="bg-blue-900 text-white">2025</option>
          <option value="2026" className="bg-blue-900 text-white">2026</option>
          <option value="2027" className="bg-blue-900 text-white">2027</option>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-white/90">Mes</label>
        <MultiCheckboxDropdown
          label="Mes"
          options={MONTH_OPTIONS}
          selectedValues={selectedMonths}
          onSelectedValuesChange={onMonthsChange}
          allLabel="Todos los meses"
          hideLabel
        />
      </div>

      <MultiCheckboxDropdown
        label="País"
        options={countryOptions}
        selectedValues={selectedCountries}
        onSelectedValuesChange={onCountriesChange}
        allLabel={allowedCountries?.length ? allCountriesLabel : "Todos los países"}
      />

      <MultiCheckboxDropdown
        label="Canal"
        options={CHANNELS}
        selectedValues={selectedChannels}
        onSelectedValuesChange={onChannelsChange}
        allLabel="Todos los canales"
      />

      <div className="flex flex-col gap-2">
        <ProductMultiSearchFilter
          products={products}
          selectedProducts={selectedProducts}
          onSelectedProductsChange={onProductsChange}
          allLabel="Todos los productos"
        />
      </div>
    </div>
  )
}

