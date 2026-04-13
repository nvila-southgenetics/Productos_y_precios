"use client"

import { Select } from "@/components/ui/select"
import { ProductMultiSearchFilter } from "@/components/dashboard/ProductMultiSearchFilter"
import { MultiCheckboxDropdown, type MultiSelectOption } from "@/components/filters/MultiCheckboxDropdown"
import { MonthRangeFilter } from "@/components/filters/MonthRangeFilter"

interface BudgetFiltersProps {
  selectedYear: number
  selectedBudgetName: string
  budgetNames: string[]
  selectedCountries: string[]
  selectedProducts: string[]
  monthFrom: number
  monthTo: number
  selectedChannels: string[]
  onYearChange: (year: number) => void
  onBudgetNameChange: (budgetName: string) => void
  onCountriesChange: (countries: string[]) => void
  onProductsChange: (products: string[]) => void
  onMonthRangeChange: (range: { fromMonth: number; toMonth: number }) => void
  onChannelsChange: (channels: string[]) => void
  countries?: string[]
  products?: string[]
  allowedCountries?: string[]
  showAllCountries?: boolean
}

const CHANNELS: MultiSelectOption[] = [
  { value: "Paciente", label: "Paciente" },
  { value: "Pacientes desc", label: "Pacientes desc" },
  { value: "Aseguradoras", label: "Aseguradoras" },
  { value: "Instituciones SFL", label: "Instituciones SFL" },
  { value: "Gobierno", label: "Gobierno" },
  { value: "Distribuidores", label: "Distribuidores" },
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
  selectedBudgetName,
  budgetNames,
  selectedCountries,
  selectedProducts,
  monthFrom,
  monthTo,
  selectedChannels,
  onYearChange,
  onBudgetNameChange,
  onCountriesChange,
  onProductsChange,
  onMonthRangeChange,
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

  const countryOptions: MultiSelectOption[] = filteredCountries.map((c) => ({ value: c.code, label: c.name }))
  const allCountriesLabel = allowedCountries?.length && allowedCountries.length > 1 ? "Todas (mis compañías)" : "Todas las compañías"

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
        <label className="text-sm font-medium text-white/90">Budget</label>
        <Select
          value={selectedBudgetName}
          onChange={(e) => onBudgetNameChange(e.target.value)}
          className="w-full bg-white/10 border-white/20 text-white focus:border-white/30 focus:ring-white/30"
        >
          {budgetNames.map((n) => (
            <option key={n} value={n} className="bg-blue-900 text-white">
              {n}
            </option>
          ))}
        </Select>
      </div>

      <MonthRangeFilter
        label="Mes"
        fromMonth={monthFrom}
        toMonth={monthTo}
        onChange={onMonthRangeChange}
      />

      <MultiCheckboxDropdown
        label="Compañía"
        options={countryOptions}
        selectedValues={selectedCountries}
        onSelectedValuesChange={onCountriesChange}
        allLabel={allowedCountries?.length ? allCountriesLabel : "Todas las compañías"}
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

