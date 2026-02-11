"use client"

import { useState, useEffect, useMemo } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ProductTable } from "@/components/products/ProductTable"
import { ProductFilters } from "@/components/products/ProductFilters"
import { CountryPills } from "@/components/products/CountryPills"
import { getProductsWithOverrides, type ProductWithOverrides } from "@/lib/supabase-mcp"

export default function ProductosPage() {
  const [products, setProducts] = useState<ProductWithOverrides[]>([])
  const [filteredProducts, setFilteredProducts] = useState<ProductWithOverrides[]>([])
  const [selectedCountry, setSelectedCountry] = useState("UY")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("")
  const [selectedTipo, setSelectedTipo] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
        setProducts(data)
        if (data.length === 0) {
          setError("No se encontraron productos. Verifica la conexión con la base de datos.")
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

  // Filtrar productos
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

    setFilteredProducts(filtered)
  }, [products, searchQuery, selectedCategory, selectedTipo])

  const handleViewProduct = (product: ProductWithOverrides) => {
    // La navegación se maneja en ProductTable
  }

  const handleEditProduct = (product: ProductWithOverrides) => {
    // La navegación se maneja en ProductTable
  }

  const handleDeleteProduct = (product: ProductWithOverrides) => {
    if (confirm(`¿Estás seguro de que deseas eliminar "${product.name}"?`)) {
      // TODO: Implementar eliminación
      console.log("Eliminar producto:", product.id)
    }
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent mb-2">
            Productos
          </h1>
          <p className="text-slate-600 mt-1">
            Gestiona tus productos y configura precios por país
          </p>
        </div>
        <Button className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-blue">
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Producto
        </Button>
      </div>

      {/* Filtro por País */}
      <div className="mb-6">
        <label className="text-sm font-semibold mb-3 block text-blue-900">Vista por País</label>
        <CountryPills
          selectedCountry={selectedCountry}
          onCountryChange={setSelectedCountry}
        />
      </div>

      {/* Filtros */}
      <div className="mb-6">
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
        <div className="text-center py-12 text-muted-foreground">Cargando productos...</div>
      ) : error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-4">
          <p className="text-red-800 font-medium">Error al cargar productos</p>
          <p className="text-red-600 text-sm mt-1">{error}</p>
        </div>
      ) : (
        <ProductTable
          products={filteredProducts}
          onViewProduct={handleViewProduct}
          onEditProduct={handleEditProduct}
          onDeleteProduct={handleDeleteProduct}
        />
      )}
    </div>
  )
}

