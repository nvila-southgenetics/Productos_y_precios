"use client"

import { ProductMultiSearchFilter } from "@/components/dashboard/ProductMultiSearchFilter"

interface DashboardFiltersProps {
  companies: string[]
  products: string[]
  availableYears: string[]
  selectedCompany: string
  /** Array vacío = todos. */
  selectedProducts: string[]
  selectedYear: string
  selectedMonth: string
  selectedChannel: string
  onCompanyChange: (company: string) => void
  onProductsChange: (products: string[]) => void
  onYearChange: (year: string) => void
  onMonthChange: (month: string) => void
  onChannelChange: (channel: string) => void
  showAllCompanies?: boolean
}

export function DashboardFilters({
  companies,
  products,
  availableYears,
  selectedCompany,
  selectedProducts,
  selectedYear,
  selectedMonth,
  selectedChannel,
  onCompanyChange,
  onProductsChange,
  onYearChange,
  onMonthChange,
  onChannelChange,
  showAllCompanies = true,
}: DashboardFiltersProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-white/90">Compañía</label>
        <select
          value={selectedCompany}
          onChange={(e) => onCompanyChange(e.target.value)}
          className="w-full h-10 rounded-md border border-white/20 bg-white/10 backdrop-blur-sm px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/30 focus:ring-offset-2 focus:ring-offset-transparent disabled:cursor-not-allowed disabled:opacity-50"
        >
          {showAllCompanies && (
            <option value="Todas las compañías" className="bg-blue-900 text-white">
              Todas las compañías
            </option>
          )}
          {companies.map((company) => (
            <option key={company} value={company} className="bg-blue-900 text-white">
              {company}
            </option>
          ))}
        </select>
      </div>

      <ProductMultiSearchFilter
        products={products}
        selectedProducts={selectedProducts}
        onSelectedProductsChange={onProductsChange}
        disabled={products.length === 0}
        allLabel="Todos los productos"
      />

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-white/90">Año</label>
        <select
          value={selectedYear}
          onChange={(e) => onYearChange(e.target.value)}
          className="w-full h-10 rounded-md border border-white/20 bg-white/10 backdrop-blur-sm px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/30 focus:ring-offset-2 focus:ring-offset-transparent disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="Todos" className="bg-blue-900 text-white">
            Todos
          </option>
          {availableYears.map((year) => (
            <option key={year} value={year} className="bg-blue-900 text-white">
              {year}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-white/90">Mes</label>
        <select
          value={selectedMonth}
          onChange={(e) => onMonthChange(e.target.value)}
          className="w-full h-10 rounded-md border border-white/20 bg-white/10 backdrop-blur-sm px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/30 focus:ring-offset-2 focus:ring-offset-transparent disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="Todos" className="bg-blue-900 text-white">Todos los meses</option>
          <option value="01" className="bg-blue-900 text-white">Enero</option>
          <option value="02" className="bg-blue-900 text-white">Febrero</option>
          <option value="03" className="bg-blue-900 text-white">Marzo</option>
          <option value="04" className="bg-blue-900 text-white">Abril</option>
          <option value="05" className="bg-blue-900 text-white">Mayo</option>
          <option value="06" className="bg-blue-900 text-white">Junio</option>
          <option value="07" className="bg-blue-900 text-white">Julio</option>
          <option value="08" className="bg-blue-900 text-white">Agosto</option>
          <option value="09" className="bg-blue-900 text-white">Septiembre</option>
          <option value="10" className="bg-blue-900 text-white">Octubre</option>
          <option value="11" className="bg-blue-900 text-white">Noviembre</option>
          <option value="12" className="bg-blue-900 text-white">Diciembre</option>
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-white/90">Canal</label>
        <select
          value={selectedChannel}
          onChange={(e) => onChannelChange(e.target.value)}
          className="w-full h-10 rounded-md border border-white/20 bg-white/10 backdrop-blur-sm px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/30 focus:ring-offset-2 focus:ring-offset-transparent disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="Todos los canales" className="bg-blue-900 text-white">
            Todos los canales
          </option>
          <option value="Paciente" className="bg-blue-900 text-white">
            Paciente
          </option>
          <option value="Gobierno" className="bg-blue-900 text-white">
            Gobierno
          </option>
          <option value="Instituciones SFL" className="bg-blue-900 text-white">
            Instituciones SFL
          </option>
          <option value="Aseguradoras" className="bg-blue-900 text-white">
            Aseguradoras
          </option>
          <option value="Distribuidores" className="bg-blue-900 text-white">
            Distribuidores
          </option>
        </select>
      </div>
    </div>
  )
}
