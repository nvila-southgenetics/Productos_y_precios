"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Link as LinkIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ProductDetailView } from "@/components/products/ProductDetailView"
import { getProductById, type ProductWithOverrides } from "@/lib/supabase-mcp"

export default function ProductDetailPage() {
  const params = useParams()
  const router = useRouter()
  const productId = params.productId as string

  const [product, setProduct] = useState<ProductWithOverrides | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadProduct() {
      setIsLoading(true)
      setError(null)
      try {
        const data = await getProductById(productId)
        if (!data) {
          setError("Producto no encontrado")
        } else {
          setProduct(data)
        }
      } catch (err) {
        console.error("Error loading product:", err)
        setError("Error al cargar el producto")
      } finally {
        setIsLoading(false)
      }
    }

    if (productId) {
      loadProduct()
    }
  }, [productId])

  const handleCopyLink = () => {
    const url = window.location.href
    navigator.clipboard.writeText(url)
    // TODO: Mostrar toast de éxito
  }

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-7xl">
        <div className="text-center py-12 text-muted-foreground">
          Cargando producto...
        </div>
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-7xl">
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold mb-4">Producto no encontrado</h1>
          <p className="text-muted-foreground mb-6">{error || "El producto que buscas no existe"}</p>
          <Button onClick={() => router.push("/productos")}>
            Volver a Productos
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      {/* Breadcrumb y Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
          <button
            onClick={() => router.push("/productos")}
            className="hover:text-foreground transition-colors"
          >
            Productos
          </button>
          <span>/</span>
          <span className="text-foreground font-medium">{product.name}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/productos")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-3xl font-bold">{product.name}</h1>
          </div>
          <Button variant="outline" onClick={handleCopyLink}>
            <LinkIcon className="h-4 w-4 mr-2" />
            Copiar URL
          </Button>
        </div>
      </div>

      {/* Vista Detallada */}
      <ProductDetailView product={product} />
    </div>
  )
}



