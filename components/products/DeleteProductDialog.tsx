"use client"

import { Trash2, Globe, MapPin, X } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
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
  product: ProductWithOverrides | null
  selectedCountry: string
  onDeleteFromCountry: () => void
  onDeleteFromAll: () => void
  isDeleting?: boolean
}

export function DeleteProductDialog({
  open,
  onOpenChange,
  product,
  selectedCountry,
  onDeleteFromCountry,
  onDeleteFromAll,
  isDeleting = false,
}: DeleteProductDialogProps) {
  if (!product) return null

  const countryName = COUNTRY_NAMES[selectedCountry] || selectedCountry

  const handleOption = (fromAll: boolean) => {
    if (fromAll) onDeleteFromAll()
    else onDeleteFromCountry()
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
              ¿Cómo deseas eliminar <span className="font-medium text-white">{product.name}</span>?
            </p>
          </DialogHeader>

          <div className="mt-6 space-y-3">
            <button
              type="button"
              onClick={() => handleOption(false)}
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
                <p className="font-medium text-white">Solo de {countryName}</p>
                <p className="text-xs text-white/60 mt-0.5">
                  El producto seguirá disponible en el resto de países
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleOption(true)}
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
