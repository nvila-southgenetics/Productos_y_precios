"use client"

import { Select } from "@/components/ui/select"

const MONTHS = [
  { value: 1, label: "Enero" },
  { value: 2, label: "Febrero" },
  { value: 3, label: "Marzo" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Mayo" },
  { value: 6, label: "Junio" },
  { value: 7, label: "Julio" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Septiembre" },
  { value: 10, label: "Octubre" },
  { value: 11, label: "Noviembre" },
  { value: 12, label: "Diciembre" },
]

export function MonthRangeFilter({
  label = "Mes",
  fromMonth,
  toMonth,
  onChange,
  className,
}: {
  label?: string
  fromMonth: number
  toMonth: number
  onChange: (next: { fromMonth: number; toMonth: number }) => void
  className?: string
}) {
  const safeFrom = Math.min(Math.max(fromMonth, 1), 12)
  const safeTo = Math.min(Math.max(toMonth, 1), 12)

  return (
    <div className={className}>
      <label className="text-sm font-medium text-white/90">{label}</label>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Select
          value={String(safeFrom)}
          onChange={(e) => {
            const nextFrom = Number(e.target.value)
            const nextTo = Math.max(nextFrom, safeTo)
            onChange({ fromMonth: nextFrom, toMonth: nextTo })
          }}
          className="w-full bg-white/10 border-white/20 text-white focus:border-white/30 focus:ring-white/30"
        >
          {MONTHS.map((m) => (
            <option key={m.value} value={m.value} className="bg-blue-900 text-white">
              Desde {m.label}
            </option>
          ))}
        </Select>
        <Select
          value={String(safeTo)}
          onChange={(e) => {
            const nextTo = Number(e.target.value)
            const nextFrom = Math.min(safeFrom, nextTo)
            onChange({ fromMonth: nextFrom, toMonth: nextTo })
          }}
          className="w-full bg-white/10 border-white/20 text-white focus:border-white/30 focus:ring-white/30"
        >
          {MONTHS.map((m) => (
            <option key={m.value} value={m.value} className="bg-blue-900 text-white">
              Hasta {m.label}
            </option>
          ))}
        </Select>
      </div>
    </div>
  )
}

export function monthsFromRange(range: { fromMonth: number; toMonth: number }): string[] {
  const from = Math.min(Math.max(range.fromMonth, 1), 12)
  const to = Math.min(Math.max(range.toMonth, 1), 12)
  const start = Math.min(from, to)
  const end = Math.max(from, to)
  return Array.from({ length: end - start + 1 }, (_, i) => String(start + i))
}

