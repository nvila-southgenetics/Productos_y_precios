"use client"

import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"

interface ProductFiltersProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  selectedCategory: string
  onCategoryChange: (category: string) => void
  selectedTipo: string
  onTipoChange: (tipo: string) => void
  categories: string[]
  tipos: string[]
  /** Filtro de revisados: all | reviewed | not_reviewed */
  reviewFilter: string
  onReviewFilterChange: (value: string) => void
  /** Ordenamiento: name | sales_desc */
  sortBy: string
  onSortByChange: (value: string) => void
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
  reviewFilter,
  onReviewFilterChange,
  sortBy,
  onSortByChange,
}: ProductFiltersProps) {
  return (
    <div className="flex flex-wrap gap-4 items-center">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/60" />
        <Input
          placeholder="Buscar productos..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:border-white/30 focus:ring-white/30"
        />
      </div>
      <Select
        value={selectedCategory}
        onChange={(e) => onCategoryChange(e.target.value)}
        className="w-[180px] bg-white/10 border-white/20 text-white focus:border-white/30 focus:ring-white/30"
      >
        <option value="" className="bg-blue-900 text-white">Todas las categorías</option>
        {categories.map((cat) => (
          <option key={cat} value={cat} className="bg-blue-900 text-white">
            {cat}
          </option>
        ))}
      </Select>
      <Select
        value={selectedTipo}
        onChange={(e) => onTipoChange(e.target.value)}
        className="w-[180px] bg-white/10 border-white/20 text-white focus:border-white/30 focus:ring-white/30"
      >
        <option value="" className="bg-blue-900 text-white">Todos los tipos</option>
        {tipos.map((tipo) => (
          <option key={tipo} value={tipo} className="bg-blue-900 text-white">
            {tipo}
          </option>
        ))}
      </Select>
      <Select
        value={reviewFilter}
        onChange={(e) => onReviewFilterChange(e.target.value)}
        className="w-[190px] bg-white/10 border-white/20 text-white focus:border-white/30 focus:ring-white/30"
      >
        <option value="all" className="bg-blue-900 text-white">Todos (revisados y no)</option>
        <option value="reviewed" className="bg-blue-900 text-white">Solo revisados</option>
        <option value="not_reviewed" className="bg-blue-900 text-white">Solo no revisados</option>
      </Select>
      <Select
        value={sortBy}
        onChange={(e) => onSortByChange(e.target.value)}
        className="w-[190px] bg-white/10 border-white/20 text-white focus:border-white/30 focus:ring-white/30"
      >
        <option value="name" className="bg-blue-900 text-white">Ordenar por nombre (A-Z)</option>
        <option value="sales_desc" className="bg-blue-900 text-white">Ordenar por ventas totales</option>
      </Select>
    </div>
  )
}



