"use client"

import { useState, useEffect, useMemo } from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
import { Eye, Edit, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { displayProductName, formatNumber } from "@/lib/utils"
import type { ProductWithOverrides } from "@/lib/supabase-mcp"
import { updateProductCountryOverride } from "@/lib/supabase-mcp"
import { DeleteProductDialog } from "@/components/products/DeleteProductDialog"
import { PRODUCT_CATEGORY_COLORS } from "@/lib/product-categories"

export type ProductDeleteScope =
  | "current-country"
  | "all-countries"
  | { countryCodes: string[] }

interface ProductTableProps {
  products: ProductWithOverrides[]
  selectedCountry: string
  /** URL del listado con filtros actuales (para volver desde detalle). */
  listReturnUrl?: string
  salesCountByProductId?: Record<string, number>
  budgetUnitsByProductId?: Record<string, number>
  onViewProduct: (product: ProductWithOverrides) => void
  onEditProduct: (product: ProductWithOverrides) => void
  onDeleteProduct: (product: ProductWithOverrides, scope: ProductDeleteScope) => Promise<void>
  onReviewToggle?: (productId: string, countryCode: string, checked: boolean) => Promise<void>
  /** Si false, se ocultan botones de editar/eliminar/revisado. */
  canEdit?: boolean
  allowedCountries?: string[]
  canDeleteGlobally?: boolean
  /** Callback para iniciar el flujo de fusión con los productos seleccionados. */
  onRequestMerge?: (products: ProductWithOverrides[]) => void
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

function productDetailHref(productId: string, selectedCountry: string, listReturnUrl?: string) {
  const params = new URLSearchParams()
  params.set("country", selectedCountry)
  if (listReturnUrl) {
    params.set("returnTo", listReturnUrl)
  }
  return `/productos/${productId}?${params.toString()}`
}

function openProductInNewTab(href: string) {
  window.open(href, "_blank", "noopener,noreferrer")
}

/** Clic central (rueda), Ctrl o Cmd → nueva pestaña. */
function shouldOpenProductInNewTab(e: React.MouseEvent): boolean {
  return e.button === 1 || e.ctrlKey || e.metaKey
}

const productActionLinkClass =
  "inline-flex h-9 w-9 items-center justify-center rounded-md text-white/70 hover:bg-white/20 hover:text-white transition-colors"

export function ProductTable({
  products,
  selectedCountry,
  listReturnUrl = "/productos",
  salesCountByProductId = {},
  budgetUnitsByProductId = {},
  onViewProduct,
  onEditProduct,
  onDeleteProduct,
  onReviewToggle,
  canEdit = true,
  allowedCountries = [],
  canDeleteGlobally = true,
  onRequestMerge,
}: ProductTableProps) {
  const router = useRouter()
  const [reviewedStates, setReviewedStates] = useState<Record<string, boolean>>({})
  const [updatingProducts, setUpdatingProducts] = useState<Set<string>>(new Set())
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [productToDelete, setProductToDelete] = useState<ProductWithOverrides | null>(null)
  const [productsToDelete, setProductsToDelete] = useState<ProductWithOverrides[] | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [mergeSelection, setMergeSelection] = useState<Set<string>>(new Set())

  // Inicializar estados de revisión desde los productos
  useEffect(() => {
    const states: Record<string, boolean> = {}
    products.forEach((product) => {
      const countryOverride = product.country_overrides?.find(
        (o) => o.country_code === selectedCountry
      )
      states[product.id] = countryOverride?.overrides?.reviewed || false
    })
    setReviewedStates(states)
  }, [products, selectedCountry])

  const hrefFor = (product: ProductWithOverrides) =>
    productDetailHref(product.id, selectedCountry, listReturnUrl)

  const navigateToProduct = (product: ProductWithOverrides, e: React.MouseEvent) => {
    const href = hrefFor(product)
    if (shouldOpenProductInNewTab(e)) {
      e.preventDefault()
      e.stopPropagation()
      openProductInNewTab(href)
      return
    }
    if (e.type === "click" && e.button !== 0) return
    router.push(href)
  }

  const handleProductLinkClick = (product: ProductWithOverrides, e: React.MouseEvent) => {
    e.stopPropagation()
    if (shouldOpenProductInNewTab(e)) return
    if (e.button === 0) {
      e.preventDefault()
      router.push(hrefFor(product))
    }
  }

  const handleDeleteClick = (e: React.MouseEvent, product: ProductWithOverrides) => {
    e.stopPropagation()
    setProductToDelete(product)
    setProductsToDelete(null)
    setDeleteDialogOpen(true)
  }

  const handleBulkDeleteClick = () => {
    if (mergeSelection.size === 0) return
    const selected = products.filter((p) => mergeSelection.has(p.id))
    if (selected.length === 0) return
    setProductsToDelete(selected)
    setProductToDelete(null)
    setDeleteDialogOpen(true)
  }

  const handleDeleteFromCountry = async () => {
    const list = productsToDelete?.length ? productsToDelete : (productToDelete ? [productToDelete] : [])
    if (list.length === 0) return
    setIsDeleting(true)
    try {
      const failures: Array<{ id: string; name: string; error: string }> = []
      for (const p of list) {
        try {
          await onDeleteProduct(p, "current-country")
        } catch (e) {
          failures.push({ id: p.id, name: p.name, error: e instanceof Error ? e.message : String(e) })
        }
      }
      setDeleteDialogOpen(false)
      setProductToDelete(null)
      setProductsToDelete(null)
      setMergeSelection(new Set())
      if (failures.length) {
        alert(
          `Algunos productos no se pudieron eliminar de ${selectedCountry}:\n` +
            failures.map((f) => `- ${f.name}: ${f.error}`).join("\n")
        )
      }
    } finally {
      setIsDeleting(false)
    }
  }

  const handleDeleteFromAll = async () => {
    const list = productsToDelete?.length ? productsToDelete : (productToDelete ? [productToDelete] : [])
    if (list.length === 0) return
    setIsDeleting(true)
    try {
      const failures: Array<{ id: string; name: string; error: string }> = []
      for (const p of list) {
        try {
          await onDeleteProduct(p, "all-countries")
        } catch (e) {
          failures.push({ id: p.id, name: p.name, error: e instanceof Error ? e.message : String(e) })
        }
      }
      setDeleteDialogOpen(false)
      setProductToDelete(null)
      setProductsToDelete(null)
      setMergeSelection(new Set())
      if (failures.length) {
        alert(
          `Algunos productos no se pudieron eliminar de todos los países:\n` +
            failures.map((f) => `- ${f.name}: ${f.error}`).join("\n")
        )
      }
    } finally {
      setIsDeleting(false)
    }
  }

  const handleDeleteFromCountries = async (countryCodes: string[]) => {
    const list = productsToDelete?.length ? productsToDelete : (productToDelete ? [productToDelete] : [])
    if (list.length === 0 || countryCodes.length === 0) return
    setIsDeleting(true)
    try {
      const failures: Array<{ id: string; name: string; error: string }> = []
      for (const p of list) {
        try {
          await onDeleteProduct(p, { countryCodes })
        } catch (e) {
          failures.push({ id: p.id, name: p.name, error: e instanceof Error ? e.message : String(e) })
        }
      }
      setDeleteDialogOpen(false)
      setProductToDelete(null)
      setProductsToDelete(null)
      setMergeSelection(new Set())
      if (failures.length) {
        alert(
          `Algunos productos no se pudieron eliminar de los países seleccionados:\n` +
            failures.map((f) => `- ${f.name}: ${f.error}`).join("\n")
        )
      }
    } finally {
      setIsDeleting(false)
    }
  }

  const handleReviewToggle = async (e: React.MouseEvent, product: ProductWithOverrides, checked: boolean) => {
    e.stopPropagation()
    
    // Actualizar estado local inmediatamente
    setReviewedStates(prev => ({ ...prev, [product.id]: checked }))
    setUpdatingProducts(prev => new Set(prev).add(product.id))

    try {
      const countryOverride = product.country_overrides?.find(
        (o) => o.country_code === selectedCountry
      )
      
      const currentOverrides = countryOverride?.overrides || {}
      const updatedOverrides = {
        ...currentOverrides,
        reviewed: checked,
      }

      await updateProductCountryOverride(
        product.id,
        selectedCountry as 'UY' | 'AR' | 'MX' | 'CL' | 'VE' | 'CO',
        updatedOverrides
      )

      if (onReviewToggle) {
        await onReviewToggle(product.id, selectedCountry, checked)
      }
    } catch (error) {
      console.error("Error al actualizar estado de revisión:", error)
      // Revertir el estado local en caso de error
      setReviewedStates(prev => ({ ...prev, [product.id]: !checked }))
      alert("Error al guardar el estado de revisión. Intenta de nuevo.")
    } finally {
      setUpdatingProducts(prev => {
        const newSet = new Set(prev)
        newSet.delete(product.id)
        return newSet
      })
    }
  }

  const toggleMergeSelection = (productId: string, checked: boolean) => {
    setMergeSelection(prev => {
      const next = new Set(prev)
      if (checked) {
        next.add(productId)
      } else {
        next.delete(productId)
      }
      return next
    })
  }

  const selectedForMerge = useMemo(
    () => products.filter(p => mergeSelection.has(p.id)),
    [products, mergeSelection]
  )

  const handleMergeClick = () => {
    if (!onRequestMerge) return
    if (selectedForMerge.length < 2) return
    onRequestMerge(selectedForMerge)
  }

  return (
    <div className="rounded-lg border border-white/20 overflow-x-auto shadow-sm bg-white/10 backdrop-blur-sm">
      <div className="flex items-center justify-between px-4 pt-4 pb-2 gap-2">
        <p className="text-sm text-white/70">
          {products.length} productos
          {mergeSelection.size > 0 && ` · ${mergeSelection.size} seleccionados`}
        </p>
        {canEdit && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="bg-red-500 hover:bg-red-600 text-white disabled:bg-white/10 disabled:text-white/40 disabled:cursor-not-allowed"
              disabled={mergeSelection.size < 1}
              onClick={handleBulkDeleteClick}
            >
              Eliminar seleccionados
            </Button>
            <Button
              size="sm"
              className="bg-emerald-500 hover:bg-emerald-600 text-white disabled:bg-white/10 disabled:text-white/40 disabled:cursor-not-allowed"
              disabled={mergeSelection.size < 2 || !onRequestMerge}
              onClick={handleMergeClick}
            >
              Fusionar seleccionados
            </Button>
          </div>
        )}
      </div>
      <table className="w-full">
        <thead>
          <tr className="border-b border-white/20 bg-white/10">
            {canEdit && (
              <th className="h-12 px-4 text-left align-middle font-semibold text-white w-12">
                Revisado
              </th>
            )}
            <th className="h-12 px-4 text-left align-middle font-semibold text-white">
              Producto
            </th>
            <th className="h-12 px-4 text-right align-middle font-semibold text-white">
              Q budget
            </th>
            <th className="h-12 px-4 text-right align-middle font-semibold text-white">
              Ventas totales
            </th>
            <th className="h-12 px-4 text-left align-middle font-semibold text-white">
              Acciones
            </th>
            {canEdit && (
              <th className="h-12 px-4 text-center align-middle font-semibold text-white w-24">
                Fusionar/Eliminar
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {products.length === 0 ? (
            <tr>
              <td
                colSpan={canEdit ? 6 : 4}
                className="h-24 text-center text-white/60"
              >
                No se encontraron productos
              </td>
            </tr>
          ) : (
            products.map((product) => {
              const isReviewed = reviewedStates[product.id] || false
              const isUpdating = updatingProducts.has(product.id)
              return (
                <tr
                  key={product.id}
                  className="border-b border-white/10 transition-colors hover:bg-white/5 cursor-pointer"
                  onClick={(e) => navigateToProduct(product, e)}
                  onMouseDown={(e) => {
                    if (e.button === 1) {
                      e.preventDefault()
                      openProductInNewTab(hrefFor(product))
                    }
                  }}
                >
                  {canEdit && (
                    <td className="p-4">
                      <div onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          id={`review-${product.id}`}
                          checked={isReviewed}
                          onChange={(checked) => {
                            const syntheticEvent = { stopPropagation: () => {} } as React.MouseEvent
                            handleReviewToggle(syntheticEvent, product, checked)
                          }}
                          disabled={isUpdating}
                          className="data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500 border-white/30"
                        />
                      </div>
                    </td>
                  )}
                  <td className="p-4">
                  <div className="flex flex-col gap-2">
                    <a
                      href={hrefFor(product)}
                      className="font-semibold text-white hover:text-blue-300 transition-colors w-fit"
                      onClick={(e) => handleProductLinkClick(product, e)}
                    >
                      {product.alias || "—"}
                    </a>
                    <div className="text-[11px] text-white/50 font-mono">
                      {displayProductName(product.name)}
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {product.category && (
                        <Badge
                          className={`${PRODUCT_CATEGORY_COLORS[product.category] || PRODUCT_CATEGORY_COLORS["Otros"]} border shadow-sm`}
                        >
                          {product.category}
                        </Badge>
                      )}
                      {product.tipo && (
                        <Badge
                          className={`${tipoColors[product.tipo] || "bg-gray-500/20 text-gray-200 border-gray-400/30"} border shadow-sm`}
                        >
                          {product.tipo}
                        </Badge>
                      )}
                    </div>
                  </div>
                </td>
                <td className="p-4 text-right">
                  <span className="text-sm font-medium text-white/90 tabular-nums">
                    {formatNumber((budgetUnitsByProductId[product.id] ?? 0), "es-UY")}
                  </span>
                </td>
                <td className="p-4 text-right">
                  <span className="text-sm font-medium text-white/90 tabular-nums">
                    {formatNumber((salesCountByProductId[product.id] ?? 0), 'es-UY')}
                  </span>
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <a
                      href={hrefFor(product)}
                      className={productActionLinkClass}
                      title="Ver producto (clic central: nueva pestaña)"
                      onClick={(e) => handleProductLinkClick(product, e)}
                    >
                      <Eye className="h-4 w-4" />
                    </a>
                    {canEdit && (
                      <>
                        <a
                          href={hrefFor(product)}
                          className={productActionLinkClass}
                          title="Editar producto (clic central: nueva pestaña)"
                          onClick={(e) => handleProductLinkClick(product, e)}
                        >
                          <Edit className="h-4 w-4" />
                        </a>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => handleDeleteClick(e, product)}
                          title="Eliminar producto"
                          className="hover:bg-red-500/20 hover:text-red-200 text-white/70"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                  </td>
                  {canEdit && (
                    <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={mergeSelection.has(product.id)}
                        onChange={(checked) => toggleMergeSelection(product.id, checked)}
                        className="data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500 border-white/30"
                      />
                    </td>
                  )}
                </tr>
              )
            })
          )}
        </tbody>
      </table>

      {typeof document !== "undefined" &&
        createPortal(
          <DeleteProductDialog
            open={deleteDialogOpen}
            onOpenChange={setDeleteDialogOpen}
            product={productToDelete}
            products={productsToDelete}
            selectedCountry={selectedCountry}
            allowedCountries={allowedCountries}
            canDeleteGlobally={canDeleteGlobally}
            onDeleteFromCountry={handleDeleteFromCountry}
            onDeleteFromAll={handleDeleteFromAll}
            onDeleteFromCountries={handleDeleteFromCountries}
            isDeleting={isDeleting}
          />,
          document.body
        )}
    </div>
  )
}

