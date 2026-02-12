"use client"

import { Select } from "@/components/ui/select"

interface YearFilterProps {
  years: string[]
  selectedYear: string
  onYearChange: (year: string) => void
}

export function YearFilter({
  years,
  selectedYear,
  onYearChange,
}: YearFilterProps) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-white/90">Año</label>
      <Select
        value={selectedYear}
        onChange={(e) => onYearChange(e.target.value)}
        className="w-full bg-white/10 border-white/20 text-white focus:border-white/30 focus:ring-white/30"
      >
        <option value="Todos" className="bg-blue-900 text-white">Todos</option>
        {years.map((year) => (
          <option key={year} value={year} className="bg-blue-900 text-white">
            {year}
          </option>
        ))}
      </Select>
    </div>
  )
}
