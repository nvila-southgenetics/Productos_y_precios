"use client"

import { useEffect, useMemo, useState } from "react"
import { Trash2, Globe, MapPin, X } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import type { ProductWithOverrides } from "@/lib/supabase-mcp"

const COUNTRY_NAMES: Record<string, string> = {
  UY: "Uruguay",
  AR: "Argentina",
  MX: "México",
  CL: "Chile",
  VE: "Venezuela",
  CO: "Colombia",
}

interface DeleteProductDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  product?: ProductWithOverrides | null
  products?: ProductWithOverrides[] | null
  selectedCountry: string
  /** Países que el usuario puede ver (permisos). */
  allowedCountries?: string[]
  /** Si true, muestra "De todos los países" (admin / acceso global). */
  canDeleteGlobally?: boolean
  onDeleteFromCountry: () => void
  onDeleteFromAll: () => void
  onDeleteFromCountries?: (countryCodes: string[]) => void
  isDeleting?: boolean
}

export function DeleteProductDialog({
  open,
  onOpenChange,
  product,
  products,
  selectedCountry,
  allowedCountries = [],
  canDeleteGlobally = true,
  onDeleteFromCountry,
  onDeleteFromAll,
  onDeleteFromCountries,
  isDeleting = false,
}: DeleteProductDialogProps) {
  const list: ProductWithOverrides[] = products?.length ? products : (product ? [product] : [])
  const [selectedCountryCodes, setSelectedCountryCodes] = useState<Set<string>>(new Set())

  const visibleCountries = useMemo(() => {
    const codes = allowedCountries.length ? allowedCountries : Object.keys(COUNTRY_NAMES)
    return codes
      .map((code) => ({ code, name: COUNTRY_NAMES[code] || code }))
      .sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }))
  }, [allowedCountries])

  const showMultiCountryDelete =
    !canDeleteGlobally && visibleCountries.length > 1 && onDeleteFromCountries

  useEffect(() => {
    if (!open) {
      setSelectedCountryCodes(new Set())
      return
    }
    setSelectedCountryCodes(new Set(visibleCountries.map((c) => c.code)))
  }, [open, selectedCountry, visibleCountries])

  if (list.length === 0) return null

  const isBulk = list.length > 1
  const firstName = list[0]?.name || ""
  const countryName = COUNTRY_NAMES[selectedCountry] || selectedCountry

  const toggleCountry = (code: string, checked: boolean) => {
    setSelectedCountryCodes((prev) => {
      const next = new Set(prev)
      if (checked) next.add(code)
      else next.delete(code)
      return next
    })
  }

  const handleDeleteSelectedCountries = () => {
    if (selectedCountryCodes.size === 0 || !onDeleteFromCountries) return
    onDeleteFromCountries(Array.from(selectedCountryCodes))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-w-md bg-gradient-to-b from-slate-900/95 to-slate-950/95 border border-white/20",
          "backdrop-blur-xl shadow-2xl rounded-xl p-0 overflow-hidden"
        )}
      >
        <div className="relative p-6">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="absolute right-4 top-4 rounded-md p-1.5 text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/20 text-red-400">
                <Trash2 className="h-5 w-5" />
              </div>
              <DialogTitle className="text-xl font-semibold text-white text-left">
                Eliminar producto
              </DialogTitle>
            </div>
            <p className="text-sm text-white/70 text-left mt-1">
              {isBulk ? (
                <>
                  ¿Cómo deseas eliminar <span className="font-medium text-white">{list.length} productos</span>?
                </>
              ) : (
                <>
                  ¿Cómo deseas eliminar <span className="font-medium text-white">{firstName}</span>?
                </>
              )}
            </p>
          </DialogHeader>

          <div className="mt-6 space-y-3">
            <button
              type="button"
              onClick={onDeleteFromCountry}
              disabled={isDeleting}
              className={cn(
                "w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left",
                "bg-white/5 border-white/15 hover:bg-white/10 hover:border-white/25",
                "focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:ring-offset-0 focus:ring-offset-transparent",
                "disabled:opacity-50 disabled:pointer-events-none"
              )}
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-sky-500/20 text-sky-400">
                <MapPin className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-white">
                  {canDeleteGlobally ? `Solo de ${countryName}` : "Eliminar de este país"}
                </p>
                <p className="text-xs text-white/60 mt-0.5">
                  {canDeleteGlobally
                    ? "El producto seguirá disponible en el resto de países"
                    : `Solo se quita de ${countryName}. El producto puede seguir en otros países.`}
                </p>
              </div>
            </button>

            {canDeleteGlobally ? (
              <button
                type="button"
                onClick={onDeleteFromAll}
                disabled={isDeleting}
                className={cn(
                  "w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left",
                  "bg-red-500/10 border-red-500/30 hover:bg-red-500/20 hover:border-red-500/40",
                  "focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:ring-offset-0 focus:ring-offset-transparent",
                  "disabled:opacity-50 disabled:pointer-events-none"
                )}
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-red-500/20 text-red-400">
                  <Globe className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white">De todos los países</p>
                  <p className="text-xs text-white/60 mt-0.5">
                    Se eliminará el producto por completo. No se puede deshacer
                  </p>
                </div>
              </button>
            ) : showMultiCountryDelete ? (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
                <div className="flex items-start gap-3 mb-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-red-500/20 text-red-400">
                    <Globe className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white">Eliminar de los países</p>
                    <p className="text-xs text-white/60 mt-0.5">
                      Elegí de qué países quitar el producto (solo los que podés ver)
                    </p>
                  </div>
                </div>
                <div className="space-y-2 mb-4">
                  {visibleCountries.map(({ code, name }) => (
                    <label
                      key={code}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 cursor-pointer bg-white/5 border border-white/10 hover:bg-white/10"
                    >
                      <Checkbox
                        checked={selectedCountryCodes.has(code)}
                        onChange={(checked) => toggleCountry(code, checked)}
                        disabled={isDeleting}
                        className="data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500 border-white/30"
                      />
                      <span className="text-sm text-white">
                        {name}
                        {code === selectedCountry ? (
                          <span className="text-white/50 text-xs ml-1">(país actual)</span>
                        ) : null}
                      </span>
                    </label>
                  ))}
                </div>
                <Button
                  type="button"
                  onClick={handleDeleteSelectedCountries}
                  disabled={isDeleting || selectedCountryCodes.size === 0}
                  className="w-full bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
                >
                  Eliminar de los países seleccionados
                </Button>
              </div>
            ) : null}
          </div>

          <div className="mt-6 pt-4 border-t border-white/10">
            {isDeleting && (
              <p className="text-center text-sm text-white/60 mb-3">Eliminando...</p>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isDeleting}
              className="w-full bg-white/5 border-white/20 text-white/90 hover:bg-white/10 hover:text-white disabled:opacity-50"
            >
              Cancelar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
