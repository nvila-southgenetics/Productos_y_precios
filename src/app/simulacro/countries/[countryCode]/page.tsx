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
import { ArrowLeft, Eye, ArrowUpDown, Search, Grid3X3, Table2, FlaskConical } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { formatCurrency } from '@/lib/compute'

export default function SimulacroCountryViewPage() {
  const params = useParams()
  const router = useRouter()
  const countryCode = params.countryCode as CountryCode
  
  const [products, setProducts] = useState<Product[]>([])
  const [overrides, setOverrides] = useState<Record<string, OverrideFields>>({})
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'profit'>('name')
  const [searchTerm, setSearchTerm] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')

  // Función para obtener los overrides de localStorage
  const loadSimulacroOverrides = () => {
    const overridesMap: Record<string, OverrideFields> = {}
    
    products.forEach(product => {
      const configType = countryCode === 'MX' ? 'precio_lista' : 'default'
      const storageKey = `simulacro_${product.id}_${countryCode}_${configType}`
      const savedData = localStorage.getItem(storageKey)
      
      if (savedData) {
        try {
          overridesMap[product.id] = JSON.parse(savedData) as OverrideFields
        } catch (error) {
          console.error('Error parsing simulacro overrides:', error)
        }
      }
    })
    
    setOverrides(overridesMap)
  }

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
          // Ordenar por Gross Sales
          const aGrossSales = aOverrides?.grossSalesUSD !== undefined ? aOverrides.grossSalesUSD : a.base_price
          const bGrossSales = bOverrides?.grossSalesUSD !== undefined ? bOverrides.grossSalesUSD : b.base_price
          return bGrossSales - aGrossSales
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
    }
  }, [countryCode])

  useEffect(() => {
    if (products.length > 0) {
      loadSimulacroOverrides()
    }
  }, [products, countryCode])

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
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
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
            <Button onClick={() => router.push('/simulacro')}>
              Volver a Simulacro
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const sortedProducts = getSortedProducts()

  // Calcular métricas totales
  const totalRevenue = sortedProducts.reduce((sum, product) => {
    const productOverrides = overrides[product.id] || {}
    const result = computePricing(product, countryCode, productOverrides)
    return sum + result.salesRevenue.amount
  }, 0)

  const totalProfit = sortedProducts.reduce((sum, product) => {
    const productOverrides = overrides[product.id] || {}
    const result = computePricing(product, countryCode, productOverrides)
    return sum + result.grossProfit.amount
  }, 0)

  const averageProfitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Banner de modo simulacro */}
          <div className="mb-6 bg-purple-50 border-2 border-purple-300 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <FlaskConical className="w-6 h-6 text-purple-600" />
              <div>
                <h3 className="text-lg font-semibold text-purple-900">Modo Simulacro Activo</h3>
                <p className="text-sm text-purple-700">Los cambios que realices aquí NO afectarán la base de datos real. Todo se guarda localmente en tu navegador.</p>
              </div>
            </div>
          </div>

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
            <div className="flex items-center gap-3">
              <span className="text-5xl">{COUNTRY_FLAGS[countryCode]}</span>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{COUNTRY_NAMES[countryCode]}</h1>
                <p className="text-muted-foreground">Vista de productos por país - Simulacro</p>
              </div>
            </div>
          </div>

          {/* Métricas generales */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Total de Productos</CardDescription>
                <CardTitle className="text-3xl">{sortedProducts.length}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Revenue Total</CardDescription>
                <CardTitle className="text-3xl text-blue-600">{formatCurrency(totalRevenue)}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-emerald-200">
              <CardHeader className="pb-3 bg-emerald-50">
                <CardDescription className="text-emerald-700">Gross Profit Total</CardDescription>
                <CardTitle className="text-3xl text-emerald-600">{formatCurrency(totalProfit)}</CardTitle>
                <p className="text-sm text-emerald-700">Margen promedio: {averageProfitMargin.toFixed(1)}%</p>
              </CardHeader>
            </Card>
          </div>

          {/* Controles */}
          <div className="flex flex-wrap gap-4 items-center mb-6">
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

            <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Ordenar por Nombre</SelectItem>
                <SelectItem value="price">Ordenar por Precio</SelectItem>
                <SelectItem value="profit">Ordenar por Ganancia</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex gap-2 border border-gray-200 rounded-lg p-1 bg-white">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
                className={viewMode === 'grid' ? 'bg-orange-500 hover:bg-orange-600' : ''}
              >
                <Grid3X3 className="w-4 h-4 mr-2" />
                Tarjetas
              </Button>
              <Button
                variant={viewMode === 'table' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('table')}
                className={viewMode === 'table' ? 'bg-orange-500 hover:bg-orange-600' : ''}
              >
                <Table2 className="w-4 h-4 mr-2" />
                Tabla
              </Button>
            </div>
          </div>

          {/* Vista de productos */}
          {sortedProducts.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-gray-500">No se encontraron productos con ese criterio</p>
              </CardContent>
            </Card>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sortedProducts.map((product) => {
                const productOverrides = overrides[product.id] || {}
                const result = computePricing(product, countryCode, productOverrides)
                
                return (
                  <Card key={product.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <CardTitle className="text-lg">{product.name}</CardTitle>
                      <CardDescription>SKU: {product.sku}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div>
                          <p className="text-sm text-gray-600">Gross Sales</p>
                          <p className="text-xl font-bold text-gray-900">
                            {formatCurrency(result.grossSales.amount)}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Revenue</p>
                          <p className="text-lg font-semibold text-blue-600">
                            {formatCurrency(result.salesRevenue.amount)}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Gross Profit</p>
                          <p className="text-lg font-semibold text-emerald-600">
                            {formatCurrency(result.grossProfit.amount)}
                          </p>
                          <p className="text-xs text-gray-500">
                            Margen: {result.grossProfit.pct.toFixed(1)}%
                          </p>
                        </div>
                        <Button
                          onClick={() => router.push(`/simulacro/${product.id}`)}
                          className="w-full bg-blue-600 text-white hover:bg-blue-700"
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          Ver Detalles
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="text-left p-4 font-semibold text-gray-900">Producto</th>
                      <th className="text-left p-4 font-semibold text-gray-900">SKU</th>
                      <th className="text-right p-4 font-semibold text-gray-900">Gross Sales</th>
                      <th className="text-right p-4 font-semibold text-gray-900">Revenue</th>
                      <th className="text-right p-4 font-semibold text-gray-900">Gross Profit</th>
                      <th className="text-right p-4 font-semibold text-gray-900">Margen %</th>
                      <th className="text-right p-4 font-semibold text-gray-900">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedProducts.map((product) => {
                      const productOverrides = overrides[product.id] || {}
                      const result = computePricing(product, countryCode, productOverrides)
                      
                      return (
                        <tr key={product.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="p-4 font-medium text-gray-900">{product.name}</td>
                          <td className="p-4 text-gray-600">{product.sku}</td>
                          <td className="p-4 text-right font-medium text-gray-900">
                            {formatCurrency(result.grossSales.amount)}
                          </td>
                          <td className="p-4 text-right font-medium text-blue-600">
                            {formatCurrency(result.salesRevenue.amount)}
                          </td>
                          <td className="p-4 text-right font-medium text-emerald-600">
                            {formatCurrency(result.grossProfit.amount)}
                          </td>
                          <td className="p-4 text-right text-gray-600">
                            {result.grossProfit.pct.toFixed(1)}%
                          </td>
                          <td className="p-4 text-right">
                            <Button
                              size="sm"
                              onClick={() => router.push(`/simulacro/${product.id}`)}
                              className="bg-blue-600 text-white hover:bg-blue-700"
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              Ver
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

