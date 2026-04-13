"use client"

import { ProductMultiSearchFilter } from "@/components/dashboard/ProductMultiSearchFilter"
import { MultiCheckboxDropdown, type MultiSelectOption } from "@/components/filters/MultiCheckboxDropdown"
import { MonthRangeFilter } from "@/components/filters/MonthRangeFilter"
import { Select } from "@/components/ui/select"

const CHANNEL_OPTIONS: MultiSelectOption[] = [
  { value: "Todos los canales", label: "Todos los canales" },
  { value: "Paciente", label: "Paciente" },
  { value: "Gobierno", label: "Gobierno" },
  { value: "Instituciones SFL", label: "Instituciones SFL" },
  { value: "Aseguradoras", label: "Aseguradoras" },
  { value: "Distribuidores", label: "Distribuidores" },
]

const selectClass =
  "w-full h-10 rounded-md border border-white/20 bg-white/10 backdrop-blur-sm px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/30 focus:ring-offset-0 focus:ring-offset-transparent"

interface DashboardFiltersProps {
  companies: string[]
  products: string[]
  availableYears: string[]
  selectedCompanies: string[]
  /** Array vacío = todos. */
  selectedProducts: string[]
  selectedYear: string
  monthFrom: number
  monthTo: number
  selectedChannel: string
  onCompaniesChange: (companies: string[]) => void
  onProductsChange: (products: string[]) => void
  onYearChange: (year: string) => void
  onMonthRangeChange: (range: { fromMonth: number; toMonth: number }) => void
  onChannelChange: (channel: string) => void
  showAllCompanies?: boolean
}

export function DashboardFilters({
  companies,
  products,
  availableYears,
  selectedCompanies,
  selectedProducts,
  selectedYear,
  monthFrom,
  monthTo,
  selectedChannel,
  onCompaniesChange,
  onProductsChange,
  onYearChange,
  onMonthRangeChange,
  onChannelChange,
  showAllCompanies = true,
}: DashboardFiltersProps) {
  const companyOptions: MultiSelectOption[] = companies.map((c) => ({
    value: c,
    label: c,
  }))

  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
      <MultiCheckboxDropdown
        label="Compañía"
        options={companyOptions}
        selectedValues={
          selectedCompanies.length ? selectedCompanies : companies.map((c) => c)
        }
        onSelectedValuesChange={onCompaniesChange}
        allLabel={showAllCompanies ? "Todas las compañías" : "Todas (mis compañías)"}
      />

      <ProductMultiSearchFilter
        products={products}
        selectedProducts={selectedProducts}
        onSelectedProductsChange={onProductsChange}
        disabled={products.length === 0}
        allLabel="Todos los productos"
      />

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-white/90">Año</label>
        <Select value={selectedYear} onChange={(e) => onYearChange(e.target.value)} className={selectClass}>
          <option value="Todos" className="bg-blue-900 text-white">
            Todos
          </option>
          {availableYears.map((year) => (
            <option key={year} value={year} className="bg-blue-900 text-white">
              {year}
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

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-white/90">Canal</label>
        <Select value={selectedChannel} onChange={(e) => onChannelChange(e.target.value)} className={selectClass}>
          {CHANNEL_OPTIONS.map((ch) => (
            <option key={ch.value} value={ch.value} className="bg-blue-900 text-white">
              {ch.label}
            </option>
          ))}
        </Select>
      </div>
    </div>
  )
}
