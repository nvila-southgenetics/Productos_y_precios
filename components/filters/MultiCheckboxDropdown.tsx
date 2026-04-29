"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"

export type MultiSelectOption = { value: string; label: string }

export function MultiCheckboxDropdown({
  label,
  options,
  selectedValues,
  onSelectedValuesChange,
  allLabel,
  hideLabel = false,
  className,
}: {
  label: string
  options: MultiSelectOption[]
  selectedValues: string[]
  onSelectedValuesChange: (values: string[]) => void
  allLabel: string
  hideLabel?: boolean
  className?: string
}) {
  const [open, setOpen] = useState(false)

  const allValues = options.map((o) => o.value)
  const isAll =
    allValues.length > 0 &&
    selectedValues.length === allValues.length &&
    allValues.every((v) => selectedValues.includes(v))

  const display =
    isAll
      ? allLabel
      : selectedValues.length === 1
        ? options.find((o) => o.value === selectedValues[0])?.label ?? selectedValues[0]
        : `${selectedValues.length} seleccionados`

  const toggle = (v: string) => {
    // UX: si está seleccionado "todo", al clickear una opción pasamos directo a esa opción sola.
    if (isAll && selectedValues.includes(v)) {
      onSelectedValuesChange([v])
      return
    }
    const next = selectedValues.includes(v) ? selectedValues.filter((x) => x !== v) : [...selectedValues, v]
    // Evitamos "0" selección: si se desmarca todo, volvemos a "todos".
    onSelectedValuesChange(next.length === 0 ? allValues : next)
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {!hideLabel && <label className="text-sm font-medium text-white/90">{label}</label>}
      <div className="w-full">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-md border px-3 py-2 text-sm",
            "bg-white/10 border-white/20 text-white focus:border-white/30 focus:ring-2 focus:ring-white/30 focus:ring-offset-0 focus:ring-offset-transparent"
          )}
          aria-label={`Alternar ${label}`}
        >
          <span className="truncate">{display}</span>
          <ChevronDown className={cn("h-4 w-4 opacity-70 transition-transform", open && "rotate-180")} />
        </button>

        {open && (
          <div className="mt-1 w-full rounded-md border border-white/20 bg-blue-950/95 backdrop-blur-sm py-2 shadow-lg max-h-64 overflow-y-auto">
            <button
              type="button"
              onClick={() => {
                onSelectedValuesChange(allValues)
                setOpen(false)
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-white/90 hover:bg-white/10"
            >
              <Checkbox checked={isAll} />
              {allLabel}
            </button>
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggle(opt.value)}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-white/90 hover:bg-white/10"
              >
                <Checkbox checked={selectedValues.includes(opt.value)} />
                <span className="min-w-0 flex-1 truncate text-left">{opt.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

