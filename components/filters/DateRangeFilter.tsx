"use client"

import { Select } from "@/components/ui/select"

export type DateRangeValue = {
  fechaDesde: string
  fechaHasta: string
}

export type DateRangePreset = {
  id: string
  label: string
  fechaDesde: string
  fechaHasta: string
}

const inputClass =
  "w-full rounded-md border border-white/20 bg-white/10 px-2 py-2 text-sm text-white focus:border-white/30 focus:ring-white/30 [color-scheme:dark]"

export function DateRangeFilter({
  label = "Período",
  fechaDesde,
  fechaHasta,
  minDate,
  maxDate,
  presets = [],
  onChange,
  className,
}: {
  label?: string
  fechaDesde: string
  fechaHasta: string
  minDate?: string
  maxDate?: string
  presets?: DateRangePreset[]
  onChange: (next: DateRangeValue) => void
  className?: string
}) {
  const applyRange = (desde: string, hasta: string) => {
    let d = desde
    let h = hasta
    if (minDate && d < minDate) d = minDate
    if (maxDate && h > maxDate) h = maxDate
    if (d > h) [d, h] = [h, d]
    onChange({ fechaDesde: d, fechaHasta: h })
  }

  const activePresetId =
    presets.find((p) => p.fechaDesde === fechaDesde && p.fechaHasta === fechaHasta)?.id ?? ""

  return (
    <div className={className}>
      <label className="text-sm font-medium text-white/90">{label}</label>
      <div className="mt-2 space-y-2">
        {presets.length > 0 && (
          <Select
            value={activePresetId}
            onChange={(e) => {
              const preset = presets.find((p) => p.id === e.target.value)
              if (preset) applyRange(preset.fechaDesde, preset.fechaHasta)
            }}
            className="w-full bg-white/10 border-white/20 text-white focus:border-white/30 focus:ring-white/30"
          >
            <option value="" className="bg-blue-900 text-white">
              Rango personalizado
            </option>
            {presets.map((p) => (
              <option key={p.id} value={p.id} className="bg-blue-900 text-white">
                {p.label}
              </option>
            ))}
          </Select>
        )}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="mb-1 block text-[11px] text-white/55">Desde</span>
            <input
              type="date"
              value={fechaDesde}
              min={minDate}
              max={maxDate ?? fechaHasta}
              onChange={(e) => applyRange(e.target.value, fechaHasta)}
              className={inputClass}
            />
          </div>
          <div>
            <span className="mb-1 block text-[11px] text-white/55">Hasta</span>
            <input
              type="date"
              value={fechaHasta}
              min={minDate ?? fechaDesde}
              max={maxDate}
              onChange={(e) => applyRange(fechaDesde, e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
