"use client"

import React, { useMemo, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { ProductWithOverrides } from "@/lib/supabase-mcp"
import { displayProductName, cn } from "@/lib/utils"

interface ProductMergeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  products: ProductWithOverrides[]
  onConfirm: (
    mergedFrom: ProductWithOverrides[],
    chosenFields: {
      name: string
      category?: string | null
      tipo?: string | null
      costBaseProductId?: string
    }
  ) => void
}

const categoryColors: Record<string, string> = {
  "Ginecología": "bg-pink-300/20 text-pink-200 border-pink-300/30",
  "Oncología": "bg-rose-300/20 text-rose-200 border-rose-300/30",
  "Urología": "bg-sky-300/20 text-sky-200 border-sky-300/30",
  "Endocrinología": "bg-violet-300/20 text-violet-200 border-violet-300/30",
  "Prenatales": "bg-teal-300/20 text-teal-200 border-teal-300/30",
  "Anualidades": "bg-amber-300/20 text-amber-200 border-amber-300/30",
  "Carrier": "bg-indigo-300/20 text-indigo-200 border-indigo-300/30",
  "Nutrición": "bg-lime-300/20 text-lime-200 border-lime-300/30",
  "Otros": "bg-slate-300/20 text-slate-200 border-slate-300/30",
}

const tipoColors: Record<string, string> = {
  "Sangre": "bg-red-300/20 text-red-200 border-red-300/30",
  "Corte de Tejido": "bg-blue-300/20 text-blue-200 border-blue-300/30",
  "Punción": "bg-purple-300/20 text-purple-200 border-purple-300/30",
  "Biopsia endometrial": "bg-fuchsia-300/20 text-fuchsia-200 border-fuchsia-300/30",
  "Hisopado bucal": "bg-emerald-300/20 text-emerald-200 border-emerald-300/30",
  "Sangre y corte tejido": "bg-orange-300/20 text-orange-200 border-orange-300/30",
  "Orina": "bg-cyan-300/20 text-cyan-200 border-cyan-300/30",
}

export function ProductMergeDialog({
  open,
  onOpenChange,
  products,
  onConfirm,
}: ProductMergeDialogProps) {
  const [defaultProduct] = products

  const [selectedNameId, setSelectedNameId] = useState<string | undefined>(defaultProduct?.id)
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | undefined>(defaultProduct?.id)
  const [selectedTipoId, setSelectedTipoId] = useState<string | undefined>(defaultProduct?.id)
  const [selectedCostBaseId, setSelectedCostBaseId] = useState<string | undefined>(defaultProduct?.id)

  const nameProduct = useMemo(
    () => products.find(p => p.id === selectedNameId) ?? defaultProduct,
    [products, selectedNameId, defaultProduct]
  )
  const categoryProduct = useMemo(
    () => products.find(p => p.id === selectedCategoryId) ?? defaultProduct,
    [products, selectedCategoryId, defaultProduct]
  )
  const tipoProduct = useMemo(
    () => products.find(p => p.id === selectedTipoId) ?? defaultProduct,
    [products, selectedTipoId, defaultProduct]
  )

  const preview = useMemo(() => {
    return {
      name: nameProduct?.name ?? "",
      category: categoryProduct?.category ?? null,
      tipo: tipoProduct?.tipo ?? null,
      costBaseProductId: selectedCostBaseId,
    }
  }, [nameProduct, categoryProduct, tipoProduct, selectedCostBaseId])

  const handleConfirm = () => {
    if (!preview.name.trim()) return
    onConfirm(products, preview)
    onOpenChange(false)
  }

  if (!products.length) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl bg-slate-950 border border-white/15 text-white max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Fusionar productos</DialogTitle>
        </DialogHeader>
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-10 gap-6">
          {/* Izquierda: selección de campos */}
          <div className="lg:col-span-6 space-y-4">
            <div className="rounded-lg border border-white/20 bg-white/5 p-3 text-sm">
              <p className="text-white/80">
                Estás fusionando <span className="font-semibold">{products.length}</span> productos. 
                Elige para cada campo de qué producto quieres tomar el valor. 
                Aún no se guardan cambios en la base de datos.
              </p>
            </div>
            <div className="h-[380px] rounded-lg border border-white/15 bg-slate-950/60 overflow-y-auto">
              <div className="p-4 space-y-6">
                {/* Lista de productos */}
                <div>
                  <h3 className="text-sm font-semibold mb-2 text-white/80">Productos seleccionados</h3>
                  <ul className="space-y-1 text-sm">
                    {products.map((p) => (
                      <li key={p.id} className="flex items-center gap-2 text-white/80">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        <span className="font-medium">{displayProductName(p.name)}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Campo: Nombre */}
                <div className="border-t border-white/10 pt-4">
                  <h3 className="text-sm font-semibold mb-2 text-white">Nombre del producto</h3>
                  <div className="space-y-2">
                    {products.map((p) => {
                      const checked = selectedNameId === p.id
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setSelectedNameId(p.id)}
                          className={cn(
                            "w-full flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors",
                            checked
                              ? "border-emerald-400 bg-emerald-950/40"
                              : "border-white/10 bg-white/5 hover:bg-white/10"
                          )}
                        >
                          <span
                            className={cn(
                              "inline-block w-3 h-3 rounded-full border",
                              checked ? "bg-emerald-400 border-emerald-300" : "border-white/40"
                            )}
                          />
                          <span className="font-medium">{displayProductName(p.name)}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Campo: Categoría */}
                <div className="border-t border-white/10 pt-4">
                  <h3 className="text-sm font-semibold mb-2 text-white">Categoría</h3>
                  <div className="space-y-2">
                    {products.map((p) => {
                      const checked = selectedCategoryId === p.id
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setSelectedCategoryId(p.id)}
                          className={cn(
                            "w-full flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors",
                            checked
                              ? "border-emerald-400 bg-emerald-950/40"
                              : "border-white/10 bg-white/5 hover:bg-white/10"
                          )}
                        >
                          <span
                            className={cn(
                              "inline-block w-3 h-3 rounded-full border",
                              checked ? "bg-emerald-400 border-emerald-300" : "border-white/40"
                            )}
                          />
                          {p.category ? (
                            <Badge
                              className={`${categoryColors[p.category] || categoryColors["Otros"]} border shadow-sm`}
                            >
                              {p.category}
                            </Badge>
                          ) : (
                            <span className="text-xs text-white/50">Sin categoría</span>
                          )}
                          <span className="text-xs text-white/40 ml-2">
                            ({displayProductName(p.name)})
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Campo: Tipo */}
                <div className="border-t border-white/10 pt-4">
                  <h3 className="text-sm font-semibold mb-2 text-white">Tipo</h3>
                  <div className="space-y-2">
                    {products.map((p) => {
                      const checked = selectedTipoId === p.id
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setSelectedTipoId(p.id)}
                          className={cn(
                            "w-full flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors",
                            checked
                              ? "border-emerald-400 bg-emerald-950/40"
                              : "border-white/10 bg-white/5 hover:bg-white/10"
                          )}
                        >
                          <span
                            className={cn(
                              "inline-block w-3 h-3 rounded-full border",
                              checked ? "bg-emerald-400 border-emerald-300" : "border-white/40"
                            )}
                          />
                          {p.tipo ? (
                            <Badge
                              className={`${tipoColors[p.tipo] || "bg-gray-500/20 text-gray-200 border-gray-400/30"} border shadow-sm`}
                            >
                              {p.tipo}
                            </Badge>
                          ) : (
                            <span className="text-xs text-white/50">Sin tipo</span>
                          )}
                          <span className="text-xs text-white/40 ml-2">
                            ({displayProductName(p.name)})
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Campo: Cálculo de costos completo */}
                <div className="border-t border-white/10 pt-4 pb-2">
                  <h3 className="text-sm font-semibold mb-2 text-white">
                    Cálculo de costos completo
                  </h3>
                  <p className="text-xs text-white/70 mb-3">
                    Elige de qué producto quieres copiar <span className="font-semibold">todos los parámetros de costos</span>
                    (Gross Sales, descuentos, costos, etc.). Esto se aplicará luego en el backend.
                  </p>
                  <div className="space-y-2">
                    {products.map((p) => {
                      const checked = selectedCostBaseId === p.id
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setSelectedCostBaseId(p.id)}
                          className={cn(
                            "w-full flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors",
                            checked
                              ? "border-emerald-400 bg-emerald-950/40"
                              : "border-white/10 bg-white/5 hover:bg-white/10"
                          )}
                        >
                          <span
                            className={cn(
                              "inline-block w-3 h-3 rounded-full border",
                              checked ? "bg-emerald-400 border-emerald-300" : "border-white/40"
                            )}
                          />
                          <span className="font-medium">
                            Costos de {displayProductName(p.name)}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Derecha: vista previa */}
          <div className="lg:col-span-4 space-y-4">
            <div className="rounded-lg border border-emerald-400/40 bg-emerald-950/30 backdrop-blur-sm p-4">
              <h3 className="text-sm font-semibold text-emerald-200 mb-3">
                Vista previa del producto fusionado
              </h3>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-xs font-semibold text-emerald-200/80 uppercase tracking-wide">
                    Nombre
                  </p>
                  <p className="mt-1 font-semibold text-white">
                    {displayProductName(preview.name)}
                  </p>
                </div>
                {/* SKU eliminado de la BD; no mostrar en vista previa */}
                <div className="flex flex-wrap gap-2">
                  {preview.category && (
                    <Badge
                      className={`${categoryColors[preview.category] || categoryColors["Otros"]} border shadow-sm`}
                    >
                      {preview.category}
                    </Badge>
                  )}
                  {preview.tipo && (
                    <Badge
                      className={`${tipoColors[preview.tipo] || "bg-gray-500/20 text-gray-200 border-gray-400/30"} border shadow-sm`}
                    >
                      {preview.tipo}
                    </Badge>
                  )}
                  {!preview.category && !preview.tipo && (
                    <p className="text-xs text-emerald-100/70">
                      Sin categoría ni tipo seleccionados.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-white/20 bg-white/5 p-4 text-xs text-white/75 space-y-2">
              <p>
                En el siguiente paso (cuando implementemos la lógica de backend) este producto
                heredará las ventas, budgets y demás registros relacionados de todos los productos
                seleccionados.
              </p>
              <p>
                Por ahora, esta pantalla solo define cómo se verá el nuevo producto fusionado.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                className="border-white/30 text-white hover:bg-white/10"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button
                className="bg-emerald-500 hover:bg-emerald-600 text-white"
                disabled={!preview.name.trim()}
                onClick={handleConfirm}
              >
                Continuar con esta combinación
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

