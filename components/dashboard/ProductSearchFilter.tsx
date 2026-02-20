"use client"

import { useState, useRef, useEffect } from "react"
import { ChevronDown, Search } from "lucide-react"
import { cn } from "@/lib/utils"

interface ProductSearchFilterProps {
  products: string[]
  selectedProduct: string
  onProductChange: (product: string) => void
  disabled?: boolean
}

export function ProductSearchFilter({
  products,
  selectedProduct,
  onProductChange,
  disabled = false,
}: ProductSearchFilterProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const ref = useRef<HTMLDivElement>(null)

  const filtered = query.trim()
    ? products.filter((p) =>
        p.toLowerCase().includes(query.toLowerCase())
      )
    : products

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const displayValue = selectedProduct === "Todos" ? "Todos" : selectedProduct

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-white/90">Producto</label>
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
          <ChevronDown className={cn("h-4 w-4 opacity-70 shrink-0 transition-transform", open && "rotate-180")} />
        </button>
        {open && (
          <div className="absolute z-50 mt-1 w-full rounded-md border border-white/20 bg-blue-950/95 backdrop-blur-sm py-2 shadow-lg max-h-64 overflow-hidden flex flex-col">
            <div className="px-3 pb-2 border-b border-white/10">
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
            </div>
            <div className="overflow-y-auto max-h-48">
              <button
                type="button"
                onClick={() => {
                  onProductChange("Todos")
                  setOpen(false)
                  setQuery("")
                }}
                className={cn(
                  "flex w-full items-center px-3 py-2 text-sm text-left transition-colors",
                  selectedProduct === "Todos"
                    ? "bg-white/15 text-white font-medium"
                    : "text-white/90 hover:bg-white/10"
                )}
              >
                Todos
              </button>
              {filtered.map((product) => (
                <button
                  key={product}
                  type="button"
                  onClick={() => {
                    onProductChange(product)
                    setOpen(false)
                    setQuery("")
                  }}
                  className={cn(
                    "flex w-full items-center px-3 py-2 text-sm text-left transition-colors",
                    selectedProduct === product
                      ? "bg-white/15 text-white font-medium"
                      : "text-white/90 hover:bg-white/10"
                  )}
                >
                  {product}
                </button>
              ))}
              {filtered.length === 0 && (
                <div className="px-3 py-2 text-sm text-white/60 text-center">
                  No se encontraron productos
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
