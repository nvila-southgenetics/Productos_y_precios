"use client"

import { ProductMultiSearchFilter } from "@/components/dashboard/ProductMultiSearchFilter"
import { MedicoMultiSearchFilter } from "@/components/medicos/MedicoMultiSearchFilter"
import { MultiCheckboxDropdown, type MultiSelectOption } from "@/components/filters/MultiCheckboxDropdown"
import { MonthRangeFilter } from "@/components/filters/MonthRangeFilter"

interface MedicosFiltersProps {
  companies: string[]
  products: string[]
  medicos: string[]
  selectedCompanies: string[]
  selectedProducts: string[]
  selectedMedicos: string[]
  monthFrom: number
  monthTo: number
  onCompaniesChange: (companies: string[]) => void
  onProductsChange: (products: string[]) => void
  onMedicosChange: (medicos: string[]) => void
  onMonthRangeChange: (range: { fromMonth: number; toMonth: number }) => void
  showAllCompanies?: boolean
}

export function MedicosFilters({
  companies,
  products,
  medicos,
  selectedCompanies,
  selectedProducts,
  selectedMedicos,
  monthFrom,
  monthTo,
  onCompaniesChange,
  onProductsChange,
  onMedicosChange,
  onMonthRangeChange,
  showAllCompanies = true,
}: MedicosFiltersProps) {
  const companyOptions: MultiSelectOption[] = companies.map((c) => ({
    value: c,
    label: c,
  }))

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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

      <MedicoMultiSearchFilter
        medicos={medicos}
        selectedMedicos={selectedMedicos}
        onSelectedMedicosChange={onMedicosChange}
        disabled={medicos.length === 0}
        allLabel="Todos los médicos"
      />

      <MonthRangeFilter
        label="Mes"
        fromMonth={monthFrom}
        toMonth={monthTo}
        onChange={onMonthRangeChange}
      />
    </div>
  )
}
