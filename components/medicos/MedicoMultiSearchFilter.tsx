"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ChevronDown, Search } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"

interface MedicoMultiSearchFilterProps {
  medicos: string[]
  selectedMedicos: string[]
  onSelectedMedicosChange: (medicos: string[]) => void
  disabled?: boolean
  allLabel?: string
}

export function MedicoMultiSearchFilter({
  medicos,
  selectedMedicos,
  onSelectedMedicosChange,
  disabled = false,
  allLabel = "Todos los médicos",
}: MedicoMultiSearchFilterProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const ref = useRef<HTMLDivElement>(null)

  const safeMedicos = useMemo(
    () => medicos.filter((m): m is string => typeof m === "string" && m.trim().length > 0),
    [medicos]
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return safeMedicos
    return safeMedicos.filter((m) => m.toLowerCase().includes(q))
  }, [safeMedicos, query])

  const selectedSet = useMemo(() => new Set(selectedMedicos), [selectedMedicos])

  const isAllSelected =
    selectedMedicos.length > 0 && selectedMedicos.length === safeMedicos.length

  const displayValue = useMemo(() => {
    if (selectedMedicos.length === 0) return allLabel
    if (selectedMedicos.length === safeMedicos.length) return allLabel
    if (selectedMedicos.length === 1) return selectedMedicos[0]
    return `${selectedMedicos.length} médicos`
  }, [allLabel, selectedMedicos, safeMedicos.length])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const toggleMedico = (medico: string) => {
    if (selectedSet.has(medico)) {
      onSelectedMedicosChange(selectedMedicos.filter((m) => m !== medico))
    } else {
      onSelectedMedicosChange([...selectedMedicos, medico])
    }
  }

  const selectOnlyMedico = (medico: string) => {
    onSelectedMedicosChange([medico])
  }

  const selectAll = () => onSelectedMedicosChange([...safeMedicos])
  const deselectAll = () => onSelectedMedicosChange([])

  const toggleSelectAllFiltered = () => {
    if (filtered.length === 0) return
    const filteredAllAreSelected = filtered.every((m) => selectedSet.has(m))
    if (filteredAllAreSelected) {
      onSelectedMedicosChange(selectedMedicos.filter((m) => !filtered.includes(m)))
    } else {
      const merged = new Set(selectedMedicos)
      filtered.forEach((m) => merged.add(m))
      onSelectedMedicosChange(Array.from(merged))
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-white/90">Médico</label>
      <div className="relative w-full" ref={ref}>
        <button
          type="button"
          onClick={() => !disabled && setOpen((o) => !o)}
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-md border px-3 py-2 text-sm text-left",
            "border-white/20 bg-white/10 backdrop-blur-sm text-white",
            "focus:outline-none focus:ring-2 focus:ring-white/30 focus:ring-offset-2 focus:ring-offset-transparent",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "hover:bg-white/15"
          )}
          disabled={disabled}
        >
          <span className="truncate">{displayValue}</span>
          <ChevronDown
            className={cn("h-4 w-4 opacity-70 shrink-0 transition-transform", open && "rotate-180")}
          />
        </button>
        {open && (
          <div className="absolute left-0 right-0 top-full z-[100] mt-1 w-full rounded-md border border-white/20 bg-blue-950/95 backdrop-blur-sm py-2 shadow-xl max-h-72 overflow-hidden flex flex-col">
            <div className="px-3 pb-2 border-b border-white/10 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={isAllSelected ? deselectAll : selectAll}
                  className="text-xs font-semibold text-white/80 hover:text-white transition-colors"
                >
                  {isAllSelected ? "Deseleccionar todo" : "Seleccionar todo"}
                </button>
                {selectedMedicos.length > 0 && (
                  <button
                    type="button"
                    onClick={deselectAll}
                    className="text-xs text-white/60 hover:text-white/80 transition-colors"
                  >
                    Reset
                  </button>
                )}
              </div>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-white/50" />
                <input
                  type="text"
                  placeholder="Escribir para buscar..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full h-9 pl-8 pr-3 rounded-md bg-white/10 border border-white/20 text-sm text-white placeholder:text-white/50 focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20"
                  autoFocus
                />
              </div>
              {query.trim() && filtered.length > 0 && (
                <button
                  type="button"
                  onClick={toggleSelectAllFiltered}
                  className="text-xs text-white/70 hover:text-white transition-colors text-left"
                >
                  {filtered.every((m) => selectedSet.has(m))
                    ? "Deseleccionar resultados"
                    : "Seleccionar resultados"}
                </button>
              )}
            </div>
            <div className="overflow-y-auto max-h-56">
              {filtered.map((medico) => {
                const checked = selectedSet.has(medico)
                return (
                  <div
                    key={medico}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-left text-white/90"
                  >
                    <span className="shrink-0 flex items-center rounded p-0.5 hover:bg-white/10 focus-within:bg-white/10">
                      <Checkbox checked={checked} onChange={() => toggleMedico(medico)} />
                    </span>
                    <span
                      role="button"
                      tabIndex={0}
                      className="min-w-0 flex-1 cursor-pointer rounded px-1 py-0.5 outline-none transition-colors hover:bg-white/10 focus-visible:bg-white/10"
                      onClick={() => selectOnlyMedico(medico)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault()
                          selectOnlyMedico(medico)
                        }
                      }}
                    >
                      {medico}
                    </span>
                  </div>
                )
              })}
              {filtered.length === 0 && (
                <div className="px-3 py-2 text-sm text-white/60 text-center">
                  No se encontraron médicos
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
