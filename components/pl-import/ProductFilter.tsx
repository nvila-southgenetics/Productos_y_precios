"use client"

import { Select } from "@/components/ui/select"

interface ProductFilterProps {
  products: string[]
  selectedProduct: string
  onProductChange: (product: string) => void
}

export function ProductFilter({
  products,
  selectedProduct,
  onProductChange,
}: ProductFilterProps) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium">Producto</label>
      <Select
        value={selectedProduct}
        onChange={(e) => onProductChange(e.target.value)}
        className="w-full"
      >
        <option value="Todos">Todos</option>
        {products.map((product) => (
          <option key={product} value={product}>
            {product}
          </option>
        ))}
      </Select>
    </div>
  )
}



