"use client"

import { Select } from "@/components/ui/select"
import { ProductSearchFilter } from "@/components/dashboard/ProductSearchFilter"

interface BudgetFiltersProps {
  selectedYear: number
  selectedCountry: string
  selectedProduct: string
  selectedMonth: string
  onYearChange: (year: number) => void
  onCountryChange: (country: string) => void
  onProductChange: (product: string) => void
  onMonthChange: (month: string) => void
  countries?: string[]
  products?: string[]
  allowedCountries?: string[]
  showAllCountries?: boolean
}

const MONTHS = [
  { value: "all", label: "Todos los meses" },
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
  selectedCountry,
  selectedProduct,
  selectedMonth,
  onYearChange,
  onCountryChange,
  onProductChange,
  onMonthChange,
  products = [],
  allowedCountries,
  showAllCountries = true,
}: BudgetFiltersProps) {
  // Admins: "Todos los países" + todos. No-admins: solo países permitidos; si tiene varios, también "Todos (mis países)".
  const filteredCountries = allowedCountries?.length
    ? countries.filter(
        (c) =>
          (c.code === "all" && (showAllCountries || allowedCountries.length > 1)) ||
          allowedCountries.includes(c.code)
      )
    : showAllCountries
      ? countries
      : countries.filter((c) => c.code !== "all")

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
        <Select
          value={selectedMonth}
          onChange={(e) => onMonthChange(e.target.value)}
          className="w-full bg-white/10 border-white/20 text-white focus:border-white/30 focus:ring-white/30"
        >
          {MONTHS.map((month) => (
            <option key={month.value} value={month.value} className="bg-blue-900 text-white">
              {month.label}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-white/90">País</label>
        <Select
          value={selectedCountry}
          onChange={(e) => onCountryChange(e.target.value)}
          className="w-full bg-white/10 border-white/20 text-white focus:border-white/30 focus:ring-white/30"
        >
          {filteredCountries.map((country) => (
            <option key={country.code} value={country.code} className="bg-blue-900 text-white">
              {country.code === "all" && !showAllCountries && allowedCountries?.length
                ? "Todos (mis países)"
                : country.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <ProductSearchFilter
          products={products}
          selectedProduct={selectedProduct === "all" ? "all" : selectedProduct}
          onProductChange={(value) => onProductChange(value)}
          allValue="all"
          allLabel="Todos los productos"
        />
      </div>
    </div>
  )
}

