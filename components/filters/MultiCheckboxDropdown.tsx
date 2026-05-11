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

  /** Cada casilla sólo suma o quita ese valor (nunca fuerza «solo uno» cuando estaban todos). */
  const toggle = (v: string) => {
    const next = selectedValues.includes(v) ? selectedValues.filter((x) => x !== v) : [...selectedValues, v]
    // Sin selección ninguna: comportamiento anterior (evita filtros vacíos que rompan consultas).
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
          <div className="mt-1 w-full min-w-[320px] max-w-[90vw] rounded-md border border-white/20 bg-blue-950/95 backdrop-blur-sm py-2 shadow-lg max-h-64 overflow-y-auto overflow-x-auto">
            <div
              role="button"
              tabIndex={0}
              onClick={() => {
                onSelectedValuesChange(allValues)
                setOpen(false)
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  onSelectedValuesChange(allValues)
                  setOpen(false)
                }
              }}
              className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-sm text-white/90 outline-none hover:bg-white/10 focus-visible:bg-white/10"
            >
              <span className="pointer-events-none shrink-0">
                <Checkbox checked={isAll} />
              </span>
              <span className="min-w-0 flex-1 text-left whitespace-nowrap">{allLabel}</span>
            </div>
            {options.map((opt) => (
              <div
                key={opt.value}
                role="button"
                tabIndex={0}
                onClick={() => toggle(opt.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    toggle(opt.value)
                  }
                }}
                className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-sm text-white/90 outline-none hover:bg-white/10 focus-visible:bg-white/10"
              >
                {/* Evita nesting interactivo (button+checkbox) que en algunos browsers dispara dos eventos */}
                <span className="pointer-events-none shrink-0">
                  <Checkbox checked={selectedValues.includes(opt.value)} />
                </span>
                <span className="min-w-0 flex-1 text-left whitespace-nowrap">{opt.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

