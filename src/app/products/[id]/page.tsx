'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Product, CountryCode, ProductCountryOverride, OverrideFields } from '@/types'
import { Navbar } from '@/components/Navbar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ProductCountryTable } from '@/components/ProductCountryTable'
import { CountryTabs } from '@/components/CountryTabs'
import { ArrowLeft, GitCompare } from 'lucide-react'
import { formatCurrency } from '@/lib/compute'

export default function ProductDetailPage() {
  const params = useParams()
  const router = useRouter()
  const productId = params.id as string
  
  const [product, setProduct] = useState<Product | null>(null)
  const [selectedCountry, setSelectedCountry] = useState<CountryCode>('UY')
  const [overrides, setOverrides] = useState<OverrideFields>({})
  const [loading, setLoading] = useState(true)
  

  useEffect(() => {
    if (productId) {
      fetchProduct()
      fetchOverrides()
    }
  }, [productId])

  useEffect(() => {
    if (product) {
      fetchOverrides()
    }
  }, [selectedCountry])

  const fetchProduct = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .single()

      if (error) {
        console.error('Error fetching product:', error)
        router.push('/products')
      } else {
        setProduct(data)
      }
    } catch (error) {
      console.error('Error fetching product:', error)
      router.push('/products')
    } finally {
      setLoading(false)
    }
  }

  const fetchOverrides = async () => {
    try {
      const { data, error } = await supabase
        .from('product_country_overrides')
        .select('overrides')
        .eq('product_id', productId)
        .eq('country_code', selectedCountry)
        .single()

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
        throw error
      }

      setOverrides((data?.overrides as OverrideFields) || {})
    } catch (error) {
      console.error('Error fetching overrides:', error)
      setOverrides({})
    }
  }

  const handleOverridesChange = (newOverrides: OverrideFields) => {
    setOverrides(newOverrides)
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

  if (!product) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Producto no encontrado</h1>
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
        <div className="max-w-6xl mx-auto">
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
              <h1 className="text-3xl font-bold font-heading text-gray-900">{product.name}</h1>
              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                <span>SKU: {product.sku}</span>
                <span>•</span>
                <span>Precio base: {formatCurrency(product.base_price, product.currency || undefined)}</span>
              </div>
            </div>
            <Button 
              onClick={() => router.push(`/products/compare/${product.id}`)}
              className="bg-pink-500 hover:bg-pink-600 text-white"
            >
              <GitCompare className="w-4 h-4 mr-2" />
              Comparar Países
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-3 space-y-6">
              {/* Country Tabs */}
              <Card>
                <CardHeader>
                  <CardTitle>Vista por País</CardTitle>
                  <CardDescription>
                    Selecciona un país para ver el cálculo de precios específico
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <CountryTabs 
                    selectedCountry={selectedCountry}
                    onCountryChange={setSelectedCountry}
                  />
                </CardContent>
              </Card>

              {/* Pricing Table */}
              <ProductCountryTable 
                product={product}
                countryCode={selectedCountry}
                onOverridesChange={handleOverridesChange}
              />
            </div>

            {/* Sidebar */}
            <div className="space-y-6">

              {/* Product Info */}
              <Card>
                <CardHeader>
                  <CardTitle>Información del Producto</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <span className="text-sm text-muted-foreground">Nombre:</span>
                    <p className="font-medium">{product.name}</p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">SKU:</span>
                    <p className="font-mono text-sm">{product.sku}</p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Precio base:</span>
                    <p className="font-medium">{formatCurrency(product.base_price, product.currency || undefined)}</p>
                  </div>
                  {product.description && (
                    <div>
                      <span className="text-sm text-muted-foreground">Descripción:</span>
                      <p className="text-sm">{product.description}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
