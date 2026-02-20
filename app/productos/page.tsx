"use client"

import { useState, useEffect, useMemo } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ProductTable } from "@/components/products/ProductTable"
import { ProductFilters } from "@/components/products/ProductFilters"
import { CountryPills } from "@/components/products/CountryPills"
import { getProductsWithOverrides, deleteProductFromCountry, deleteProductFromAllCountries, getTotalSalesByProductIds, type ProductWithOverrides } from "@/lib/supabase-mcp"

const VALID_COUNTRIES = new Set(["UY", "AR", "MX", "CL", "VE", "CO"])

export default function ProductosPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [products, setProducts] = useState<ProductWithOverrides[]>([])
  const [filteredProducts, setFilteredProducts] = useState<ProductWithOverrides[]>([])
  const [selectedCountry, setSelectedCountry] = useState("UY")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("")
  const [selectedTipo, setSelectedTipo] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [salesCountByProductId, setSalesCountByProductId] = useState<Record<string, number>>({})

  // Restaurar filtros desde la URL al cargar o al volver atrás
  useEffect(() => {
    const country = searchParams.get("country")
    const q = searchParams.get("q")
    const category = searchParams.get("category")
    const tipo = searchParams.get("tipo")
    if (country && VALID_COUNTRIES.has(country)) setSelectedCountry(country)
    if (q !== null) setSearchQuery(q)
    if (category !== null) setSelectedCategory(category)
    if (tipo !== null) setSelectedTipo(tipo)
  }, [searchParams])

  // Mantener la URL en sync con los filtros para que al volver atrás se conserven
  useEffect(() => {
    const params = new URLSearchParams()
    if (selectedCountry && selectedCountry !== "UY") params.set("country", selectedCountry)
    if (searchQuery) params.set("q", searchQuery)
    if (selectedCategory) params.set("category", selectedCategory)
    if (selectedTipo) params.set("tipo", selectedTipo)
    const query = params.toString()
    const url = query ? `/productos?${query}` : "/productos"
    const current = typeof window !== "undefined" ? window.location.pathname + (window.location.search || "") : ""
    if (current !== url) {
      router.replace(url, { scroll: false })
    }
  }, [selectedCountry, searchQuery, selectedCategory, selectedTipo, router])

  // Obtener categorías y tipos únicos
  const categories = useMemo(() => {
    const cats = new Set<string>()
    products.forEach((p) => {
      if (p.category) cats.add(p.category)
    })
    return Array.from(cats).sort()
  }, [products])

  const tipos = useMemo(() => {
    const tps = new Set<string>()
    products.forEach((p) => {
      if (p.tipo) tps.add(p.tipo)
    })
    return Array.from(tps).sort()
  }, [products])

  // Cargar productos
  useEffect(() => {
    async function loadProducts() {
      setIsLoading(true)
      setError(null)
      try {
        const data = await getProductsWithOverrides(selectedCountry)
        // Ordenar productos alfabéticamente por nombre
        const sortedData = data.sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }))
        setProducts(sortedData)
        if (sortedData.length === 0) {
          setError("No se encontraron productos. Verifica la conexión con la base de datos.")
          setSalesCountByProductId({})
        } else {
          const counts = await getTotalSalesByProductIds(
            sortedData.map(p => p.id),
            selectedCountry
          )
          setSalesCountByProductId(counts)
        }
      } catch (error) {
        console.error("Error loading products:", error)
        setError(error instanceof Error ? error.message : "Error al cargar los productos")
      } finally {
        setIsLoading(false)
      }
    }
    loadProducts()
  }, [selectedCountry])

  // Filtrar y ordenar productos
  useEffect(() => {
    let filtered = [...products]

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.sku.toLowerCase().includes(query) ||
          (p.description && p.description.toLowerCase().includes(query))
      )
    }

    if (selectedCategory) {
      filtered = filtered.filter((p) => p.category === selectedCategory)
    }

    if (selectedTipo) {
      filtered = filtered.filter((p) => p.tipo === selectedTipo)
    }

    // Ordenar productos alfabéticamente por nombre
    filtered.sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }))

    setFilteredProducts(filtered)
  }, [products, searchQuery, selectedCategory, selectedTipo])

  const handleViewProduct = (product: ProductWithOverrides) => {
    // La navegación se maneja en ProductTable
  }

  const handleEditProduct = (product: ProductWithOverrides) => {
    // La navegación se maneja en ProductTable
  }

  const handleDeleteProduct = async (product: ProductWithOverrides, deleteFromAllCountries: boolean) => {
    try {
      if (deleteFromAllCountries) {
        await deleteProductFromAllCountries(product.id)
      } else {
        await deleteProductFromCountry(product.id, selectedCountry)
      }
      
      // Recargar productos después de eliminar
      const data = await getProductsWithOverrides(selectedCountry)
      const sortedData = data.sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }))
      setProducts(sortedData)
    } catch (error) {
      console.error("Error deleting product:", error)
      alert(`Error al eliminar el producto: ${error instanceof Error ? error.message : 'Error desconocido'}`)
    }
  }

  const handleReviewToggle = async (productId: string, countryCode: string, checked: boolean) => {
    // Recargar productos después de actualizar el estado de revisión
    try {
      const data = await getProductsWithOverrides(selectedCountry)
      const sortedData = data.sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }))
      setProducts(sortedData)
    } catch (error) {
      console.error("Error reloading products after review toggle:", error)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-r from-blue-900 via-blue-950 to-slate-900">
      <div className="container mx-auto py-8 px-4 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Productos
            </h1>
            <p className="text-white/80 mt-1">
              Gestiona tus productos y configura precios por país
            </p>
          </div>
          <Button className="bg-white/10 hover:bg-white/20 border border-white/20 text-white backdrop-blur-sm">
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Producto
          </Button>
        </div>

        {/* Filtro por País */}
        <div className="mb-6 rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 p-4 shadow-sm">
          <label className="text-sm font-semibold mb-3 block text-white/90">Vista por País</label>
          <CountryPills
            selectedCountry={selectedCountry}
            onCountryChange={setSelectedCountry}
          />
        </div>

        {/* Filtros */}
        <div className="mb-6 rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 p-4 shadow-sm">
          <ProductFilters
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
            selectedTipo={selectedTipo}
            onTipoChange={setSelectedTipo}
            categories={categories}
            tipos={tipos}
          />
        </div>

        {/* Tabla de Productos */}
        {isLoading ? (
          <div className="text-center py-12 text-white/80">Cargando productos...</div>
        ) : error ? (
          <div className="rounded-lg border border-red-400/30 bg-red-500/10 backdrop-blur-sm p-4">
            <p className="text-red-200 font-medium">Error al cargar productos</p>
            <p className="text-red-300 text-sm mt-1">{error}</p>
          </div>
        ) : (
          <ProductTable
            products={filteredProducts}
            selectedCountry={selectedCountry}
            salesCountByProductId={salesCountByProductId}
            onViewProduct={handleViewProduct}
            onEditProduct={handleEditProduct}
            onDeleteProduct={handleDeleteProduct}
            onReviewToggle={handleReviewToggle}
          />
        )}
      </div>
    </div>
  )
}

