"use client"

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { createProduct, type ProductWithOverrides } from "@/lib/supabase-mcp"

type CreateProductCallback = (product: ProductWithOverrides) => void | Promise<void>
type CloseCallback = () => void

type OpenOptions = {
  defaultName?: string
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
  }, [])

  const openCreateProductDialog = useCallback((opts: OpenOptions) => {
    onCreatedRef.current = opts.onCreated
    onCancelRef.current = opts.onCancel
    hasCreatedRef.current = false

    setName(opts.defaultName ?? "")
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

    setIsCreating(true)
    try {
      const product = await createProduct({
        name: name.trim(),
      })

      hasCreatedRef.current = true

      const cb = onCreatedRef.current
      onCreatedRef.current = undefined
      onCancelRef.current = undefined
      setOpen(false)
      setName("")
      hasCreatedRef.current = false

      await cb?.(product)
    } catch (err) {
      console.error("Error al crear producto:", err)
      const message = err instanceof Error ? err.message : "No se pudo crear el producto."
      alert(`${message} Intenta nuevamente.`)
    } finally {
      setIsCreating(false)
    }
  }, [name])

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

