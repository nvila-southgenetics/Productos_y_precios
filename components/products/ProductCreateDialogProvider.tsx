"use client"

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"
import { createProduct, type ProductWithOverrides } from "@/lib/supabase-mcp"

type CreateProductCallback = (product: ProductWithOverrides) => void | Promise<void>
type CloseCallback = () => void

type OpenOptions = {
  defaultName?: string
  defaultCategory?: string
  defaultTipo?: string
  onCreated?: CreateProductCallback
  onCancel?: CloseCallback
}

type ProductCreateDialogContextValue = {
  openCreateProductDialog: (opts: OpenOptions) => void
}

const ProductCreateDialogContext = createContext<ProductCreateDialogContextValue | null>(null)

export function useProductCreateDialog(): ProductCreateDialogContextValue {
  const ctx = useContext(ProductCreateDialogContext)
  if (!ctx) throw new Error("useProductCreateDialog must be used within ProductCreateDialogProvider")
  return ctx
}

export function ProductCreateDialogProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [category, setCategory] = useState("")
  const [tipo, setTipo] = useState("")
  const [isCreating, setIsCreating] = useState(false)

  const onCreatedRef = useRef<CreateProductCallback | undefined>(undefined)
  const onCancelRef = useRef<CloseCallback | undefined>(undefined)
  const hasCreatedRef = useRef(false)

  const closeWithoutCreated = useCallback(() => {
    // Si el usuario cerró el modal sin crear, notificamos.
    if (!hasCreatedRef.current) onCancelRef.current?.()
    onCreatedRef.current = undefined
    onCancelRef.current = undefined
    hasCreatedRef.current = false
    setOpen(false)
    setName("")
    setCategory("")
    setTipo("")
  }, [])

  const openCreateProductDialog = useCallback((opts: OpenOptions) => {
    onCreatedRef.current = opts.onCreated
    onCancelRef.current = opts.onCancel
    hasCreatedRef.current = false

    setName(opts.defaultName ?? "")
    setCategory(opts.defaultCategory ?? "")
    setTipo(opts.defaultTipo ?? "")
    setOpen(true)
  }, [])

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) closeWithoutCreated()
    },
    [closeWithoutCreated]
  )

  const handleCreate = useCallback(async () => {
    if (!name.trim()) {
      alert("El nombre del producto es obligatorio.")
      return
    }

    if (!category.trim()) {
      alert("La categoría del producto es obligatoria.")
      return
    }

    if (!tipo.trim()) {
      alert("El tipo de muestra es obligatorio.")
      return
    }

    setIsCreating(true)
    try {
      const product = await createProduct({
        name: name.trim(),
        category: category.trim(),
        tipo: tipo.trim(),
      })

      hasCreatedRef.current = true

      const cb = onCreatedRef.current
      onCreatedRef.current = undefined
      onCancelRef.current = undefined
      setOpen(false)
      setName("")
      setCategory("")
      setTipo("")
      hasCreatedRef.current = false

      await cb?.(product)
    } catch (err) {
      console.error("Error al crear producto:", err)
      const message = err instanceof Error ? err.message : "No se pudo crear el producto."
      alert(`${message} Intenta nuevamente.`)
    } finally {
      setIsCreating(false)
    }
  }, [name, category, tipo])

  const value = useMemo<ProductCreateDialogContextValue>(
    () => ({
      openCreateProductDialog,
    }),
    [openCreateProductDialog]
  )

  return (
    <ProductCreateDialogContext.Provider value={value}>
      {children}

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="bg-slate-900 border border-white/20 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo producto</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div>
              <label className="block text-sm font-medium mb-1">
                Nombre del producto <span className="text-red-400">*</span>
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: ONCOTYPE DX MAMA"
                className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Categoría <span className="text-red-400">*</span>
              </label>
              <Select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="bg-white/10 border-white/20 text-white"
              >
                <option value="" className="bg-blue-900 text-white">
                  Seleccionar categoría
                </option>
                {["Ginecología", "Oncología", "Endocrinología", "Urología", "Prenatales", "Anualidades", "Otros"].map((c) => (
                  <option key={c} value={c} className="bg-blue-900 text-white">
                    {c}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Tipo de muestra <span className="text-red-400">*</span>
              </label>
              <Select
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
                className="bg-white/10 border-white/20 text-white"
              >
                <option value="" className="bg-blue-900 text-white">
                  Seleccionar tipo de muestra
                </option>
                {[
                  "Sangre",
                  "Corte de Tejido",
                  "Punción",
                  "Biopsia endometrial",
                  "Hisopado bucal",
                  "Sangre y corte tejido",
                  "Orina",
                ].map((t) => (
                  <option key={t} value={t} className="bg-blue-900 text-white">
                    {t}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <Button
              variant="outline"
              className="bg-transparent border-white/30 text-white hover:bg-white/10"
              onClick={() => closeWithoutCreated()}
              disabled={isCreating}
            >
              Cancelar
            </Button>
            <Button className="bg-blue-500 hover:bg-blue-600 text-white" onClick={handleCreate} disabled={isCreating}>
              {isCreating ? "Creando..." : "Crear producto"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </ProductCreateDialogContext.Provider>
  )
}

