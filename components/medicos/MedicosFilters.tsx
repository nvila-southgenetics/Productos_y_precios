"use client"

import { ProductMultiSearchFilter } from "@/components/dashboard/ProductMultiSearchFilter"
import { MedicoMultiSearchFilter } from "@/components/medicos/MedicoMultiSearchFilter"
import { MultiCheckboxDropdown, type MultiSelectOption } from "@/components/filters/MultiCheckboxDropdown"
import {
  DateRangeFilter,
  type DateRangePreset,
  type DateRangeValue,
} from "@/components/filters/DateRangeFilter"
import { PRODUCT_CATEGORIES_SORTED } from "@/lib/product-categories"
import { GENERAL_LLC_COMPANY } from "@/lib/supabase-mcp"

const LLC_COUNTRY_VALUE_PREFIX = "__llc_country__:"

function getLlcCountryValue(country: string): string {
  return `${LLC_COUNTRY_VALUE_PREFIX}${country}`
}

function parseLlcCountryValue(value: string): string | null {
  return value.startsWith(LLC_COUNTRY_VALUE_PREFIX)
    ? value.slice(LLC_COUNTRY_VALUE_PREFIX.length)
    : null
}

interface MedicosFiltersProps {
  companies: string[]
  llcCountries: string[]
  products: string[]
  medicos: string[]
  selectedCompanies: string[]
  selectedLlcCountries: string[]
  selectedProducts: string[]
  selectedMedicos: string[]
  selectedCategories: string[]
  fechaDesde: string
  fechaHasta: string
  fechaMin?: string
  fechaMax?: string
  datePresets?: DateRangePreset[]
  onCompaniesChange: (companies: string[]) => void
  onLlcCountriesChange: (countries: string[]) => void
  onProductsChange: (products: string[]) => void
  onMedicosChange: (medicos: string[]) => void
  onCategoriesChange: (categories: string[]) => void
  onDateRangeChange: (range: DateRangeValue) => void
  showAllCompanies?: boolean
}

export function MedicosFilters({
  companies,
  llcCountries,
  products,
  medicos,
  selectedCompanies,
  selectedLlcCountries,
  selectedProducts,
  selectedMedicos,
  selectedCategories,
  fechaDesde,
  fechaHasta,
  fechaMin,
  fechaMax,
  datePresets = [],
  onCompaniesChange,
  onLlcCountriesChange,
  onProductsChange,
  onMedicosChange,
  onCategoriesChange,
  onDateRangeChange,
  showAllCompanies = true,
}: MedicosFiltersProps) {
  const selectedCompaniesEffective = selectedCompanies.length ? selectedCompanies : companies
  const llcCountriesEffective = selectedLlcCountries.length ? selectedLlcCountries : llcCountries
  const llcIsSelected = selectedCompaniesEffective.includes(GENERAL_LLC_COMPANY)
  const orderedCompanies = [
    ...companies.filter((company) => company !== GENERAL_LLC_COMPANY),
    ...companies.filter((company) => company === GENERAL_LLC_COMPANY),
  ]

  const companyOptions: MultiSelectOption[] = orderedCompanies.flatMap((company) => {
    if (company !== GENERAL_LLC_COMPANY || !llcCountries.length) {
      return [{ value: company, label: company }]
    }

    return [
      { value: company, label: company },
      ...llcCountries.map((country) => ({
        value: getLlcCountryValue(country),
        label: country,
        indentLevel: 1,
      })),
    ]
  })

  const selectedCompanyValues = [
    ...selectedCompaniesEffective,
    ...(llcIsSelected ? llcCountriesEffective.map((country) => getLlcCountryValue(country)) : []),
  ]

  function applyCompanySelection(nextCompanies: string[], nextLlcCountries: string[]) {
    const validCompanies = nextCompanies.filter((company, index) => (
      companies.includes(company) && nextCompanies.indexOf(company) === index
    ))

    const hasLlc = validCompanies.includes(GENERAL_LLC_COMPANY)
    const validLlcCountries = hasLlc
      ? nextLlcCountries.filter((country, index) => (
          llcCountries.includes(country) && nextLlcCountries.indexOf(country) === index
        ))
      : []

    onCompaniesChange(validCompanies.length ? validCompanies : selectedCompaniesEffective)
    onLlcCountriesChange(
      hasLlc
        ? (validLlcCountries.length ? validLlcCountries : llcCountries)
        : []
    )
  }

  function handleCombinedCompanyChange(values: string[]) {
    const parsedCompanies = values.filter((value) => !parseLlcCountryValue(value))
    const parsedLlcCountries = values
      .map((value) => parseLlcCountryValue(value))
      .filter((value): value is string => Boolean(value))

    const nextCompanies = parsedLlcCountries.length
      ? Array.from(new Set([...parsedCompanies, GENERAL_LLC_COMPANY]))
      : parsedCompanies

    applyCompanySelection(nextCompanies, parsedLlcCountries)
  }

  function handleCompanyToggle(value: string) {
    const llcCountry = parseLlcCountryValue(value)
    if (llcCountry) {
      if (!llcIsSelected) {
        applyCompanySelection(
          [...selectedCompaniesEffective, GENERAL_LLC_COMPANY],
          [llcCountry]
        )
        return
      }

      const isSelected = llcCountriesEffective.includes(llcCountry)
      if (isSelected) {
        const nextLlcCountries = llcCountriesEffective.filter((country) => country !== llcCountry)
        if (!nextLlcCountries.length) {
          const otherCompanies = selectedCompaniesEffective.filter((company) => company !== GENERAL_LLC_COMPANY)
          if (!otherCompanies.length) return
          applyCompanySelection(otherCompanies, [])
          return
        }
        applyCompanySelection(selectedCompaniesEffective, nextLlcCountries)
        return
      }

      applyCompanySelection(selectedCompaniesEffective, [...llcCountriesEffective, llcCountry])
      return
    }

    const isSelected = selectedCompaniesEffective.includes(value)
    if (isSelected) {
      const nextCompanies = selectedCompaniesEffective.filter((company) => company !== value)
      if (!nextCompanies.length) return
      applyCompanySelection(
        nextCompanies,
        value === GENERAL_LLC_COMPANY ? [] : llcCountriesEffective
      )
      return
    }

    applyCompanySelection(
      [...selectedCompaniesEffective, value],
      value === GENERAL_LLC_COMPANY ? llcCountries : llcCountriesEffective
    )
  }

  function handleCompanySelectOnly(value: string) {
    const llcCountry = parseLlcCountryValue(value)
    if (llcCountry) {
      applyCompanySelection([GENERAL_LLC_COMPANY], [llcCountry])
      return
    }

    applyCompanySelection(
      [value],
      value === GENERAL_LLC_COMPANY ? llcCountries : []
    )
  }

  const categoryOptions: MultiSelectOption[] = PRODUCT_CATEGORIES_SORTED.map((c) => ({
    value: c,
    label: c,
  }))

  return (
    <div className="relative z-40 rounded-lg border border-white/20 bg-white/10 p-4 shadow-sm backdrop-blur-sm">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5 xl:items-start">
      <div className="min-w-0">
      <MultiCheckboxDropdown
        label="Compañía"
        options={companyOptions}
        selectedValues={selectedCompanyValues}
        onSelectedValuesChange={handleCombinedCompanyChange}
        onOptionToggle={handleCompanyToggle}
        onOptionSelectOnly={handleCompanySelectOnly}
        allLabel={showAllCompanies ? "Todas las compañías" : "Todas (mis compañías)"}
      />
      </div>

      <div className="min-w-0">
      <MultiCheckboxDropdown
        label="Categoría"
        options={categoryOptions}
        selectedValues={
          selectedCategories.length ? selectedCategories : PRODUCT_CATEGORIES_SORTED
        }
        onSelectedValuesChange={onCategoriesChange}
        allLabel="Todas las categorías"
      />
      </div>

      <div className="min-w-0">
      <ProductMultiSearchFilter
        products={products}
        selectedProducts={selectedProducts}
        onSelectedProductsChange={onProductsChange}
        disabled={products.length === 0}
        allLabel="Todos los productos"
      />
      </div>

      <div className="min-w-0">
      <MedicoMultiSearchFilter
        medicos={medicos}
        selectedMedicos={selectedMedicos}
        onSelectedMedicosChange={onMedicosChange}
        disabled={medicos.length === 0}
        allLabel="Todos los médicos"
      />
      </div>

      <div className="min-w-0 sm:col-span-2 xl:col-span-1">
      <DateRangeFilter
        label="Período"
        fechaDesde={fechaDesde}
        fechaHasta={fechaHasta}
        minDate={fechaMin}
        maxDate={fechaMax}
        presets={datePresets}
        onChange={onDateRangeChange}
        className="w-full"
      />
      </div>
      </div>
    </div>
  )
}
