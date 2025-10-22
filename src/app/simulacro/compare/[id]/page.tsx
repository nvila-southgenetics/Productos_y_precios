'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Product, CountryCode } from '@/types'
import { Navbar } from '@/components/Navbar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ProductCountryTableSimulacro } from '@/components/ProductCountryTableSimulacro'
import { COUNTRY_NAMES, COUNTRY_FLAGS } from '@/lib/countryRates'
import { ArrowLeft, Plus, X, FlaskConical } from 'lucide-react'

const ALL_COUNTRIES: CountryCode[] = ['UY', 'AR', 'MX', 'CL', 'VE', 'CO']

export default function SimulacroProductComparePage() {
  const params = useParams()
  const router = useRouter()
  const productId = params.id as string
  
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedCountries, setSelectedCountries] = useState<CountryCode[]>(['UY', 'AR'])

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

  const toggleCountry = (country: CountryCode) => {
    if (selectedCountries.includes(country)) {
      // No permitir deseleccionar si solo queda uno
      if (selectedCountries.length > 1) {
        setSelectedCountries(selectedCountries.filter(c => c !== country))
      }
    } else {
      // Máximo 4 países al mismo tiempo para que se vea bien
      if (selectedCountries.length < 4) {
        setSelectedCountries([...selectedCountries, country])
      }
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

  if (!product) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <Card>
            <CardContent className="py-12 text-center">
              <h3 className="text-lg font-semibold mb-2">Producto no encontrado</h3>
              <Button onClick={() => router.push('/simulacro')}>
                Volver a Simulacro
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

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
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{product.name}</h1>
              <p className="text-muted-foreground mt-1">
                SKU: {product.sku}
              </p>
            </div>
          </div>

          {/* Country Selection */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Seleccionar Países para Comparar</CardTitle>
              <CardDescription>
                Selecciona hasta 4 países para comparar sus configuraciones (mínimo 1)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {ALL_COUNTRIES.map((country) => {
                  const isSelected = selectedCountries.includes(country)
                  return (
                    <Button
                      key={country}
                      onClick={() => toggleCountry(country)}
                      variant={isSelected ? "default" : "outline"}
                      className={`
                        flex items-center gap-2 transition-all
                        ${isSelected 
                          ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                          : 'hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600'
                        }
                      `}
                    >
                      <span className="text-lg">{COUNTRY_FLAGS[country]}</span>
                      <span>{COUNTRY_NAMES[country]}</span>
                      {isSelected && selectedCountries.length > 1 && (
                        <X className="w-4 h-4 ml-1" />
                      )}
                    </Button>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Comparison Grid */}
          <div className={`grid gap-6 ${
            selectedCountries.length === 1 ? 'grid-cols-1' :
            selectedCountries.length === 2 ? 'grid-cols-1 lg:grid-cols-2' :
            selectedCountries.length === 3 ? 'grid-cols-1 lg:grid-cols-2 xl:grid-cols-3' :
            'grid-cols-1 lg:grid-cols-2'
          }`}>
            {selectedCountries.map((country) => (
              <div key={country} className="relative">
                <div className="mb-4 flex items-center gap-2 px-2">
                  <span className="text-3xl">{COUNTRY_FLAGS[country]}</span>
                  <h2 className="text-xl font-semibold text-gray-900">
                    {COUNTRY_NAMES[country]}
                  </h2>
                </div>
                <ProductCountryTableSimulacro
                  product={product}
                  countryCode={country}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

