'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Product } from '@/types'
import { Navbar } from '@/components/Navbar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatCurrency } from '@/lib/compute'
import { COUNTRY_NAMES, COUNTRY_FLAGS } from '@/lib/countryRates'
import { Plus, Package, Edit, Trash2, Grid3X3, List, Eye, Globe, GitCompare, Search, ArrowUpDown, ArrowUp, ArrowDown, X, ChevronDown } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PRODUCT_CATEGORIES, getCategoryFromProductName, getTypeFromProductName, CategoryName } from '@/lib/categories'
import { CategoryBadge } from '@/components/CategoryBadge'
import { TypeBadge } from '@/components/TypeBadge'

type ViewMode = 'grid' | 'table'
type SortOrder = 'none' | 'asc' | 'desc'

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [searchTerm, setSearchTerm] = useState('')
  const [sortOrder, setSortOrder] = useState<SortOrder>('none')
  const [selectedCategories, setSelectedCategories] = useState<CategoryName[]>([])
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false)
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false)
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; product: Product | null }>({
    open: false,
    product: null
  })
  const [deleting, setDeleting] = useState(false)
  const [editDialog, setEditDialog] = useState<{ open: boolean; product: Product | null }>({
    open: false,
    product: null
  })
  const [editForm, setEditForm] = useState({ name: '', description: '', category: '' as CategoryName | '', tipo: '' as string | '' })
  const [updating, setUpdating] = useState(false)
  const router = useRouter()

  useEffect(() => {
    fetchProducts()
  }, [])

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching products:', error)
        router.push('/login')
      } else {
        setProducts(data || [])
      }
    } catch (error) {
      console.error('Error fetching products:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteProduct = async () => {
    if (!deleteDialog.product) return

    setDeleting(true)
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', deleteDialog.product.id)

      if (error) {
        console.error('Error deleting product:', error)
        alert('Error al eliminar el producto')
      } else {
        setProducts(products.filter(p => p.id !== deleteDialog.product!.id))
        setDeleteDialog({ open: false, product: null })
      }
    } catch (error) {
      console.error('Error deleting product:', error)
      alert('Error al eliminar el producto')
    } finally {
      setDeleting(false)
    }
  }

  const handleEditProduct = (product: Product) => {
    setEditForm({
      name: product.name,
      description: product.description || '',
      category: (product.category as CategoryName) || '',
      tipo: ((product as any).tipo as string) || ''
    })
    setEditDialog({ open: true, product })
  }

  const handleUpdateProduct = async () => {
    if (!editDialog.product) return

    setUpdating(true)
    try {
      // Determinar categoría automáticamente si no se especificó
      const category = editForm.category || getCategoryFromProductName(editForm.name) || null
      // Determinar tipo automáticamente si no se especificó
      const tipo = editForm.tipo || getTypeFromProductName(editForm.name) || null

      const { error } = await supabase
        .from('products')
        .update({
          name: editForm.name,
          description: editForm.description || null,
          category: category,
          tipo: tipo
        })
        .eq('id', editDialog.product.id)

      if (error) {
        console.error('Error updating product:', error)
        alert('Error al actualizar el producto')
      } else {
        // Actualizar la lista local
        const updatedCategory = editForm.category || getCategoryFromProductName(editForm.name) || null
        const updatedTipo = editForm.tipo || getTypeFromProductName(editForm.name) || null
        setProducts(products.map(p => 
          p.id === editDialog.product!.id 
            ? { ...p, name: editForm.name, description: editForm.description || null, category: updatedCategory, tipo: updatedTipo }
            : p
        ))
        setEditDialog({ open: false, product: null })
      }
    } catch (error) {
      console.error('Error updating product:', error)
      alert('Error al actualizar el producto')
    } finally {
      setUpdating(false)
    }
  }

  const toggleSortOrder = () => {
    if (sortOrder === 'none') {
      setSortOrder('asc')
    } else if (sortOrder === 'asc') {
      setSortOrder('desc')
    } else {
      setSortOrder('none')
    }
  }

  // Tipos de muestra disponibles
  const sampleTypes = [
    'Sangre',
    'Corte de Tejido',
    'Punción',
    'Biopsia endometrial',
    'Hisopado bucal',
    'Orina'
  ]

  // Toggle categoría
  const toggleCategory = (category: CategoryName) => {
    if (category === 'Todos') {
      setSelectedCategories([])
      return
    }
    setSelectedCategories(prev => {
      if (prev.includes(category)) {
        return prev.filter(c => c !== category)
      } else {
        return [...prev, category]
      }
    })
  }

  // Toggle tipo
  const toggleType = (type: string) => {
    setSelectedTypes(prev => {
      if (prev.includes(type)) {
        return prev.filter(t => t !== type)
      } else {
        return [...prev, type]
      }
    })
  }

  // Filtrar y ordenar productos
  const filteredAndSortedProducts = products
    .filter(product => {
      // Filtro por categorías
      if (selectedCategories.length > 0) {
        const productCategory = product.category || getCategoryFromProductName(product.name)
        if (!productCategory || !selectedCategories.includes(productCategory as CategoryName)) {
          return false
        }
      }
      
      // Filtro por tipo - debe tener TODOS los tipos seleccionados
      if (selectedTypes.length > 0) {
        const productType = (product as any).tipo
        if (!productType) {
          return false
        }
        // Si el producto tiene múltiples tipos (separados por comas), verificar que tenga TODOS los seleccionados
        const productTypes = productType.split(',').map((t: string) => t.trim())
        const hasAllSelectedTypes = selectedTypes.every(selectedType => productTypes.includes(selectedType))
        if (!hasAllSelectedTypes) {
          return false
        }
      }
      
      // Filtro por búsqueda
      if (!searchTerm) return true
      const searchLower = searchTerm.toLowerCase()
      return (
        product.name.toLowerCase().includes(searchLower) ||
        product.sku.toLowerCase().includes(searchLower) ||
        product.description?.toLowerCase().includes(searchLower)
      )
    })
    .sort((a, b) => {
      if (sortOrder === 'none') return 0
      // Ordenar por Gross Sales (usando base_price como fallback)
      if (sortOrder === 'asc') return a.base_price - b.base_price
      return b.base_price - a.base_price
    })


  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900">Productos</h1>
            <p className="text-muted-foreground mt-1">
              Gestiona tus productos y configura precios por país
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-white border border-gray-200 rounded-lg p-1">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
                className={viewMode === 'grid' ? 'bg-orange-600 text-white hover:bg-orange-700' : 'text-gray-600 hover:text-orange-600 hover:bg-orange-50'}
              >
                <Grid3X3 className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === 'table' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('table')}
                className={viewMode === 'table' ? 'bg-orange-600 text-white hover:bg-orange-700' : 'text-gray-600 hover:text-orange-600 hover:bg-orange-50'}
              >
                <List className="w-4 h-4" />
              </Button>
            </div>
            <Button onClick={() => router.push('/products/new')} className="bg-blue-600 text-white hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Producto
            </Button>
          </div>
        </div>

        {/* Quick Country Navigation */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-blue-600" />
              Vista por País
            </CardTitle>
            <CardDescription>
              Compara todos los productos y sus precios por país
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {(Object.keys(COUNTRY_NAMES) as Array<keyof typeof COUNTRY_NAMES>).map((countryCode) => (
                <Button
                  key={countryCode}
                  variant="outline"
                  onClick={() => router.push(`/countries/${countryCode}`)}
                  className="flex flex-col items-center gap-2 h-auto py-4 hover:bg-orange-50 hover:border-orange-300 hover:text-orange-600"
                >
                  <span className="text-2xl">{COUNTRY_FLAGS[countryCode]}</span>
                  <span className="text-sm font-medium">{COUNTRY_NAMES[countryCode]}</span>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Búsqueda y filtros - Minimalista */}
        <div className="mb-6 space-y-4">
          {/* Búsqueda y ordenamiento */}
          <div className="flex flex-col sm:flex-row gap-3 items-center">
            {/* Buscador */}
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Buscar productos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            {/* Ordenar */}
            <Button
              variant="outline"
              size="sm"
              onClick={toggleSortOrder}
              className="flex items-center gap-2 min-w-[140px]"
            >
              {sortOrder === 'none' && (
                <>
                  <ArrowUpDown className="w-4 h-4" />
                  Ordenar
                </>
              )}
              {sortOrder === 'asc' && (
                <>
                  <ArrowUp className="w-4 h-4" />
                  Precio ↑
                </>
              )}
              {sortOrder === 'desc' && (
                <>
                  <ArrowDown className="w-4 h-4" />
                  Precio ↓
                </>
              )}
            </Button>
          </div>

          {/* Filtros de categorías y tipo - Dropdowns */}
          <div className="flex gap-3 items-start">
            {/* Dropdown de categorías */}
            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setCategoryDropdownOpen(!categoryDropdownOpen)
                  setTypeDropdownOpen(false)
                }}
                className="flex items-center gap-2 min-w-[160px] justify-between"
              >
                <span>Categorías</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${categoryDropdownOpen ? 'rotate-180' : ''}`} />
              </Button>
              
              {categoryDropdownOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setCategoryDropdownOpen(false)}
                  />
                  <div className="absolute top-full left-0 mt-2 z-20 bg-white border border-gray-200 rounded-lg shadow-lg p-3 min-w-[280px] max-w-md max-h-[400px] overflow-y-auto">
                    <div className="flex flex-wrap gap-2">
                      {Object.keys(PRODUCT_CATEGORIES).filter(cat => cat !== 'Todos').map((category) => {
                        const isSelected = selectedCategories.includes(category as CategoryName)
                        const config = {
                          'Ginecología': { color: 'text-pink-700', bgColor: 'bg-pink-100', borderColor: 'border-pink-300' },
                          'Oncología': { color: 'text-red-700', bgColor: 'bg-red-100', borderColor: 'border-red-300' },
                          'Endocrinología': { color: 'text-purple-700', bgColor: 'bg-purple-100', borderColor: 'border-purple-300' },
                          'Urología': { color: 'text-blue-700', bgColor: 'bg-blue-100', borderColor: 'border-blue-300' },
                          'Prenatales': { color: 'text-cyan-700', bgColor: 'bg-cyan-100', borderColor: 'border-cyan-300' },
                          'Anualidades': { color: 'text-orange-700', bgColor: 'bg-orange-100', borderColor: 'border-orange-300' },
                          'Otros': { color: 'text-gray-700', bgColor: 'bg-gray-100', borderColor: 'border-gray-300' }
                        }
                        const catConfig = config[category as CategoryName] || config['Otros']
                        
                        return (
                          <button
                            key={category}
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleCategory(category as CategoryName)
                            }}
                            className={`
                              px-3 py-1.5 rounded-full text-sm font-medium transition-all relative
                              ${isSelected 
                                ? `${catConfig.bgColor} ${catConfig.color} border-2 ${catConfig.borderColor}` 
                                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                              }
                            `}
                          >
                            {category}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Dropdown de tipo */}
            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setTypeDropdownOpen(!typeDropdownOpen)
                  setCategoryDropdownOpen(false)
                }}
                className="flex items-center gap-2 min-w-[160px] justify-between"
              >
                <span>Tipo</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${typeDropdownOpen ? 'rotate-180' : ''}`} />
              </Button>
              
              {typeDropdownOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setTypeDropdownOpen(false)}
                  />
                  <div className="absolute top-full left-0 mt-2 z-20 bg-white border border-gray-200 rounded-lg shadow-lg p-3 min-w-[280px] max-w-md max-h-[400px] overflow-y-auto">
                    <div className="flex flex-wrap gap-2">
                      {sampleTypes.map((type) => {
                        const isSelected = selectedTypes.includes(type)
                        const typeConfig = {
                          'Sangre': { color: 'text-red-700', bgColor: 'bg-red-100', borderColor: 'border-red-300' },
                          'Corte de Tejido': { color: 'text-purple-700', bgColor: 'bg-purple-100', borderColor: 'border-purple-300' },
                          'Punción': { color: 'text-blue-700', bgColor: 'bg-blue-100', borderColor: 'border-blue-300' },
                          'Biopsia endometrial': { color: 'text-pink-700', bgColor: 'bg-pink-100', borderColor: 'border-pink-300' },
                          'Hisopado bucal': { color: 'text-cyan-700', bgColor: 'bg-cyan-100', borderColor: 'border-cyan-300' },
                          'Orina': { color: 'text-green-700', bgColor: 'bg-green-100', borderColor: 'border-green-300' }
                        }
                        const tConfig = typeConfig[type] || { color: 'text-gray-700', bgColor: 'bg-gray-100', borderColor: 'border-gray-300' }
                        
                        return (
                          <button
                            key={type}
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleType(type)
                            }}
                            className={`
                              px-3 py-1.5 rounded-full text-sm font-medium transition-all relative
                              ${isSelected 
                                ? `${tConfig.bgColor} ${tConfig.color} border-2 ${tConfig.borderColor}` 
                                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                              }
                            `}
                          >
                            {type}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Etiquetas seleccionadas con X */}
          {(selectedCategories.length > 0 || selectedTypes.length > 0) && (
            <div className="flex flex-wrap gap-2 items-center">
              {selectedCategories.map((category) => {
                const config = {
                  'Ginecología': { color: 'text-pink-700', bgColor: 'bg-pink-100', borderColor: 'border-pink-300' },
                  'Oncología': { color: 'text-red-700', bgColor: 'bg-red-100', borderColor: 'border-red-300' },
                  'Endocrinología': { color: 'text-purple-700', bgColor: 'bg-purple-100', borderColor: 'border-purple-300' },
                  'Urología': { color: 'text-blue-700', bgColor: 'bg-blue-100', borderColor: 'border-blue-300' },
                  'Prenatales': { color: 'text-cyan-700', bgColor: 'bg-cyan-100', borderColor: 'border-cyan-300' },
                  'Anualidades': { color: 'text-orange-700', bgColor: 'bg-orange-100', borderColor: 'border-orange-300' },
                  'Otros': { color: 'text-gray-700', bgColor: 'bg-gray-100', borderColor: 'border-gray-300' }
                }
                const catConfig = config[category] || config['Otros']
                
                return (
                  <div
                    key={category}
                    className={`relative ${catConfig.bgColor} ${catConfig.color} border-2 ${catConfig.borderColor} px-3 py-1.5 rounded-full text-sm font-medium`}
                  >
                    <button
                      onClick={() => toggleCategory(category)}
                      className="absolute -top-1.5 -right-1.5 bg-gray-800 text-white rounded-full p-0.5 hover:bg-gray-900 transition-colors"
                      aria-label={`Eliminar ${category}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                    {category}
                  </div>
                )
              })}
              
              {selectedTypes.map((type) => {
                const typeConfig = {
                  'Sangre': { color: 'text-red-700', bgColor: 'bg-red-100', borderColor: 'border-red-300' },
                  'Corte de Tejido': { color: 'text-purple-700', bgColor: 'bg-purple-100', borderColor: 'border-purple-300' },
                  'Punción': { color: 'text-blue-700', bgColor: 'bg-blue-100', borderColor: 'border-blue-300' },
                  'Biopsia endometrial': { color: 'text-pink-700', bgColor: 'bg-pink-100', borderColor: 'border-pink-300' },
                  'Hisopado bucal': { color: 'text-cyan-700', bgColor: 'bg-cyan-100', borderColor: 'border-cyan-300' },
                  'Sangre y corte tejido': { color: 'text-orange-700', bgColor: 'bg-orange-100', borderColor: 'border-orange-300' },
                  'Orina': { color: 'text-green-700', bgColor: 'bg-green-100', borderColor: 'border-green-300' }
                }
                const tConfig = typeConfig[type] || { color: 'text-gray-700', bgColor: 'bg-gray-100', borderColor: 'border-gray-300' }
                
                return (
                  <div
                    key={type}
                    className={`relative ${tConfig.bgColor} ${tConfig.color} border-2 ${tConfig.borderColor} px-3 py-1.5 rounded-full text-sm font-medium`}
                  >
                    <button
                      onClick={() => toggleType(type)}
                      className="absolute -top-1.5 -right-1.5 bg-gray-800 text-white rounded-full p-0.5 hover:bg-gray-900 transition-colors"
                      aria-label={`Eliminar ${type}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                    {type}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {filteredAndSortedProducts.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {products.length === 0 ? 'No hay productos' : 'No se encontraron productos'}
              </h3>
              <p className="text-muted-foreground mb-4">
                {products.length === 0 
                  ? 'Comienza creando tu primer producto' 
                  : 'Intenta con otro término de búsqueda'}
              </p>
              {products.length === 0 && (
                <Button onClick={() => router.push('/products/new')} className="bg-blue-600 hover:bg-blue-700 text-white">
                  <Plus className="w-4 h-4 mr-2" />
                  Crear Producto
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredAndSortedProducts.map((product) => (
                  <Card 
                    key={product.id} 
                    className="hover:shadow-xl transition-all duration-200"
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <CardTitle className="text-xl">{product.name}</CardTitle>
                          <CardDescription className="mt-1">
                            SKU: {product.sku}
                          </CardDescription>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            <CategoryBadge category={product.category} productName={product.name} />
                            <TypeBadge type={(product as any).tipo} />
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {product.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                          {product.description}
                        </p>
                      )}
                      <div className="flex flex-col gap-2 mt-4">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation()
                            router.push(`/products/compare/${product.id}`)
                          }}
                          className="w-full hover:bg-orange-50 hover:border-orange-300 hover:text-orange-600"
                        >
                          <GitCompare className="w-4 h-4 mr-2" />
                          Comparar Países
                        </Button>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              router.push(`/products/${product.id}`)
                            }}
                            className="flex-1 bg-blue-600 text-white hover:bg-blue-700"
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            Ver
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleEditProduct(product)
                            }}
                            className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation()
                              setDeleteDialog({ open: true, product })
                            }}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="text-left p-4 font-semibold text-gray-900">Producto</th>
                          <th className="text-left p-4 font-semibold text-gray-900">SKU</th>
                          <th className="text-left p-4 font-semibold text-gray-900">Descripción</th>
                          <th className="text-left p-4 font-semibold text-gray-900">Fecha</th>
                          <th className="text-center p-4 font-semibold text-gray-900">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAndSortedProducts.map((product, index) => (
                          <tr 
                            key={product.id} 
                            className={`border-b border-gray-200 hover:bg-gray-50 transition-colors ${
                              index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                            }`}
                          >
                            <td className="p-4">
                              <div className="font-medium text-gray-900">{product.name}</div>
                              <div className="mt-1.5 flex flex-wrap gap-1.5">
                                <CategoryBadge category={product.category} productName={product.name} size="sm" />
                                <TypeBadge type={(product as any).tipo} size="sm" />
                              </div>
                            </td>
                            <td className="p-4">
                              <code className="bg-gray-100 px-2 py-1 rounded text-sm text-gray-900">
                                {product.sku}
                              </code>
                            </td>
                            <td className="p-4">
                              <div className="max-w-xs truncate text-sm text-gray-600">
                                {product.description || 'Sin descripción'}
                              </div>
                            </td>
                            <td className="p-4 text-sm text-gray-600">
                              {product.created_at ? new Date(product.created_at).toLocaleDateString('es-ES') : '-'}
                            </td>
                            <td className="p-4">
                              <div className="flex items-center justify-center gap-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => router.push(`/products/compare/${product.id}`)}
                                  className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                                  title="Comparar países"
                                >
                                  <GitCompare className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => router.push(`/products/${product.id}`)}
                                  className="bg-blue-600 text-white hover:bg-blue-700"
                                  title="Ver producto"
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleEditProduct(product)}
                                  className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                                  title="Editar"
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setDeleteDialog({ open: true, product })}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                  title="Eliminar"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>

      {/* Dialog de confirmación para eliminar */}
      <Dialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, product: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar producto?</DialogTitle>
            <DialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente el producto "{deleteDialog.product?.name}".
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialog({ open: false, product: null })}
              disabled={deleting}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteProduct}
              disabled={deleting}
            >
              {deleting ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para editar producto */}
      <Dialog open={editDialog.open} onOpenChange={(open) => setEditDialog({ open, product: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Producto</DialogTitle>
            <DialogDescription>
              Actualiza el nombre y la descripción del producto "{editDialog.product?.name}".
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Nombre del producto</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                placeholder="Nombre del producto"
                disabled={updating}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Descripción</Label>
              <Input
                id="edit-description"
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                placeholder="Descripción del producto (opcional)"
                disabled={updating}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-category">Categoría</Label>
              <Select 
                value={editForm.category || ''} 
                onValueChange={(value) => setEditForm({ ...editForm, category: value as CategoryName })}
                disabled={updating}
              >
                <SelectTrigger id="edit-category">
                  <SelectValue placeholder="Seleccionar categoría (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(PRODUCT_CATEGORIES).filter(cat => cat !== 'Todos').map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Si no seleccionas una categoría, se detectará automáticamente según el nombre del producto
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDialog({ open: false, product: null })}
              disabled={updating}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleUpdateProduct}
              disabled={updating || !editForm.name.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {updating ? 'Guardando...' : 'Guardar Cambios'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
