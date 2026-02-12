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
      <label className="text-sm font-medium text-white/90">Producto</label>
      <Select
        value={selectedProduct}
        onChange={(e) => onProductChange(e.target.value)}
        className="w-full bg-white/10 border-white/20 text-white focus:border-white/30 focus:ring-white/30"
      >
        <option value="Todos" className="bg-blue-900 text-white">Todos</option>
        {products.map((product) => (
          <option key={product} value={product} className="bg-blue-900 text-white">
            {product}
          </option>
        ))}
      </Select>
    </div>
  )
}



