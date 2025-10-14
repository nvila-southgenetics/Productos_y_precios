'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Product, CountryCode } from '@/types'
import { Navbar } from '@/components/Navbar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ProductCountryTable } from '@/components/ProductCountryTable'
import { COUNTRY_NAMES, COUNTRY_FLAGS } from '@/lib/countryRates'
import { ArrowLeft, Plus, X } from 'lucide-react'

const ALL_COUNTRIES: CountryCode[] = ['UY', 'AR', 'MX', 'CL', 'VE', 'CO']

export default function ProductComparePage() {
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
      <div className="min-h-screen">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500"></div>
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
          <Card>
            <CardContent className="py-12 text-center">
              <h3 className="text-lg font-semibold mb-2">Producto no encontrado</h3>
              <Button onClick={() => router.push('/products')}>
                Volver a Productos
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => router.push('/products')}
            className="mb-4 text-pink-600 hover:text-pink-700"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver a Productos
          </Button>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold font-heading text-gray-900 sparkles-multiple">
                Comparar: {product.name} ✨
              </h1>
              <p className="text-muted-foreground mt-1">
                SKU: {product.sku} | Precio Base: ${product.base_price.toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        {/* Selector de países */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="sparkle-float">Selecciona países para comparar ✨</CardTitle>
            <CardDescription>
              Puedes seleccionar hasta 4 países. Mínimo 1 país.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {ALL_COUNTRIES.map((country) => {
                const isSelected = selectedCountries.includes(country)
                return (
                  <Button
                    key={country}
                    variant={isSelected ? "default" : "outline"}
                    onClick={() => toggleCountry(country)}
                    className={`flex items-center gap-2 ${
                      isSelected 
                        ? 'bg-pink-500 hover:bg-pink-600 text-white btn-sparkle' 
                        : 'hover:bg-pink-50 hover:border-pink-200'
                    }`}
                  >
                    <span className="text-xl">{COUNTRY_FLAGS[country]}</span>
                    <span>{COUNTRY_NAMES[country]}</span>
                    {isSelected && <X className="w-4 h-4 ml-1" />}
                  </Button>
                )
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              💡 Seleccionados: {selectedCountries.length} de 4 máximo
            </p>
          </CardContent>
        </Card>

        {/* Comparación lado a lado */}
        <div className={`grid gap-6 ${
          selectedCountries.length === 1 ? 'grid-cols-1' :
          selectedCountries.length === 2 ? 'grid-cols-1 lg:grid-cols-2' :
          selectedCountries.length === 3 ? 'grid-cols-1 lg:grid-cols-3' :
          'grid-cols-1 lg:grid-cols-2 xl:grid-cols-4'
        }`}>
          {selectedCountries.map((country) => (
            <div key={country} className="flex flex-col">
              {/* Header del país */}
              <Card className="mb-4 bg-gradient-to-r from-pink-100 to-rose-100 border-pink-200">
                <CardHeader className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{COUNTRY_FLAGS[country]}</span>
                      <div>
                        <CardTitle className="text-xl text-pink-900">
                          {COUNTRY_NAMES[country]}
                        </CardTitle>
                        <CardDescription className="text-pink-700">
                          {country}
                        </CardDescription>
                      </div>
                    </div>
                    {selectedCountries.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleCountry(country)}
                        className="text-pink-600 hover:bg-pink-200"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </CardHeader>
              </Card>

              {/* Tabla de cálculos */}
              <ProductCountryTable
                product={product}
                countryCode={country}
              />
            </div>
          ))}
        </div>

        {/* Instrucciones */}
        <Card className="mt-6 bg-pink-50 border-pink-200">
          <CardContent className="py-4">
            <p className="text-sm text-pink-800">
              💡 <strong>Consejo:</strong> Puedes editar los valores en cualquier país haciendo doble clic. 
              Los cambios se guardan automáticamente y puedes comparar campo por campo fácilmente.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

