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
  "Ginecología": "bg-pink-100 text-pink-800 border-pink-200",
  "Oncología": "bg-red-100 text-red-800 border-red-200",
  "Urología": "bg-blue-100 text-blue-800 border-blue-200",
  "Endocrinología": "bg-purple-100 text-purple-800 border-purple-200",
  "Prenatales": "bg-green-100 text-green-800 border-green-200",
  "Anualidades": "bg-yellow-100 text-yellow-800 border-yellow-200",
  "Otros": "bg-gray-100 text-gray-800 border-gray-200",
}

const tipoColors: Record<string, string> = {
  "Sangre": "bg-red-50 text-red-700 border-red-200",
  "Corte de Tejido": "bg-blue-50 text-blue-700 border-blue-200",
  "Punción": "bg-purple-50 text-purple-700 border-purple-200",
  "Biopsia endometrial": "bg-pink-50 text-pink-700 border-pink-200",
  "Hisopado bucal": "bg-green-50 text-green-700 border-green-200",
  "Sangre y corte tejido": "bg-orange-50 text-orange-700 border-orange-200",
  "Orina": "bg-cyan-50 text-cyan-700 border-cyan-200",
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
    <div className="rounded-lg border border-blue-200/50 overflow-x-auto shadow-sm bg-white">
      <table className="w-full">
        <thead>
          <tr className="border-b border-blue-200 bg-gradient-to-r from-blue-50 to-blue-100/50">
            <th className="h-12 px-4 text-left align-middle font-semibold text-blue-900">
              Producto
            </th>
            <th className="h-12 px-4 text-left align-middle font-semibold text-blue-900">
              SKU
            </th>
            <th className="h-12 px-4 text-left align-middle font-semibold text-blue-900">
              Descripción
            </th>
            <th className="h-12 px-4 text-left align-middle font-semibold text-blue-900">
              Fecha
            </th>
            <th className="h-12 px-4 text-left align-middle font-semibold text-blue-900">
              Acciones
            </th>
          </tr>
        </thead>
        <tbody>
          {products.length === 0 ? (
            <tr>
              <td colSpan={5} className="h-24 text-center text-slate-500">
                No se encontraron productos
              </td>
            </tr>
          ) : (
            products.map((product) => (
              <tr
                key={product.id}
                className="border-b border-blue-100/50 transition-colors hover:bg-blue-50/30 cursor-pointer"
                onClick={() => handleProductClick(product)}
              >
                <td className="p-4">
                  <div className="flex flex-col gap-2">
                    <div className="font-semibold text-slate-800 hover:text-blue-700 transition-colors">{product.name}</div>
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
                          className={`${tipoColors[product.tipo] || "bg-gray-50 text-gray-700 border-gray-200"} border shadow-sm`}
                        >
                          {product.tipo}
                        </Badge>
                      )}
                    </div>
                  </div>
                </td>
                <td className="p-4">
                  <span className="text-sm text-slate-600 font-mono">{product.sku}</span>
                </td>
                <td className="p-4">
                  <span className="text-sm text-slate-600">
                    {product.description || "Sin descripción"}
                  </span>
                </td>
                <td className="p-4">
                  <span className="text-sm text-slate-600">{formatDate(product.created_at)}</span>
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => handleViewClick(e, product)}
                      title="Ver producto"
                      className="hover:bg-blue-100 hover:text-blue-700"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => handleEditClick(e, product)}
                      title="Editar producto"
                      className="hover:bg-blue-100 hover:text-blue-700"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => handleDeleteClick(e, product)}
                      title="Eliminar producto"
                      className="hover:bg-red-100 hover:text-red-700"
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

