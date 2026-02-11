"use client"

import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Button } from "@/components/ui/button"

interface ProductFiltersProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  selectedCategory: string
  onCategoryChange: (category: string) => void
  selectedTipo: string
  onTipoChange: (tipo: string) => void
  categories: string[]
  tipos: string[]
}

export function ProductFilters({
  searchQuery,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  selectedTipo,
  onTipoChange,
  categories,
  tipos,
}: ProductFiltersProps) {
  return (
    <div className="flex flex-wrap gap-4 items-center p-4 rounded-lg bg-blue-50/30 border border-blue-200/50">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-blue-600" />
        <Input
          placeholder="Buscar productos..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10 border-blue-200 focus:border-blue-400 focus:ring-blue-400"
        />
      </div>
      <Select
        value={selectedCategory}
        onChange={(e) => onCategoryChange(e.target.value)}
        className="w-[180px] border-blue-200 focus:border-blue-400"
      >
        <option value="">Todas las categorías</option>
        {categories.map((cat) => (
          <option key={cat} value={cat}>
            {cat}
          </option>
        ))}
      </Select>
      <Select
        value={selectedTipo}
        onChange={(e) => onTipoChange(e.target.value)}
        className="w-[180px] border-blue-200 focus:border-blue-400"
      >
        <option value="">Todos los tipos</option>
        {tipos.map((tipo) => (
          <option key={tipo} value={tipo}>
            {tipo}
          </option>
        ))}
      </Select>
      <Button variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-50 hover:border-blue-400">
        Ordenar
      </Button>
    </div>
  )
}



