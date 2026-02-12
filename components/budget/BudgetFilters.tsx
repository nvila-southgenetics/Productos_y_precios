"use client"

import { Select } from "@/components/ui/select"

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
  { code: "CL", name: "Chile" },
  { code: "UY", name: "Uruguay" },
  { code: "AR", name: "Argentina" },
  { code: "MX", name: "México" },
  { code: "CO", name: "Colombia" },
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
}: BudgetFiltersProps) {
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
          {countries.map((country) => (
            <option key={country.code} value={country.code} className="bg-blue-900 text-white">
              {country.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-white/90">Producto</label>
        <Select
          value={selectedProduct}
          onChange={(e) => onProductChange(e.target.value)}
          className="w-full bg-white/10 border-white/20 text-white focus:border-white/30 focus:ring-white/30"
        >
          <option value="all" className="bg-blue-900 text-white">Todos los productos</option>
          {products.map((product) => (
            <option key={product} value={product} className="bg-blue-900 text-white">
              {product}
            </option>
          ))}
        </Select>
      </div>
    </div>
  )
}

