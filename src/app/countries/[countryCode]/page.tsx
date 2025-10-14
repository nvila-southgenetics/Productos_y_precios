'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Product, CountryCode, OverrideFields } from '@/types'
import { computePricing } from '@/lib/compute'
import { COUNTRY_NAMES, COUNTRY_FLAGS } from '@/lib/countryRates'
import { Navbar } from '@/components/Navbar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, Eye, ArrowUpDown } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatCurrency } from '@/lib/compute'

export default function CountryViewPage() {
  const params = useParams()
  const router = useRouter()
  const countryCode = params.countryCode as CountryCode
  
  const [products, setProducts] = useState<Product[]>([])
  const [overrides, setOverrides] = useState<Record<string, OverrideFields>>({})
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'profit'>('name')

  // Función para ordenar productos
  const getSortedProducts = () => {
    const sorted = [...products].sort((a, b) => {
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
        overridesMap[override.product_id] = override.overrides || {}
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

  if (!COUNTRY_NAMES[countryCode]) {
    return (
      <div className="min-h-screen">
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
    <div className="min-h-screen">
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

          {/* Sort Controls */}
          <div className="flex items-center justify-between mb-6">
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
            <div className="text-sm text-muted-foreground">
              {products.length} producto{products.length !== 1 ? 's' : ''}
            </div>
          </div>

          {/* Products Grid */}
          <div className="space-y-6">
            {products.length === 0 ? (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No hay productos</h3>
                    <p className="text-muted-foreground mb-4">
                      No se encontraron productos para mostrar.
                    </p>
                    <Button onClick={() => router.push('/products/new')}>
                      Crear Primer Producto
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              getSortedProducts().map((product) => {
                const productOverrides = overrides[product.id] || {}
                const computedResult = computePricing(product, countryCode, productOverrides)
                
                return (
                  <Card key={product.id} className="overflow-hidden">
                    <CardHeader className="pb-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-xl">{product.name}</CardTitle>
                          <CardDescription>
                            SKU: {product.sku} • Precio base: {formatCurrency(product.base_price, product.currency)}
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
              })
            )}
          </div>
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
      <div className="text-center p-4 bg-rose-25 rounded-lg border border-rose-100">
        <div className="text-sm text-muted-foreground mb-1">Gross Sales</div>
        <div className="text-lg font-semibold text-rose-900 font-mono">
          {formatCurrency(grossSales.amount)}
        </div>
      </div>

      {/* Sales Revenue */}
      <div className="text-center p-4 bg-blue-25 rounded-lg border border-blue-100">
        <div className="text-sm text-muted-foreground mb-1">Sales Revenue</div>
        <div className="text-lg font-semibold text-blue-900 font-mono">
          {formatCurrency(salesRevenue.amount)}
        </div>
        <div className="text-xs text-blue-600">
          {salesRevenue.pct?.toFixed(1)}% del Gross Sales
        </div>
      </div>

      {/* Total Cost of Sales */}
      <div className="text-center p-4 bg-orange-25 rounded-lg border border-orange-100">
        <div className="text-sm text-muted-foreground mb-1">Total Costs</div>
        <div className="text-lg font-semibold text-orange-900 font-mono">
          {formatCurrency(totalCostOfSales.amount)}
        </div>
        <div className="text-xs text-orange-600">
          {totalCostOfSales.pct?.toFixed(1)}% del Revenue
        </div>
      </div>

      {/* Gross Profit */}
      <div className="text-center p-4 bg-green-25 rounded-lg border border-green-100">
        <div className="text-sm text-muted-foreground mb-1">Gross Profit</div>
        <div className="text-lg font-semibold text-green-900 font-mono">
          {formatCurrency(grossProfit.amount)}
        </div>
        <div className="text-xs text-green-600">
          {grossProfit.pct?.toFixed(1)}% del Revenue
        </div>
      </div>
    </div>
  )
}
