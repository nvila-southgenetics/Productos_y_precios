'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Product, CountryCode, OverrideFields } from '@/types'
import { Navbar } from '@/components/Navbar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ProductCountryTableSimulacro } from '@/components/ProductCountryTableSimulacro'
import { CountryTabs } from '@/components/CountryTabs'
import { ArrowLeft, GitCompare, FlaskConical } from 'lucide-react'

export default function SimulacroProductDetailPage() {
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
    }
  }, [productId])

  const fetchProduct = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .single()

      if (error) {
        console.error('Error fetching product:', error)
        router.push('/simulacro')
      } else {
        setProduct(data)
      }
    } catch (error) {
      console.error('Error fetching product:', error)
      router.push('/simulacro')
    } finally {
      setLoading(false)
    }
  }

  const handleOverridesChange = (newOverrides: OverrideFields) => {
    setOverrides(newOverrides)
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

  if (!product) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Producto no encontrado</h1>
            <Button onClick={() => router.push('/simulacro')}>
              Volver a Simulacro
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
        <div className="max-w-6xl mx-auto">
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
            <div className="flex-1">
              <h1 className="text-3xl font-bold font-heading text-gray-900">{product.name}</h1>
              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                <span>SKU: {product.sku}</span>
              </div>
            </div>
            <Button 
              variant="outline"
              onClick={() => router.push(`/simulacro/compare/${product.id}`)}
              className="hover:bg-orange-50 hover:border-orange-300 hover:text-orange-600"
            >
              <GitCompare className="w-4 h-4 mr-2" />
              Comparar Países
            </Button>
          </div>

          {/* Description Card */}
          {product.description && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Descripción</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700">{product.description}</p>
              </CardContent>
            </Card>
          )}

          {/* Country Tabs */}
          <div className="mb-6">
            <CountryTabs 
              selectedCountry={selectedCountry} 
              onCountryChange={setSelectedCountry}
            />
          </div>

          {/* Country-specific pricing table */}
          <ProductCountryTableSimulacro
            product={product}
            countryCode={selectedCountry}
            onOverridesChange={handleOverridesChange}
          />
        </div>
      </div>
    </div>
  )
}

