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
import { formatCurrency } from '@/lib/compute'
import { COUNTRY_NAMES, COUNTRY_FLAGS } from '@/lib/countryRates'
import { Plus, Package, Edit, Trash2, Grid3X3, List, Eye, Globe, GitCompare, Search, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type ViewMode = 'grid' | 'table'
type SortOrder = 'none' | 'asc' | 'desc'

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [searchTerm, setSearchTerm] = useState('')
  const [sortOrder, setSortOrder] = useState<SortOrder>('none')
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; product: Product | null }>({
    open: false,
    product: null
  })
  const [deleting, setDeleting] = useState(false)
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
    router.push(`/products/edit/${product.id}`)
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

  // Filtrar y ordenar productos
  const filteredAndSortedProducts = products
    .filter(product => {
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
      if (sortOrder === 'asc') return a.base_price - b.base_price
      return b.base_price - a.base_price
    })

  if (loading) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-500"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-semibold text-white">Productos</h1>
            <p className="text-muted-foreground mt-1">
              Gestiona tus productos y configura precios por país
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-gray-950 rounded-lg p-1">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
                className={viewMode === 'grid' ? 'bg-white text-black' : 'text-gray-300'}
              >
                <Grid3X3 className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === 'table' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('table')}
                className={viewMode === 'table' ? 'bg-white text-black' : 'text-gray-300'}
              >
                <List className="w-4 h-4" />
              </Button>
            </div>
            <Button onClick={() => router.push('/products/new')} className="bg-white text-black hover:bg-gray-200">
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Producto
            </Button>
          </div>
        </div>

        {/* Filtros y búsqueda */}
        <Card className="mb-8">
          <CardContent className="py-4">
            <div className="flex flex-col md:flex-row gap-4 items-center">
              {/* Buscador */}
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Buscar por nombre, SKU o descripción..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              {/* Ordenar por precio */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 whitespace-nowrap">Ordenar por precio:</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleSortOrder}
                  className="flex items-center gap-2 min-w-[120px] border-orange-600 text-orange-500 hover:bg-orange-950 hover:text-orange-400 hover:border-orange-500"
                >
                  {sortOrder === 'none' && (
                    <>
                      <ArrowUpDown className="w-4 h-4" />
                      Sin orden
                    </>
                  )}
                  {sortOrder === 'asc' && (
                    <>
                      <ArrowUp className="w-4 h-4" />
                      Ascendente
                    </>
                  )}
                  {sortOrder === 'desc' && (
                    <>
                      <ArrowDown className="w-4 h-4" />
                      Descendente
                    </>
                  )}
                </Button>
              </div>
              
              {/* Contador de resultados */}
              {(searchTerm || sortOrder !== 'none') && (
                <div className="text-sm text-gray-600">
                  {filteredAndSortedProducts.length} de {products.length} productos
                </div>
              )}
            </div>
          </CardContent>
        </Card>

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
                  className="flex flex-col items-center gap-2 h-auto py-4 hover:bg-gray-950 hover:border-gray-300"
                >
                  <span className="text-2xl">{COUNTRY_FLAGS[countryCode]}</span>
                  <span className="text-sm font-medium">{COUNTRY_NAMES[countryCode]}</span>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

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
                <Button onClick={() => router.push('/products/new')} className="bg-white hover:bg-gray-200 text-black">
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
                      <CardTitle className="text-xl">{product.name}</CardTitle>
                      <CardDescription>
                        SKU: {product.sku}
                      </CardDescription>
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
                          onClick={(e) => {
                            e.stopPropagation()
                            router.push(`/products/compare/${product.id}`)
                          }}
                          className="w-full bg-white hover:bg-gray-200 text-black"
                        >
                          <GitCompare className="w-4 h-4 mr-2" />
                          Comparar Países
                        </Button>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation()
                              router.push(`/products/${product.id}`)
                            }}
                            className="flex-1"
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
                      <thead className="bg-black">
                        <tr>
                          <th className="text-left p-4 font-semibold text-white">Producto</th>
                          <th className="text-left p-4 font-semibold text-white">SKU</th>
                          <th className="text-left p-4 font-semibold text-white">Precio Base</th>
                          <th className="text-left p-4 font-semibold text-white">Descripción</th>
                          <th className="text-left p-4 font-semibold text-white">Fecha</th>
                          <th className="text-center p-4 font-semibold text-white">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAndSortedProducts.map((product, index) => (
                          <tr 
                            key={product.id} 
                            className={`border-b border-gray-950 hover:bg-black transition-colors ${
                              index % 2 === 0 ? 'bg-black' : 'bg-gray-950'
                            }`}
                          >
                            <td className="p-4">
                              <div className="font-medium text-white">{product.name}</div>
                            </td>
                            <td className="p-4">
                              <code className="bg-gray-950 px-2 py-1 rounded text-sm">
                                {product.sku}
                              </code>
                            </td>
                            <td className="p-4 font-semibold text-white">
                              {formatCurrency(product.base_price, product.currency || undefined)}
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
                                  className="text-gray-300 hover:text-white hover:bg-gray-950"
                                  title="Comparar países"
                                >
                                  <GitCompare className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => router.push(`/products/${product.id}`)}
                                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
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
    </div>
  )
}
