"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Eye, Edit, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatDate } from "@/lib/utils"
import type { ProductWithOverrides } from "@/lib/supabase-mcp"

interface ProductTableProps {
  products: ProductWithOverrides[]
  onViewProduct: (product: ProductWithOverrides) => void
  onEditProduct: (product: ProductWithOverrides) => void
  onDeleteProduct: (product: ProductWithOverrides) => void
}

const categoryColors: Record<string, string> = {
  "Ginecología": "bg-pink-500/20 text-pink-200 border-pink-400/30",
  "Oncología": "bg-red-500/20 text-red-200 border-red-400/30",
  "Urología": "bg-blue-500/20 text-blue-200 border-blue-400/30",
  "Endocrinología": "bg-purple-500/20 text-purple-200 border-purple-400/30",
  "Prenatales": "bg-emerald-500/20 text-emerald-200 border-emerald-400/30",
  "Anualidades": "bg-yellow-500/20 text-yellow-200 border-yellow-400/30",
  "Otros": "bg-gray-500/20 text-gray-200 border-gray-400/30",
}

const tipoColors: Record<string, string> = {
  "Sangre": "bg-red-500/20 text-red-200 border-red-400/30",
  "Corte de Tejido": "bg-blue-500/20 text-blue-200 border-blue-400/30",
  "Punción": "bg-purple-500/20 text-purple-200 border-purple-400/30",
  "Biopsia endometrial": "bg-pink-500/20 text-pink-200 border-pink-400/30",
  "Hisopado bucal": "bg-emerald-500/20 text-emerald-200 border-emerald-400/30",
  "Sangre y corte tejido": "bg-orange-500/20 text-orange-200 border-orange-400/30",
  "Orina": "bg-cyan-500/20 text-cyan-200 border-cyan-400/30",
}

export function ProductTable({
  products,
  onViewProduct,
  onEditProduct,
  onDeleteProduct,
}: ProductTableProps) {
  const router = useRouter()

  const handleProductClick = (product: ProductWithOverrides) => {
    router.push(`/productos/${product.id}`)
  }

  const handleViewClick = (e: React.MouseEvent, product: ProductWithOverrides) => {
    e.stopPropagation()
    router.push(`/productos/${product.id}`)
  }

  const handleEditClick = (e: React.MouseEvent, product: ProductWithOverrides) => {
    e.stopPropagation()
    router.push(`/productos/${product.id}`)
  }

  const handleDeleteClick = (e: React.MouseEvent, product: ProductWithOverrides) => {
    e.stopPropagation()
    onDeleteProduct(product)
  }

  return (
    <div className="rounded-lg border border-white/20 overflow-x-auto shadow-sm bg-white/10 backdrop-blur-sm">
      <table className="w-full">
        <thead>
          <tr className="border-b border-white/20 bg-white/10">
            <th className="h-12 px-4 text-left align-middle font-semibold text-white">
              Producto
            </th>
            <th className="h-12 px-4 text-left align-middle font-semibold text-white">
              SKU
            </th>
            <th className="h-12 px-4 text-left align-middle font-semibold text-white">
              Descripción
            </th>
            <th className="h-12 px-4 text-left align-middle font-semibold text-white">
              Fecha
            </th>
            <th className="h-12 px-4 text-left align-middle font-semibold text-white">
              Acciones
            </th>
          </tr>
        </thead>
        <tbody>
          {products.length === 0 ? (
            <tr>
              <td colSpan={5} className="h-24 text-center text-white/60">
                No se encontraron productos
              </td>
            </tr>
          ) : (
            products.map((product) => (
              <tr
                key={product.id}
                className="border-b border-white/10 transition-colors hover:bg-white/5 cursor-pointer"
                onClick={() => handleProductClick(product)}
              >
                <td className="p-4">
                  <div className="flex flex-col gap-2">
                    <div className="font-semibold text-white hover:text-blue-300 transition-colors">{product.name}</div>
                    <div className="flex gap-2 flex-wrap">
                      {product.category && (
                        <Badge
                          className={`${categoryColors[product.category] || categoryColors["Otros"]} border shadow-sm`}
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
                <td className="p-4">
                  <span className="text-sm text-white/70 font-mono">{product.sku}</span>
                </td>
                <td className="p-4">
                  <span className="text-sm text-white/70">
                    {product.description || "Sin descripción"}
                  </span>
                </td>
                <td className="p-4">
                  <span className="text-sm text-white/70">{formatDate(product.created_at)}</span>
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => handleViewClick(e, product)}
                      title="Ver producto"
                      className="hover:bg-white/20 hover:text-white text-white/70"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => handleEditClick(e, product)}
                      title="Editar producto"
                      className="hover:bg-white/20 hover:text-white text-white/70"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => handleDeleteClick(e, product)}
                      title="Eliminar producto"
                      className="hover:bg-red-500/20 hover:text-red-200 text-white/70"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

