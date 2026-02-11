"use client"

import { Select } from "@/components/ui/select"

interface MonthFilterProps {
  selectedMonth: string
  onMonthChange: (month: string) => void
}

const MONTHS = [
  { value: "Todos", label: "Todos los meses" },
  { value: "01", label: "Enero" },
  { value: "02", label: "Febrero" },
  { value: "03", label: "Marzo" },
  { value: "04", label: "Abril" },
  { value: "05", label: "Mayo" },
  { value: "06", label: "Junio" },
  { value: "07", label: "Julio" },
  { value: "08", label: "Agosto" },
  { value: "09", label: "Septiembre" },
  { value: "10", label: "Octubre" },
  { value: "11", label: "Noviembre" },
  { value: "12", label: "Diciembre" },
]

export function MonthFilter({
  selectedMonth,
  onMonthChange,
}: MonthFilterProps) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium">Mes</label>
      <Select
        value={selectedMonth}
        onChange={(e) => onMonthChange(e.target.value)}
        className="w-full"
      >
        {MONTHS.map((month) => (
          <option key={month.value} value={month.value}>
            {month.label}
          </option>
        ))}
      </Select>
    </div>
  )
}
