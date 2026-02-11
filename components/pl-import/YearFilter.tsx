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
      <label className="text-sm font-medium">Año</label>
      <Select
        value={selectedYear}
        onChange={(e) => onYearChange(e.target.value)}
        className="w-full"
      >
        <option value="Todos">Todos</option>
        {years.map((year) => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
      </Select>
    </div>
  )
}
