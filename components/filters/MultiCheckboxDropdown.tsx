"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
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
  pendingLabel,
}: {
  label: string
  options: MultiSelectOption[]
  selectedValues: string[]
  onSelectedValuesChange: (values: string[]) => void
  allLabel: string
  hideLabel?: boolean
  className?: string
  /** Mientras no hay opciones (p. ej. permisos cargando), mostrar este texto. */
  pendingLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const [menuStyle, setMenuStyle] = useState<{ top: number; left: number; width: number } | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const updateMenuPosition = useCallback(() => {
    if (!buttonRef.current) return
    const rect = buttonRef.current.getBoundingClientRect()
    setMenuStyle({
      top: rect.bottom + 4,
      left: rect.left,
      width: Math.max(rect.width, 280),
    })
  }, [])

  useEffect(() => {
    if (!open) {
      setMenuStyle(null)
      return
    }
    updateMenuPosition()
    window.addEventListener("resize", updateMenuPosition)
    window.addEventListener("scroll", updateMenuPosition, true)
    return () => {
      window.removeEventListener("resize", updateMenuPosition)
      window.removeEventListener("scroll", updateMenuPosition, true)
    }
  }, [open, updateMenuPosition])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node
      if (rootRef.current?.contains(target)) return
      if (menuRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const allValues = options.map((o) => o.value)
  const isAll =
    allValues.length > 0 &&
    selectedValues.length === allValues.length &&
    allValues.every((v) => selectedValues.includes(v))

  const display =
    options.length === 0 && pendingLabel
      ? pendingLabel
      : options.length === 0
        ? "Sin opciones"
        : isAll
          ? allLabel
          : selectedValues.length === 1
            ? options.find((o) => o.value === selectedValues[0])?.label ?? selectedValues[0]
            : `${selectedValues.length} seleccionados`

  /** Clic en el cuadrado: suma o quita ese valor (nunca deja el filtro vacío). */
  const toggle = (v: string) => {
    const next = selectedValues.includes(v) ? selectedValues.filter((x) => x !== v) : [...selectedValues, v]
    onSelectedValuesChange(next.length === 0 ? allValues : next)
  }

  /** Clic en el texto: deja solo esa opción seleccionada. */
  const selectOnly = (v: string) => {
    onSelectedValuesChange([v])
  }

  const toggleAllCheckbox = () => {
    if (allValues.length === 0) return
    if (isAll) onSelectedValuesChange([allValues[0]])
    else onSelectedValuesChange(allValues)
  }

  const menuContent = open && menuStyle && (
    <div
      ref={menuRef}
      className="fixed z-[200] rounded-md border border-white/25 bg-slate-900 py-2 shadow-2xl max-h-64 overflow-y-auto overflow-x-auto"
      style={{
        top: menuStyle.top,
        left: menuStyle.left,
        width: menuStyle.width,
        maxWidth: "min(90vw, 640px)",
      }}
    >
      <div className="flex w-full items-center gap-2 px-3 py-2 text-sm text-white/90">
        <span className="shrink-0 flex items-center rounded p-0.5 hover:bg-white/10 focus-within:bg-white/10">
          <Checkbox checked={isAll} onChange={toggleAllCheckbox} />
        </span>
        <span
          role="button"
          tabIndex={0}
          className="min-w-0 flex-1 cursor-pointer text-left whitespace-nowrap rounded px-1 py-0.5 outline-none hover:bg-white/10 focus-visible:bg-white/10"
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
        >
          {allLabel}
        </span>
      </div>
      {options.map((opt) => (
        <div
          key={opt.value}
          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-white/90"
        >
          <span className="shrink-0 flex items-center rounded p-0.5 hover:bg-white/10 focus-within:bg-white/10">
            <Checkbox checked={selectedValues.includes(opt.value)} onChange={() => toggle(opt.value)} />
          </span>
          <span
            role="button"
            tabIndex={0}
            className="min-w-0 flex-1 cursor-pointer text-left whitespace-nowrap rounded px-1 py-0.5 outline-none hover:bg-white/10 focus-visible:bg-white/10"
            onClick={() => selectOnly(opt.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                selectOnly(opt.value)
              }
            }}
          >
            {opt.label}
          </span>
        </div>
      ))}
    </div>
  )

  return (
    <div className={cn("flex flex-col gap-2", className)} ref={rootRef}>
      {!hideLabel && <label className="text-sm font-medium text-white/90">{label}</label>}
      <div className="relative w-full">
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-md border px-3 py-2 text-sm",
            "bg-white/10 border-white/20 text-white focus:border-white/30 focus:ring-2 focus:ring-white/30 focus:ring-offset-0 focus:ring-offset-transparent"
          )}
          aria-label={`Alternar ${label}`}
          aria-expanded={open}
        >
          <span className="truncate">{display}</span>
          <ChevronDown className={cn("h-4 w-4 opacity-70 transition-transform", open && "rotate-180")} />
        </button>

        {typeof document !== "undefined" && menuContent
          ? createPortal(menuContent, document.body)
          : null}
      </div>
    </div>
  )
}
