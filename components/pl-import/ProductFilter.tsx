"use client"

import { ProductSearchFilter } from "@/components/dashboard/ProductSearchFilter"

interface ProductFilterProps {
  products: string[]
  selectedProduct: string
  onProductChange: (product: string) => void
}

export function ProductFilter({ products, selectedProduct, onProductChange }: ProductFilterProps) {
  return (
    <ProductSearchFilter
      products={products}
      selectedProduct={selectedProduct}
      onProductChange={onProductChange}
      allValue="Todos"
      allLabel="Todos"
    />
  )
}



