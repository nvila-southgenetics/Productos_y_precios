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
import { FlaskConical, Eye, Globe, GitCompare, Search, ArrowUpDown, ArrowUp, ArrowDown, Trash2, AlertCircle, Package } from 'lucide-react'

type ViewMode = 'grid' | 'table'
type SortOrder = 'none' | 'asc' | 'desc'

export default function SimulacroPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [searchTerm, setSearchTerm] = useState('')
  const [sortOrder, setSortOrder] = useState<SortOrder>('none')
  const router = useRouter()

  useEffect(() => {
    fetchProducts()
  }, [])

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .ilike('name', '%Test%')  // Buscar productos que contengan "Test" (case insensitive)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching products:', error)
        router.push('/login')
      } else {
        console.log('Productos encontrados:', data)
        setProducts(data || [])
      }
    } catch (error) {
      console.error('Error fetching products:', error)
    } finally {
      setLoading(false)
    }
  }

  const clearSimulationData = () => {
    if (confirm('¿Estás seguro de que deseas eliminar todos los datos del simulacro? Esta acción no se puede deshacer.')) {
      localStorage.removeItem('simulacro_overrides')
      alert('Todos los datos del simulacro han sido eliminados')
      window.location.reload()
    }
  }

  const toggleSortOrder = () => {
    if (sortOrder === 'none') setSortOrder('asc')
    else if (sortOrder === 'asc') setSortOrder('desc')
    else setSortOrder('none')
  }

  const filteredAndSortedProducts = products
    .filter(product => 
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.description?.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      if (sortOrder === 'none') return 0
      if (sortOrder === 'asc') return a.base_price - b.base_price
      return b.base_price - a.base_price
    })

  const getSortIcon = () => {
    if (sortOrder === 'none') return <ArrowUpDown className="w-4 h-4" />
    if (sortOrder === 'asc') return <ArrowUp className="w-4 h-4" />
    return <ArrowDown className="w-4 h-4" />
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        {/* Banner de modo simulacro */}
        <div className="mb-6 bg-purple-50 border-2 border-purple-300 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FlaskConical className="w-6 h-6 text-purple-600" />
            <div>
              <h3 className="text-lg font-semibold text-purple-900">Modo Simulacro Activo</h3>
              <p className="text-sm text-purple-700">Los cambios que realices aquí NO afectarán la base de datos real. Todo se guarda localmente en tu navegador.</p>
            </div>
          </div>
          <Button
            onClick={clearSimulationData}
            variant="outline"
            className="border-red-300 text-red-600 hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Limpiar Simulacro
          </Button>
        </div>

        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-2">
              <FlaskConical className="w-8 h-8 text-purple-600" />
              Simulacro de Productos
            </h1>
            <p className="text-gray-600">
              Prueba cambios en los precios sin afectar los datos reales
            </p>
          </div>
        </div>

        {/* Filtros y controles */}
        <div className="mb-6 flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-[300px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                type="text"
                placeholder="Buscar por nombre, SKU o descripción..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          
          <Button
            variant="outline"
            onClick={toggleSortOrder}
            className="flex items-center gap-2"
          >
            {getSortIcon()}
            Ordenar por Gross Sales {sortOrder === 'asc' && '↑'} {sortOrder === 'desc' && '↓'}
          </Button>

          <div className="flex gap-2 border border-gray-200 rounded-lg p-1 bg-white">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
              className={viewMode === 'grid' ? 'bg-orange-500 hover:bg-orange-600' : ''}
            >
              <Package className="w-4 h-4 mr-2" />
              Tarjetas
            </Button>
            <Button
              variant={viewMode === 'table' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('table')}
              className={viewMode === 'table' ? 'bg-orange-500 hover:bg-orange-600' : ''}
            >
              <Globe className="w-4 h-4 mr-2" />
              Tabla
            </Button>
          </div>
        </div>

        {/* Quick Country Navigation */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-purple-600" />
              Vista por País
            </CardTitle>
            <CardDescription>
              Compara todos los productos y sus precios por país en modo simulacro
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {(Object.keys(COUNTRY_NAMES) as Array<keyof typeof COUNTRY_NAMES>).map((countryCode) => (
                <Button
                  key={countryCode}
                  variant="outline"
                  onClick={() => router.push(`/simulacro/countries/${countryCode}`)}
                  className="flex flex-col items-center gap-2 h-auto py-4 hover:bg-purple-50 hover:border-purple-300 hover:text-purple-600"
                >
                  <span className="text-2xl">{COUNTRY_FLAGS[countryCode]}</span>
                  <span className="text-sm font-medium">{COUNTRY_NAMES[countryCode]}</span>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Vista de productos */}
        {filteredAndSortedProducts.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Package className="w-16 h-16 text-gray-300 mb-4" />
              <p className="text-gray-500 text-lg">
                {searchTerm ? 'No se encontraron productos con ese criterio' : 'No hay productos disponibles'}
              </p>
            </CardContent>
          </Card>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredAndSortedProducts.map((product) => (
              <Card key={product.id} className="hover:shadow-lg transition-shadow border-gray-200">
                <CardHeader className="border-b border-gray-100 bg-gray-50">
                  <CardTitle className="text-lg flex items-center justify-between">
                    <span className="text-gray-900">{product.name}</span>
                  </CardTitle>
                  <CardDescription className="text-sm text-gray-600">
                    SKU: {product.sku}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                  {product.description && (
                    <p className="text-sm text-gray-600 mb-4 line-clamp-2">{product.description}</p>
                  )}
                  
                  <div className="flex flex-wrap gap-1 mb-4">
                    {Object.keys(COUNTRY_NAMES).map((code) => (
                      <span key={code} className="text-lg" title={COUNTRY_NAMES[code as keyof typeof COUNTRY_NAMES]}>
                        {COUNTRY_FLAGS[code as keyof typeof COUNTRY_FLAGS]}
                      </span>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={() => router.push(`/simulacro/${product.id}`)}
                      className="flex-1 bg-blue-600 text-white hover:bg-blue-700"
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      Ver
                    </Button>
                    <Button
                      onClick={() => router.push(`/simulacro/compare/${product.id}`)}
                      variant="outline"
                      className="flex-1 hover:bg-orange-50 hover:border-orange-300 hover:text-orange-600"
                    >
                      <GitCompare className="w-4 h-4 mr-2" />
                      Comparar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left p-4 font-semibold text-gray-900">Nombre</th>
                    <th className="text-left p-4 font-semibold text-gray-900">SKU</th>
                    <th className="text-left p-4 font-semibold text-gray-900">Descripción</th>
                    <th className="text-center p-4 font-semibold text-gray-900">Países</th>
                    <th className="text-right p-4 font-semibold text-gray-900">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSortedProducts.map((product) => (
                    <tr key={product.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="p-4 font-medium text-gray-900">{product.name}</td>
                      <td className="p-4 text-gray-600">{product.sku}</td>
                      <td className="p-4 text-gray-600">
                        <span className="line-clamp-1">{product.description || '-'}</span>
                      </td>
                      <td className="p-4">
                        <div className="flex justify-center gap-1">
                          {Object.keys(COUNTRY_NAMES).map((code) => (
                            <span key={code} className="text-lg">
                              {COUNTRY_FLAGS[code as keyof typeof COUNTRY_FLAGS]}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex gap-2 justify-end">
                          <Button
                            size="sm"
                            onClick={() => router.push(`/simulacro/${product.id}`)}
                            className="bg-blue-600 text-white hover:bg-blue-700"
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            Ver
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => router.push(`/simulacro/compare/${product.id}`)}
                            className="hover:bg-orange-50 hover:border-orange-300 hover:text-orange-600"
                          >
                            <GitCompare className="w-4 h-4 mr-1" />
                            Comparar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </main>
    </div>
  )
}

