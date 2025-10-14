'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Product } from '@/types'
import { Navbar } from '@/components/Navbar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/compute'
import { COUNTRY_NAMES, COUNTRY_FLAGS } from '@/lib/countryRates'
import { Plus, Package, Edit, Trash2, Grid3X3, List, Eye, Globe, GitCompare } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type ViewMode = 'grid' | 'table'

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
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
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold font-heading text-gray-900 sparkles-multiple">Productos ✨</h1>
            <p className="text-muted-foreground mt-1">
              Gestiona tus productos y configura precios por país
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-rose-50 rounded-lg p-1">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
                className={viewMode === 'grid' ? 'bg-rose-500 text-white' : 'text-rose-600'}
              >
                <Grid3X3 className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === 'table' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('table')}
                className={viewMode === 'table' ? 'bg-rose-500 text-white' : 'text-rose-600'}
              >
                <List className="w-4 h-4" />
              </Button>
            </div>
            <Button onClick={() => router.push('/products/new')} className="btn-sparkle">
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Producto
            </Button>
          </div>
        </div>

        {/* Quick Country Navigation */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5" />
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
                  className="flex flex-col items-center gap-2 h-auto py-4 hover:bg-rose-50 hover:border-rose-200"
                >
                  <span className="text-2xl">{COUNTRY_FLAGS[countryCode]}</span>
                  <span className="text-sm font-medium">{COUNTRY_NAMES[countryCode]}</span>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {products.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No hay productos</h3>
              <p className="text-muted-foreground mb-4">
                Comienza creando tu primer producto
              </p>
              <Button onClick={() => router.push('/products/new')}>
                <Plus className="w-4 h-4 mr-2" />
                Crear Producto
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {products.map((product) => (
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
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Precio base:</span>
                          <span className="font-semibold">
                            {formatCurrency(product.base_price, product.currency || undefined)}
                          </span>
                        </div>
                        {product.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {product.description}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col gap-2 mt-4">
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            router.push(`/products/compare/${product.id}`)
                          }}
                          className="w-full bg-pink-500 hover:bg-pink-600 text-white btn-sparkle"
                        >
                          <GitCompare className="w-4 h-4 mr-2" />
                          Comparar Países ✨
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
                      <thead className="bg-rose-50">
                        <tr>
                          <th className="text-left p-4 font-semibold text-rose-900">Producto</th>
                          <th className="text-left p-4 font-semibold text-rose-900">SKU</th>
                          <th className="text-left p-4 font-semibold text-rose-900">Precio Base</th>
                          <th className="text-left p-4 font-semibold text-rose-900">Descripción</th>
                          <th className="text-left p-4 font-semibold text-rose-900">Fecha</th>
                          <th className="text-center p-4 font-semibold text-rose-900">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {products.map((product, index) => (
                          <tr 
                            key={product.id} 
                            className={`border-b border-rose-100 hover:bg-rose-50/50 transition-colors ${
                              index % 2 === 0 ? 'bg-white' : 'bg-rose-25'
                            }`}
                          >
                            <td className="p-4">
                              <div className="font-medium text-gray-900">{product.name}</div>
                            </td>
                            <td className="p-4">
                              <code className="bg-gray-100 px-2 py-1 rounded text-sm">
                                {product.sku}
                              </code>
                            </td>
                            <td className="p-4 font-semibold text-gray-900">
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
                                  className="text-pink-600 hover:text-pink-700 hover:bg-pink-50"
                                  title="Comparar países"
                                >
                                  <GitCompare className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => router.push(`/products/${product.id}`)}
                                  className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                                  title="Ver producto"
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleEditProduct(product)}
                                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
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
