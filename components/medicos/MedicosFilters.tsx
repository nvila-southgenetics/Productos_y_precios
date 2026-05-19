"use client"

import { ProductMultiSearchFilter } from "@/components/dashboard/ProductMultiSearchFilter"
import { MedicoMultiSearchFilter } from "@/components/medicos/MedicoMultiSearchFilter"
import { MultiCheckboxDropdown, type MultiSelectOption } from "@/components/filters/MultiCheckboxDropdown"
import { MonthRangeFilter } from "@/components/filters/MonthRangeFilter"
import { PRODUCT_CATEGORIES_SORTED } from "@/lib/product-categories"

interface MedicosFiltersProps {
  companies: string[]
  products: string[]
  medicos: string[]
  selectedCompanies: string[]
  selectedProducts: string[]
  selectedMedicos: string[]
  selectedCategories: string[]
  monthFrom: number
  monthTo: number
  onCompaniesChange: (companies: string[]) => void
  onProductsChange: (products: string[]) => void
  onMedicosChange: (medicos: string[]) => void
  onCategoriesChange: (categories: string[]) => void
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
  selectedCategories,
  monthFrom,
  monthTo,
  onCompaniesChange,
  onProductsChange,
  onMedicosChange,
  onCategoriesChange,
  onMonthRangeChange,
  showAllCompanies = true,
}: MedicosFiltersProps) {
  const companyOptions: MultiSelectOption[] = companies.map((c) => ({
    value: c,
    label: c,
  }))

  const categoryOptions: MultiSelectOption[] = PRODUCT_CATEGORIES_SORTED.map((c) => ({
    value: c,
    label: c,
  }))

  return (
    <div className="relative z-40 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
      <MultiCheckboxDropdown
        label="Compañía"
        options={companyOptions}
        selectedValues={
          selectedCompanies.length ? selectedCompanies : companies.map((c) => c)
        }
        onSelectedValuesChange={onCompaniesChange}
        allLabel={showAllCompanies ? "Todas las compañías" : "Todas (mis compañías)"}
      />

      <MultiCheckboxDropdown
        label="Categoría"
        options={categoryOptions}
        selectedValues={
          selectedCategories.length ? selectedCategories : PRODUCT_CATEGORIES_SORTED
        }
        onSelectedValuesChange={onCategoriesChange}
        allLabel="Todas las categorías"
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
