"use client"

import { ProductMultiSearchFilter } from "@/components/dashboard/ProductMultiSearchFilter"

interface ProductFilterProps {
  products: string[]
  /** Array vacío = todos. */
  selectedProducts: string[]
  onProductsChange: (products: string[]) => void
}

export function ProductFilter({ products, selectedProducts, onProductsChange }: ProductFilterProps) {
  return (
    <ProductMultiSearchFilter
      products={products}
      selectedProducts={selectedProducts}
      onSelectedProductsChange={onProductsChange}
      allLabel="Todos"
    />
  )
}



