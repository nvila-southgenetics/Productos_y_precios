"use client"

import { useState, useEffect, useMemo, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ProductTable } from "@/components/products/ProductTable"
import { ProductFilters } from "@/components/products/ProductFilters"
import { CountryPills } from "@/components/products/CountryPills"
import { getProductsWithOverrides, deleteProductFromCountry, deleteProductFromAllCountries, getTotalSalesByProductIds, type ProductWithOverrides, createProduct } from "@/lib/supabase-mcp"
import { usePermissions } from "@/lib/use-permissions"
import { productNameSortKey } from "@/lib/utils"

const VALID_COUNTRIES = new Set(["UY", "AR", "MX", "CL", "VE", "CO"])

function ProductosContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { allowedCountries, canEdit } = usePermissions()
  const [products, setProducts] = useState<ProductWithOverrides[]>([])
  const [filteredProducts, setFilteredProducts] = useState<ProductWithOverrides[]>([])
  // País por defecto: Argentina
  const [selectedCountry, setSelectedCountry] = useState("AR")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("")
  const [selectedTipo, setSelectedTipo] = useState("")
  const [reviewFilter, setReviewFilter] = useState<"all" | "reviewed" | "not_reviewed">("all")
  const [sortBy, setSortBy] = useState<"name" | "sales_desc">("name")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [salesCountByProductId, setSalesCountByProductId] = useState<Record<string, number>>({})
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [newProductName, setNewProductName] = useState("")
  const [newProductSku, setNewProductSku] = useState("")
  const [isCreating, setIsCreating] = useState(false)

  // Restaurar filtros desde la URL
  useEffect(() => {
    const country = searchParams.get("country")
    const q = searchParams.get("q")
    const category = searchParams.get("category")
    const tipo = searchParams.get("tipo")
    const review = searchParams.get("review")
    const sort = searchParams.get("sort")
    if (country && VALID_COUNTRIES.has(country)) setSelectedCountry(country)
    if (q !== null) setSearchQuery(q)
    if (category !== null) setSelectedCategory(category)
    if (tipo !== null) setSelectedTipo(tipo)
    if (review === "reviewed" || review === "not_reviewed" || review === "all") {
      setReviewFilter(review)
    }
    if (sort === "sales_desc" || sort === "name") {
      setSortBy(sort)
    }
  }, [searchParams])

  // Ajustar país seleccionado a los permitidos cuando carguen los permisos
  useEffect(() => {
    if (!allowedCountries.length) return
    setSelectedCountry((prev) => {
      // Si ya hay un país seleccionado y está permitido, respetarlo
      if (allowedCountries.includes(prev)) return prev
      // Si el usuario tiene Argentina entre sus países, usarla como default
      if (allowedCountries.includes("AR")) return "AR"
      // Si no, usar el primero permitido
      return allowedCountries[0]
    })
  }, [allowedCountries])

  // Mantener la URL en sync con los filtros para que al volver atrás se conserven
  useEffect(() => {
    const params = new URLSearchParams()
    // No añadimos el país a la URL cuando es el default (AR) para mantener URLs limpias
    if (selectedCountry && selectedCountry !== "AR") params.set("country", selectedCountry)
    if (searchQuery) params.set("q", searchQuery)
    if (selectedCategory) params.set("category", selectedCategory)
    if (selectedTipo) params.set("tipo", selectedTipo)
    if (reviewFilter !== "all") params.set("review", reviewFilter)
    if (sortBy !== "name") params.set("sort", sortBy)
    const query = params.toString()
    const url = query ? `/productos?${query}` : "/productos"
    const current = typeof window !== "undefined" ? window.location.pathname + (window.location.search || "") : ""
    if (current !== url) {
      router.replace(url, { scroll: false })
    }
  }, [selectedCountry, searchQuery, selectedCategory, selectedTipo, reviewFilter, sortBy, router])

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
        const sortedData = data.sort((a, b) => productNameSortKey(a.name).localeCompare(productNameSortKey(b.name), 'es', { sensitivity: 'base' }))
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

    // Filtro por revisado
    if (reviewFilter !== "all") {
      filtered = filtered.filter((p) => {
        const override = p.country_overrides?.find((o) => o.country_code === selectedCountry)
        const reviewed = override?.overrides?.reviewed || false
        return reviewFilter === "reviewed" ? reviewed : !reviewed
      })
    }

    // Ordenamiento
    if (sortBy === "sales_desc") {
      filtered.sort((a, b) => {
        const sa = salesCountByProductId[a.id] ?? 0
        const sb = salesCountByProductId[b.id] ?? 0
        if (sb !== sa) return sb - sa
        return productNameSortKey(a.name).localeCompare(productNameSortKey(b.name), "es", { sensitivity: "base" })
      })
    } else {
      filtered.sort((a, b) =>
        productNameSortKey(a.name).localeCompare(productNameSortKey(b.name), "es", { sensitivity: "base" })
      )
    }

    setFilteredProducts(filtered)
  }, [products, searchQuery, selectedCategory, selectedTipo, reviewFilter, sortBy, selectedCountry, salesCountByProductId])

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
      const sortedData = data.sort((a, b) => productNameSortKey(a.name).localeCompare(productNameSortKey(b.name), 'es', { sensitivity: 'base' }))
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
      const sortedData = data.sort((a, b) => productNameSortKey(a.name).localeCompare(productNameSortKey(b.name), 'es', { sensitivity: 'base' }))
      setProducts(sortedData)
    } catch (error) {
      console.error("Error reloading products after review toggle:", error)
    }
  }

  const handleOpenCreateDialog = () => {
    setNewProductName("")
    setNewProductSku("")
    setCreateDialogOpen(true)
  }

  const handleCreateProduct = async () => {
    if (!newProductName.trim()) {
      alert("El nombre del producto es obligatorio.")
      return
    }
    setIsCreating(true)
    try {
      const product = await createProduct({
        name: newProductName.trim(),
        sku: newProductSku.trim() || undefined,
      })
      setCreateDialogOpen(false)
      setNewProductName("")
      setNewProductSku("")
      router.push(`/productos/${product.id}?country=${selectedCountry}`)
    } catch (err) {
      console.error("Error al crear producto:", err)
      alert("No se pudo crear el producto. Revisa los datos e intenta nuevamente.")
    } finally {
      setIsCreating(false)
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
          <Button
            className="bg-white/10 hover:bg-white/20 border border-white/20 text-white backdrop-blur-sm"
            onClick={handleOpenCreateDialog}
          >
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
            allowedCountries={allowedCountries.length ? allowedCountries : undefined}
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
            reviewFilter={reviewFilter}
            onReviewFilterChange={(v) => setReviewFilter(v as "all" | "reviewed" | "not_reviewed")}
            sortBy={sortBy}
            onSortByChange={(v) => setSortBy(v as "name" | "sales_desc")}
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
            canEdit={canEdit}
          />
        )}

        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
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
                  value={newProductName}
                  onChange={(e) => setNewProductName(e.target.value)}
                  placeholder="Ej: ONCOTYPE DX MAMA"
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  SKU (opcional)
                </label>
                <Input
                  value={newProductSku}
                  onChange={(e) => setNewProductSku(e.target.value)}
                  placeholder="Se generará uno si lo dejas vacío"
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="outline"
                className="bg-transparent border-white/30 text-white hover:bg-white/10"
                onClick={() => setCreateDialogOpen(false)}
                disabled={isCreating}
              >
                Cancelar
              </Button>
              <Button
                className="bg-blue-500 hover:bg-blue-600 text-white"
                onClick={handleCreateProduct}
                disabled={isCreating}
              >
                {isCreating ? "Creando..." : "Crear producto"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}

export default function ProductosPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-r from-blue-900 via-blue-950 to-slate-900 flex items-center justify-center">
        <p className="text-white/80">Cargando...</p>
      </div>
    }>
      <ProductosContent />
    </Suspense>
  )
}

