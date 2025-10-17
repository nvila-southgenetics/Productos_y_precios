'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Product, CountryCode, OverrideFields } from '@/types'
import { computePricing } from '@/lib/compute'
import { COUNTRY_NAMES, COUNTRY_FLAGS } from '@/lib/countryRates'
import { Navbar } from '@/components/Navbar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, Eye, ArrowUpDown, Search, Grid3X3, Table2 } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { formatCurrency } from '@/lib/compute'

export default function CountryViewPage() {
  const params = useParams()
  const router = useRouter()
  const countryCode = params.countryCode as CountryCode
  
  const [products, setProducts] = useState<Product[]>([])
  const [overrides, setOverrides] = useState<Record<string, OverrideFields>>({})
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'profit'>('name')
  const [searchTerm, setSearchTerm] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')

  // Función para filtrar y ordenar productos
  const getSortedProducts = () => {
    // Primero filtramos
    const filtered = products.filter(product => {
      const searchLower = searchTerm.toLowerCase()
      return (
        product.name.toLowerCase().includes(searchLower) ||
        product.sku.toLowerCase().includes(searchLower) ||
        (product.description && product.description.toLowerCase().includes(searchLower))
      )
    })

    // Luego ordenamos
    const sorted = [...filtered].sort((a, b) => {
      const aOverrides = overrides[a.id] || {}
      const bOverrides = overrides[b.id] || {}
      const aResult = computePricing(a, countryCode, aOverrides)
      const bResult = computePricing(b, countryCode, bOverrides)

      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name)
        case 'price':
          return b.base_price - a.base_price
        case 'profit':
          return bResult.grossProfit.amount - aResult.grossProfit.amount
        default:
          return 0
      }
    })
    return sorted
  }

  useEffect(() => {
    if (countryCode) {
      fetchProducts()
      fetchAllOverrides()
    }
  }, [countryCode])

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name')

      if (error) throw error
      setProducts(data || [])
    } catch (error) {
      console.error('Error fetching products:', error)
    }
  }

  const fetchAllOverrides = async () => {
    try {
      const { data, error } = await supabase
        .from('product_country_overrides')
        .select('*')
        .eq('country_code', countryCode)

      if (error) throw error

      const overridesMap: Record<string, OverrideFields> = {}
      data?.forEach(override => {
        overridesMap[override.product_id] = (override.overrides as OverrideFields) || {}
      })
      setOverrides(overridesMap)
    } catch (error) {
      console.error('Error fetching overrides:', error)
    } finally {
      setLoading(false)
    }
  }

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

  if (!COUNTRY_NAMES[countryCode]) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">País no encontrado</h1>
            <Button onClick={() => router.push('/products')}>
              Volver a Productos
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <Button 
              variant="outline" 
              onClick={() => router.back()}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Volver
            </Button>
            <div className="flex-1">
              <h1 className="text-3xl font-bold font-heading text-gray-900 flex items-center gap-3">
                <span>{COUNTRY_FLAGS[countryCode]}</span>
                Vista por País - {COUNTRY_NAMES[countryCode]}
              </h1>
              <p className="text-muted-foreground mt-2">
                Compara todos los productos y sus precios para {COUNTRY_NAMES[countryCode]}
              </p>
            </div>
          </div>

          {/* Search and Sort Controls */}
          <div className="space-y-4 mb-6">
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                type="text"
                placeholder="Buscar por nombre, SKU o descripción..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Sort Controls and View Toggle */}
            <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Ordenar por:</span>
              <Select value={sortBy} onValueChange={(value: 'name' | 'price' | 'profit') => setSortBy(value)}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Nombre</SelectItem>
                  <SelectItem value="price">Precio Base</SelectItem>
                  <SelectItem value="profit">Ganancia Bruta</SelectItem>
                </SelectContent>
              </Select>
            </div>
              
              <div className="flex items-center gap-3">
            <div className="text-sm text-muted-foreground">
                  {getSortedProducts().length} producto{getSortedProducts().length !== 1 ? 's' : ''}
                  {searchTerm && ` de ${products.length}`}
                </div>
                
                {/* View Toggle */}
                <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
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
                    <Table2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Products Grid/Table */}
          {getSortedProducts().length === 0 ? (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {searchTerm ? 'No se encontraron resultados' : 'No hay productos'}
                  </h3>
                    <p className="text-muted-foreground mb-4">
                    {searchTerm 
                      ? `No se encontraron productos que coincidan con "${searchTerm}".`
                      : 'No se encontraron productos para mostrar.'
                    }
                  </p>
                  {searchTerm ? (
                    <Button 
                      variant="outline"
                      onClick={() => setSearchTerm('')}
                    >
                      Limpiar búsqueda
                    </Button>
                  ) : (
                    <Button onClick={() => router.push('/products/new')}>
                      Crear Primer Producto
                    </Button>
                  )}
                  </div>
                </CardContent>
              </Card>
          ) : viewMode === 'grid' ? (
            <div className="space-y-6">
              {getSortedProducts().map((product) => {
                const productOverrides = overrides[product.id] || {}
                const computedResult = computePricing(product, countryCode, productOverrides)
                
                return (
                  <Card key={product.id} className="overflow-hidden">
                    <CardHeader className="pb-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-xl">{product.name}</CardTitle>
                          <CardDescription>
                            SKU: {product.sku} • Precio base: {formatCurrency(product.base_price, product.currency || undefined)}
                          </CardDescription>
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => router.push(`/products/${product.id}`)}
                          className="flex items-center gap-2"
                        >
                          <Eye className="w-4 h-4" />
                          Ver Detalle
                        </Button>
                      </div>
                    </CardHeader>
                    
                    <CardContent className="pt-0">
                      <ProductSummaryCard 
                        product={product}
                        computedResult={computedResult}
                        countryCode={countryCode}
                      />
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b-2 border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Producto
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          SKU
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Precio Base
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Gross Sales
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Sales Revenue
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Total Costs
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Gross Profit
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Margen %
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Acciones
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {getSortedProducts().map((product) => {
                        const productOverrides = overrides[product.id] || {}
                        const computedResult = computePricing(product, countryCode, productOverrides)
                        const { grossSales, salesRevenue, totalCostOfSales, grossProfit } = computedResult
                        
                        return (
                          <tr 
                            key={product.id} 
                            className="hover:bg-gray-50 transition-colors cursor-pointer"
                            onClick={() => router.push(`/products/${product.id}`)}
                          >
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">
                              {product.name}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600 font-mono">
                              {product.sku}
                            </td>
                            <td className="px-4 py-3 text-sm text-right font-mono text-gray-900">
                              {formatCurrency(product.base_price)}
                            </td>
                            <td className="px-4 py-3 text-sm text-right font-mono text-gray-900">
                              {formatCurrency(grossSales.amount)}
                            </td>
                            <td className="px-4 py-3 text-sm text-right font-mono text-blue-900">
                              {formatCurrency(salesRevenue.amount)}
                            </td>
                            <td className="px-4 py-3 text-sm text-right font-mono text-orange-900">
                              {formatCurrency(totalCostOfSales.amount)}
                            </td>
                            <td className="px-4 py-3 text-sm text-right font-mono text-emerald-700 font-semibold">
                              {formatCurrency(grossProfit.amount)}
                            </td>
                            <td className="px-4 py-3 text-sm text-right font-mono text-emerald-600">
                              {grossProfit.pct?.toFixed(1)}%
                            </td>
                            <td className="px-4 py-3 text-center">
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  router.push(`/products/${product.id}`)
                                }}
                                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

// Componente para mostrar un resumen compacto de los datos más importantes
function ProductSummaryCard({ 
  product, 
  computedResult, 
  countryCode 
}: { 
  product: Product
  computedResult: any
  countryCode: CountryCode 
}) {
  const { grossSales, salesRevenue, totalCostOfSales, grossProfit } = computedResult

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {/* Gross Sales */}
      <div className="text-center p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div className="text-sm text-muted-foreground mb-1">Gross Sales</div>
        <div className="text-lg font-semibold text-gray-900 font-mono">
          {formatCurrency(grossSales.amount)}
        </div>
      </div>

      {/* Sales Revenue */}
      <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
        <div className="text-sm text-muted-foreground mb-1">Sales Revenue</div>
        <div className="text-lg font-semibold text-blue-900 font-mono">
          {formatCurrency(salesRevenue.amount)}
        </div>
        <div className="text-xs text-blue-600">
          {salesRevenue.pct?.toFixed(1)}% del Gross Sales
        </div>
      </div>

      {/* Total Cost of Sales */}
      <div className="text-center p-4 bg-orange-50 rounded-lg border border-orange-200">
        <div className="text-sm text-muted-foreground mb-1">Total Costs</div>
        <div className="text-lg font-semibold text-orange-900 font-mono">
          {formatCurrency(totalCostOfSales.amount)}
        </div>
        <div className="text-xs text-orange-600">
          {totalCostOfSales.pct?.toFixed(1)}% del Revenue
        </div>
      </div>

      {/* Gross Profit */}
      <div className="text-center p-4 bg-emerald-50 rounded-lg border border-emerald-200">
        <div className="text-sm text-muted-foreground mb-1">Gross Profit</div>
        <div className="text-lg font-semibold text-emerald-700 font-mono">
          {formatCurrency(grossProfit.amount)}
        </div>
        <div className="text-xs text-emerald-600">
          {grossProfit.pct?.toFixed(1)}% del Revenue
        </div>
      </div>
    </div>
  )
}
