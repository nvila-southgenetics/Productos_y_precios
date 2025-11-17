'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Navbar } from '@/components/Navbar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrowLeft } from 'lucide-react'
import { PRODUCT_CATEGORIES, getCategoryFromProductName, getTypeFromProductName, CategoryName } from '@/lib/categories'

export default function NewProductPage() {
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    description: '',
    category: '' as CategoryName | '',
    tipo: '' as string | ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // Obtener el usuario autenticado
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      
      if (userError || !user) {
        throw new Error('No estás autenticado')
      }

      // Determinar categoría automáticamente si no se especificó
      const category = formData.category || getCategoryFromProductName(formData.name) || null
      // Determinar tipo automáticamente si no se especificó
      const tipo = formData.tipo || getTypeFromProductName(formData.name) || null

      const { error } = await supabase
        .from('products')
        .insert([{
          name: formData.name,
          sku: formData.sku,
          description: formData.description || null,
          category: category,
          tipo: tipo,
          base_price: 10, // Precio por defecto
          currency: 'USD',
          user_id: user.id
        }])

      if (error) {
        throw error
      }

      router.push('/products')
    } catch (error: any) {
      setError(error.message || 'Error al crear el producto')
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
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
              <h1 className="text-3xl font-semibold text-gray-900">Nuevo Producto</h1>
              <p className="text-muted-foreground mt-1">
                Los precios se podrán configurar después desde la vista del producto
              </p>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Información del Producto</CardTitle>
              <CardDescription>
                Completa los datos básicos del producto
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nombre del Producto *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      placeholder="Ej: Onco Básico"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="sku">SKU *</Label>
                    <Input
                      id="sku"
                      value={formData.sku}
                      onChange={(e) => handleInputChange('sku', e.target.value)}
                      placeholder="Ej: ONCO-001"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descripción</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder="Descripción del producto (opcional)"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Categoría</Label>
                  <Select 
                    value={formData.category || ''} 
                    onValueChange={(value) => handleInputChange('category', value)}
                  >
                    <SelectTrigger id="category">
                      <SelectValue placeholder="Seleccionar categoría (opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.keys(PRODUCT_CATEGORIES).filter(cat => cat !== 'Todos').map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Si no seleccionas una categoría, se detectará automáticamente según el nombre del producto
                  </p>
                </div>

                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    💡 El producto se creará con un valor inicial de <strong>$10.00 USD</strong> para Gross Sales. 
                    Podrás configurar los precios por país desde la vista del producto.
                  </p>
                </div>

                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    {error}
                  </div>
                )}

                <div className="flex gap-4 pt-4">
                  <Button type="submit" disabled={loading} className="flex-1 bg-white hover:bg-gray-200 text-black">
                    {loading ? 'Creando...' : 'Crear Producto'}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => router.back()}
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
