"use client"

import { Select } from "@/components/ui/select"
import type { ProductBusinessGroup } from "@/lib/product-categories"

interface BusinessGroupFilterProps {
  value: ProductBusinessGroup
  onChange: (group: ProductBusinessGroup) => void
  className?: string
}

export function BusinessGroupFilter({ value, onChange, className }: BusinessGroupFilterProps) {
  return (
    <div className={className ?? "flex flex-col gap-2"}>
      <label className="text-sm font-medium text-white/90">Tipo</label>
      <Select
        value={value}
        onChange={(e) => onChange(e.target.value as ProductBusinessGroup)}
        className="w-full bg-white/10 border-white/20 text-white focus:border-white/30 focus:ring-white/30"
      >
        <option value="all" className="bg-blue-900 text-white">
          Anualidades y test
        </option>
        <option value="anualidades" className="bg-blue-900 text-white">
          Solo anualidades
        </option>
        <option value="test" className="bg-blue-900 text-white">
          Solo test
        </option>
      </Select>
    </div>
  )
}
