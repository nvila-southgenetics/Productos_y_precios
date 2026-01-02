'use client'

export const dynamic = 'force-dynamic'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Navbar } from '@/components/Navbar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BarChart3, TrendingUp, Package, AlertCircle, ChevronDown, ChevronRight, Filter, X, Calculator, Trash2, AlertTriangle, Edit2, Calendar, ChevronLeft, FlaskConical } from 'lucide-react'
import { formatCurrency, computePricing } from '@/lib/compute'
import { supabase } from '@/lib/supabase'
import { CountryCode, Sale, Product } from '@/types'
import { COUNTRY_NAMES, COUNTRY_FLAGS } from '@/lib/countryRates'
import { CategoryBadge } from '@/components/CategoryBadge'
import { TypeBadge } from '@/components/TypeBadge'
import { getCategoryFromProductName, CategoryName } from '@/lib/categories'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

interface MonthlySales {
  month: number
  year: number
  quantity: number
}

/**
 * Página de visualización de ventas desde la base de datos
 */
export default function SalesPage() {
  const [error, setError] = useState<string>('')
  const [success, setSuccess] = useState<string>('')
  const [products, setProducts] = useState<Product[]>([])
  const [productNameToIdMap, setProductNameToIdMap] = useState<Record<string, string>>({})
  const [productNameToCategoryMap, setProductNameToCategoryMap] = useState<Record<string, CategoryName | null>>({})
  const [productNameToTypeMap, setProductNameToTypeMap] = useState<Record<string, string | null>>({})
  const [productCompanyToGrossSalesMap, setProductCompanyToGrossSalesMap] = useState<Record<string, number>>({})
  const [productCompanyToGrossProfitMap, setProductCompanyToGrossProfitMap] = useState<Record<string, number>>({})
  const [productCompanyCountryMap, setProductCompanyCountryMap] = useState<Record<string, CountryCode>>({})
  const [selectedCompany, setSelectedCompany] = useState<string>('all')
  const [selectedProduct, setSelectedProduct] = useState<string>('all')
  const [selectedCategory, setSelectedCategory] = useState<CategoryName | 'all'>('all')
  const [selectedType, setSelectedType] = useState<string>('all')
  const [productSearchTerm, setProductSearchTerm] = useState<string>('')
  const [monthlySales, setMonthlySales] = useState<MonthlySales[]>([])
  const [productSales, setProductSales] = useState<Array<{
    producto: string
    mes: number
    año: number
    compañia: string
    cantidad_ventas: number
    monto_total: number
    precio_promedio: number
  }>>([])
  const [availableCompanies, setAvailableCompanies] = useState<string[]>([])
  const [editingQuantity, setEditingQuantity] = useState<string | null>(null)
  const [quantityEditValue, setQuantityEditValue] = useState<string>('')
  const editInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  // Enfocar el input cuando se activa la edición, sin causar scroll
  useEffect(() => {
    if (editingQuantity) {
      const input = editInputRefs.current[editingQuantity]
      if (input) {
        // Verificar si el input está visible
        const rect = input.getBoundingClientRect()
        const isVisible = rect.top >= 0 && rect.bottom <= window.innerHeight
        
        // Solo hacer scroll si no está visible, y usar 'nearest' para minimizar el movimiento
        if (!isVisible) {
          input.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
          setTimeout(() => {
            input.focus()
            input.select()
          }, 100)
        } else {
          // Si está visible, solo enfocar sin scroll
          setTimeout(() => {
            input.focus()
            input.select()
          }, 0)
        }
      }
    }
  }, [editingQuantity])
  const [userId, setUserId] = useState<string | null>(null)
  const [openMonths, setOpenMonths] = useState<Record<string, boolean>>({})
  const [selectedMonths, setSelectedMonths] = useState<string[]>([])
  const [monthFilters, setMonthFilters] = useState<Record<string, {
    productName: string
    category: CategoryName | 'all'
    type: string
  }>>({})
  const [combinedFilter, setCombinedFilter] = useState<{
    productName: string
    category: CategoryName | 'all'
    type: string
  }>({ productName: '', category: 'all', type: 'all' })
  const [productFilterOpen, setProductFilterOpen] = useState<Record<string, boolean>>({})
  const [combinedFilterOpen, setCombinedFilterOpen] = useState(false)
  const [plDialogOpen, setPlDialogOpen] = useState<Record<string, boolean>>({})
  const [combinedPlDialogOpen, setCombinedPlDialogOpen] = useState(false)
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState('productos')
  const router = useRouter()

  // Detectar parámetro de query para activar el tab correspondiente
  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab === 'dashboard') {
      setActiveTab('dashboard')
    } else if (tab === 'productos') {
      setActiveTab('productos')
    }
  }, [searchParams])
  
  // Estados para Dashboard - VERSIÓN SIMPLIFICADA
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth())
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false)
  const [selectedDates, setSelectedDates] = useState<Date[]>([])
  const [ventasDelDia, setVentasDelDia] = useState<Array<{
    test: string
    amount: number
    company: string
    fecha: string
  }>>([])
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [ultimas10Ventas, setUltimas10Ventas] = useState<Array<{
    test: string
    amount: number
    company: string
    fecha: string
  }>>([])
  const [ventasDelMes, setVentasDelMes] = useState<Record<string, number>>({})
  const [loadingVentas, setLoadingVentas] = useState(false)
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState<string>('all')
  
  // Cargar ventas del mes para el calendario
  useEffect(() => {
    if (activeTab !== 'dashboard') return
    
    const loadVentasDelMes = async () => {
      try {
        const supabaseClient = supabase as any
        
        // Obtener todas las ventas y filtrar manualmente
        const { data, error } = await supabaseClient
          .from('ventas')
          .select('fecha, amount')
        
        if (error) {
          console.error('Error cargando ventas del mes:', error)
          return
        }
        
        // Agrupar por fecha, normalizando el formato
        const ventasPorFecha: Record<string, number> = {}
        if (data) {
          data.forEach((venta: any) => {
            let fecha = venta.fecha
            
            // Normalizar formato de fecha
            if (typeof fecha === 'string') {
              fecha = fecha.split('T')[0] // Quitar la parte de tiempo si existe
            } else if (fecha instanceof Date) {
              const year = fecha.getFullYear()
              const month = String(fecha.getMonth() + 1).padStart(2, '0')
              const day = String(fecha.getDate()).padStart(2, '0')
              fecha = `${year}-${month}-${day}`
            }
            
            // Filtrar solo las del mes actual
            const fechaObj = new Date(fecha)
            if (fechaObj.getMonth() === currentMonth && fechaObj.getFullYear() === currentYear) {
              if (!ventasPorFecha[fecha]) {
                ventasPorFecha[fecha] = 0
              }
              ventasPorFecha[fecha] += parseFloat(venta.amount) || 0
            }
          })
        }
        
        console.log('📅 Ventas del mes:', ventasPorFecha)
        setVentasDelMes(ventasPorFecha)
      } catch (error) {
        console.error('Error cargando ventas del mes:', error)
      }
    }
    
    loadVentasDelMes()
  }, [activeTab, currentMonth, currentYear])
  
  // Cargar últimas 10 ventas
  useEffect(() => {
    if (activeTab !== 'dashboard') return
    
    const loadUltimas10Ventas = async () => {
      try {
        const supabaseClient = supabase as any
        const { data, error } = await supabaseClient
          .from('ventas')
          .select('test, amount, company, fecha')
          .order('created_at', { ascending: false })
          .limit(10)
        
        if (error) {
          console.error('Error cargando últimas ventas:', error)
          return
        }
        
        setUltimas10Ventas(data || [])
      } catch (error) {
        console.error('Error cargando últimas ventas:', error)
      }
    }
    
    loadUltimas10Ventas()
  }, [activeTab])
  
  // Cargar ventas del día seleccionado
  const loadVentasDelDia = async (date: Date) => {
    setLoadingVentas(true)
    setVentasDelDia([])
    
    try {
      // Formatear fecha en formato YYYY-MM-DD
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const dateStr = `${year}-${month}-${day}`
      
      console.log('🔍 Buscando ventas para fecha:', dateStr)
      console.log('📅 Fecha objeto:', date)
      
      const supabaseClient = supabase as any
      
      // Primero intentar obtener todas las ventas para ver el formato
      const { data: allData, error: allError } = await supabaseClient
        .from('ventas')
        .select('test, amount, company, fecha')
        .limit(5)
      
      console.log('📊 Ejemplo de datos en la tabla:', allData)
      
      // Ahora buscar por fecha
      const { data, error } = await supabaseClient
        .from('ventas')
        .select('test, amount, company, fecha')
        .order('created_at', { ascending: false })
      
      if (error) {
        console.error('❌ Error cargando ventas del día:', error)
        setVentasDelDia([])
        return
      }
      
      console.log('📊 Todas las ventas obtenidas:', data?.length)
      
      // Filtrar manualmente por fecha porque puede haber problemas de formato
      const ventasFiltradas = (data || []).filter((venta: any) => {
        let ventaFecha = venta.fecha
        
        // Si la fecha viene como string, extraer solo la parte de fecha
        if (typeof ventaFecha === 'string') {
          ventaFecha = ventaFecha.split('T')[0] // Quitar la parte de tiempo si existe
        } else if (ventaFecha instanceof Date) {
          // Si es un objeto Date, convertir a string
          const year = ventaFecha.getFullYear()
          const month = String(ventaFecha.getMonth() + 1).padStart(2, '0')
          const day = String(ventaFecha.getDate()).padStart(2, '0')
          ventaFecha = `${year}-${month}-${day}`
        }
        
        console.log(`🔍 Comparando: "${ventaFecha}" === "${dateStr}"`)
        return ventaFecha === dateStr
      })
      
      console.log('✅ Ventas filtradas para la fecha:', ventasFiltradas.length, ventasFiltradas)
      
      setVentasDelDia(ventasFiltradas)
    } catch (error) {
      console.error('❌ Error cargando ventas del día:', error)
      setVentasDelDia([])
    } finally {
      setLoadingVentas(false)
    }
  }

  // Cerrar dropdowns al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('.filter-dropdown-container')) {
        setProductFilterOpen({})
        setCombinedFilterOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Obtener usuario actual y productos
  useEffect(() => {
    const loadData = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }
      setUserId(session.user.id)


      // Cargar productos
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('*')
        .eq('user_id', session.user.id)

      if (productsError) {
        console.error('Error cargando productos:', productsError)
      } else {
        setProducts(productsData || [])
        // Crear mapas de nombre de producto a ID, categoría y tipo
        const nameToIdMap: Record<string, string> = {}
        const nameToCategoryMap: Record<string, CategoryName | null> = {}
        const nameToTypeMap: Record<string, string | null> = {}
        if (productsData) {
          productsData.forEach((product: Product) => {
            if (product.name) {
              nameToIdMap[product.name] = product.id
              nameToCategoryMap[product.name] = product.category as CategoryName || getCategoryFromProductName(product.name)
              nameToTypeMap[product.name] = product.tipo || null
            }
          })
        }
        setProductNameToIdMap(nameToIdMap)
        setProductNameToCategoryMap(nameToCategoryMap)
        setProductNameToTypeMap(nameToTypeMap)
      }
    }
    loadData()
  }, [router])

  // Función helper para mapear compañía a país
  const getCountryFromCompany = (company: string): CountryCode => {
    const companyUpper = company.toUpperCase()
    if (companyUpper.includes('URUGUAY') || companyUpper.includes('UY')) return 'UY'
    if (companyUpper.includes('ARGENTINA') || companyUpper.includes('AR')) return 'AR'
    if (companyUpper.includes('MEXICO') || companyUpper.includes('MX')) return 'MX'
    if (companyUpper.includes('CHILE') || companyUpper.includes('CL')) return 'CL'
    if (companyUpper.includes('VENEZUELA') || companyUpper.includes('VE')) return 'VE'
    if (companyUpper.includes('COLOMBIA') || companyUpper.includes('CO')) return 'CO'
    // Por defecto Uruguay
    return 'UY'
  }

  // Cargar ventas mensuales desde la vista de base de datos
  useEffect(() => {
    const loadSalesData = async () => {
      // Cargar datos desde la vista ventas_mensuales_view
      let query = (supabase as any)
        .from('ventas_mensuales_view')
        .select('producto, mes, año, compañia, cantidad_ventas, monto_total, precio_promedio')
        .order('año', { ascending: false })
        .order('mes', { ascending: false })

      if (selectedCompany !== 'all') {
        query = query.eq('compañia', selectedCompany)
      }

      if (selectedProduct !== 'all') {
        query = query.eq('producto', selectedProduct)
      }

      const { data, error } = await query

      if (error) {
        console.error('Error cargando ventas:', error)
        return
      }

      if (!data || data.length === 0) {
        setMonthlySales([])
        setProductSales([])
        setAvailableCompanies([])
        setProductCompanyToGrossSalesMap({})
        setProductCompanyToGrossProfitMap({})
        setProductCompanyCountryMap({})
        return
      }

      // Obtener lista de compañías únicas para el filtro
      const companies = Array.from(new Set(data.map((v: any) => v.compañia).filter(Boolean))).sort() as string[]
      setAvailableCompanies(companies)

      // Obtener grossSales y grossProfit desde product_country_overrides para cada combinación producto+compañía
      const grossSalesMap: Record<string, number> = {}
      const grossProfitMap: Record<string, number> = {}
      const productCompanyCountryMap: Record<string, CountryCode> = {}
      
      // Obtener todas las combinaciones únicas de producto+compañía
      const uniqueProductCompanies = Array.from(new Set(data.map((sale: any) => `${sale.producto}-${sale.compañia}`))) as string[]
      
      // Cargar overrides para cada combinación
      for (const key of uniqueProductCompanies) {
        const [productoName, compañia] = key.split('-') as [string, string]
        const product = products.find(p => p.name === productoName)
        if (!product) {
          grossSalesMap[key] = 0
          grossProfitMap[key] = 0
          productCompanyCountryMap[key] = 'UY'
          continue
        }
        
        const country = getCountryFromCompany(compañia)
        productCompanyCountryMap[key] = country
        
        // Determinar el tipo de configuración según el país
        const mxConfig = country === 'MX' ? 'precio_lista' : 'default'
        const clConfig = country === 'CL' ? 'precio_lista' : 'default'
        const colConfig = country === 'CO' ? 'precio_lista' : 'default'
        
        // Obtener overrides desde la base de datos
        const { data: overrideData, error: overrideError } = await supabase
          .from('product_country_overrides')
          .select('overrides')
          .eq('product_id', product.id)
          .eq('country_code', country)
          .eq('mx_config_type', mxConfig)
          .eq('cl_config_type', clConfig)
          .eq('col_config_type', colConfig)
          .single()
        
        if (overrideError && overrideError.code !== 'PGRST116') {
          console.error(`Error cargando overrides para ${productoName} en ${country}:`, overrideError)
          // Si hay error, usar computePricing como fallback
          const computed = computePricing(product, country)
          grossSalesMap[key] = Math.max(0, computed.grossSales.amount)
          grossProfitMap[key] = Math.max(0, computed.grossProfit.amount)
          continue
        }
        
        const overrides = (overrideData?.overrides as any) || {}
        
        // Obtener grossSalesUSD del override, o usar computePricing como fallback
        let grossSalesUSD = overrides.grossSalesUSD
        if (grossSalesUSD === undefined || grossSalesUSD === null) {
          // Si no hay override, usar computePricing
          const computed = computePricing(product, country)
          grossSalesUSD = computed.grossSales.amount
        }
        grossSalesMap[key] = Math.max(0, grossSalesUSD)
        
        // Calcular grossProfit: grossSalesUSD - suma de todos los costos del override
        // Usar computePricing para calcular correctamente los costos (maneja USD y porcentajes)
        const computed = computePricing(product, country, overrides)
        
        // El grossProfit ya está calculado correctamente en computed.grossProfit.amount
        // que considera todos los costos (USD y porcentajes) del override
        grossProfitMap[key] = Math.max(0, computed.grossProfit.amount)
      }
      
      setProductCompanyToGrossSalesMap(grossSalesMap)
      setProductCompanyToGrossProfitMap(grossProfitMap)
      setProductCompanyCountryMap(productCompanyCountryMap)

      // Agrupar por mes y año para el resumen mensual
      const monthlyGrouped = data.reduce((acc: Record<string, MonthlySales>, sale: any) => {
        const key = `${sale.año}-${sale.mes}`
        if (!acc[key]) {
          acc[key] = { month: sale.mes, year: sale.año, quantity: 0 }
        }
        acc[key].quantity += sale.cantidad_ventas
        return acc
      }, {})

      const monthly = (Object.values(monthlyGrouped) as MonthlySales[]).sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year
        return b.month - a.month
      })

      setMonthlySales(monthly)

      // Ordenar ventas por año, mes, compañía y luego por nombre de producto
      const sortedSales = data.sort((a: any, b: any) => {
        if (a.año !== b.año) return b.año - a.año
        if (a.mes !== b.mes) return b.mes - a.mes
        if (a.compañia !== b.compañia) return a.compañia.localeCompare(b.compañia)
        return a.producto.localeCompare(b.producto)
      })

      setProductSales(sortedSales)
    }

    loadSalesData()
  }, [selectedCompany, selectedProduct, products])





  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ]

  // Funciones para el calendario
  const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

  const getDaysInMonth = (month: number, year: number) => {
    return new Date(year, month + 1, 0).getDate()
  }

  const getFirstDayOfMonth = (month: number, year: number) => {
    return new Date(year, month, 1).getDay()
  }

  const handleDateClick = async (day: number) => {
    const date = new Date(currentYear, currentMonth, day)
    
    if (isMultiSelectMode) {
      // Modo selección múltiple - seleccionar rango entre dos fechas
      setSelectedDates(prev => {
        if (prev.length === 0) {
          // Primera fecha seleccionada
          return [date]
        } else if (prev.length === 1) {
          // Segunda fecha seleccionada - seleccionar todas las fechas entre las dos
          const firstDate = prev[0]
          const secondDate = date
          
          // Determinar fecha mínima y máxima
          const minDate = firstDate < secondDate ? firstDate : secondDate
          const maxDate = firstDate > secondDate ? firstDate : secondDate
          
          // Generar todas las fechas entre minDate y maxDate (inclusive)
          const allDates: Date[] = []
          const current = new Date(minDate)
          
          while (current <= maxDate) {
            allDates.push(new Date(current))
            current.setDate(current.getDate() + 1)
          }
          
          return allDates
        } else {
          // Si ya hay un rango seleccionado, empezar de nuevo con esta fecha
          return [date]
        }
      })
    } else {
      // Modo selección simple - enviar webhook inmediatamente
      setSelectedDate(date)
      setSelectedCompanyFilter('all')
      
      // Enviar webhook con la fecha única
      setLoadingVentas(true)
      setVentasDelDia([])
      
      try {
        const webhookUrl = 'https://n8n.srv908725.hstgr.cloud/webhook/info_de_ventas'
        const fechaStr = date.toISOString().split('T')[0]
        const payload = {
          fecha_minima: fechaStr,
          fecha_maxima: fechaStr,
          fechas_seleccionadas: [fechaStr],
          cantidad_fechas: 1
        }
        
        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload)
        })
        
        const responseData = await response.json()
        
        // Procesar respuesta del webhook
        if (responseData && responseData.data && Array.isArray(responseData.data)) {
          const ventasWebhook = responseData.data.map((item: any) => ({
            test: item.nombre_test || 'N/A',
            amount: item.amount_total || 0,
            company: item.company_id || 'N/A',
            fecha: item.fecha || fechaStr
          }))
          setVentasDelDia(ventasWebhook)
        } else {
          // Si no hay datos del webhook, cargar desde la base de datos
          await loadVentasDelDia(date)
        }
      } catch (error) {
        console.error('Error enviando webhook:', error)
        // Aún así cargar las ventas del día
        await loadVentasDelDia(date)
      } finally {
        setLoadingVentas(false)
      }
    }
  }

  const handleSendWebhook = async () => {
    if (selectedDates.length === 0) return

    setLoadingVentas(true)
    setVentasDelDia([])
    
    try {
      // Ordenar fechas y obtener mínima y máxima
      const sortedDates = [...selectedDates].sort((a, b) => a.getTime() - b.getTime())
      const minDate = sortedDates[0]
      const maxDate = sortedDates[sortedDates.length - 1]
      
      const webhookUrl = 'https://n8n.srv908725.hstgr.cloud/webhook/info_de_ventas'
      const payload = {
        fecha_minima: minDate.toISOString().split('T')[0], // Formato YYYY-MM-DD
        fecha_maxima: maxDate.toISOString().split('T')[0], // Formato YYYY-MM-DD
        fechas_seleccionadas: selectedDates.map(d => d.toISOString().split('T')[0]),
        cantidad_fechas: selectedDates.length
      }
      
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      })
      
        const responseData = await response.json()
        
        // Procesar respuesta del webhook
        if (responseData && responseData.data && Array.isArray(responseData.data)) {
          const ventasWebhook = responseData.data.map((item: any) => ({
            test: item.nombre_test || 'N/A',
            amount: item.amount_total || 0,
            company: item.company_id || 'N/A',
            fecha: item.fecha || minDate.toISOString().split('T')[0]
          }))
          setVentasDelDia(ventasWebhook)
        } else {
          // Si no hay datos del webhook, cargar desde la base de datos
          const allVentas: Array<{ test: string; amount: number; company: string; fecha: string }> = []
          
          for (const date of sortedDates) {
            const year = date.getFullYear()
            const month = String(date.getMonth() + 1).padStart(2, '0')
            const day = String(date.getDate()).padStart(2, '0')
            const dateStr = `${year}-${month}-${day}`
            
            const supabaseClient = supabase as any
            const { data, error } = await supabaseClient
              .from('ventas')
              .select('test, amount, company, fecha')
              .order('created_at', { ascending: false })
            
            if (!error && data) {
              const ventasFiltradas = data.filter((venta: any) => {
                let ventaFecha = venta.fecha
                if (typeof ventaFecha === 'string') {
                  ventaFecha = ventaFecha.split('T')[0]
                } else if (ventaFecha instanceof Date) {
                  const year = ventaFecha.getFullYear()
                  const month = String(ventaFecha.getMonth() + 1).padStart(2, '0')
                  const day = String(ventaFecha.getDate()).padStart(2, '0')
                  ventaFecha = `${year}-${month}-${day}`
                }
                return ventaFecha === dateStr
              })
              
              allVentas.push(...ventasFiltradas)
            }
          }
          
          setVentasDelDia(allVentas)
        }
    } catch (error) {
      console.error('Error enviando webhook:', error)
    } finally {
      setLoadingVentas(false)
    }
  }

  const goToPreviousMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11)
      setCurrentYear(currentYear - 1)
    } else {
      setCurrentMonth(currentMonth - 1)
    }
  }

  const goToNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0)
      setCurrentYear(currentYear + 1)
    } else {
      setCurrentMonth(currentMonth + 1)
    }
  }

  const getTotalSalesForDay = (day: number) => {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return ventasDelMes[dateStr] || 0
  }
  
  const getCantidadVentasDelDia = (day: number) => {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    // Contar cuántas ventas hay para este día (necesitamos hacer una consulta o mantener un contador)
    // Por ahora, solo mostramos el total
    return 0
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="mb-6">
            <TabsList className="inline-flex h-12 items-center justify-center rounded-lg bg-gray-100 p-1 text-gray-600 w-full max-w-md">
              <TabsTrigger value="productos" className="flex items-center gap-2 px-6 py-2 data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm">
                <Package className="w-4 h-4" />
                Productos
              </TabsTrigger>
              <TabsTrigger value="dashboard" className="flex items-center gap-2 px-6 py-2 data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm">
                <BarChart3 className="w-4 h-4" />
                Dashboard
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="productos" className="space-y-6">


        {/* Filtro de país */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-blue-600" />
              Filtros de Visualización
            </CardTitle>
            <CardDescription>
              Selecciona una compañía para filtrar las ventas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium">Compañía:</label>
              <Select value={selectedCompany} onValueChange={(value) => setSelectedCompany(value)}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las compañías</SelectItem>
                  {availableCompanies.map((company) => (
                    <SelectItem key={company} value={company}>
                      {company}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              </div>
              
              <div className="flex items-center gap-4">
                <label className="text-sm font-medium">Producto:</label>
                <Select 
                  value={selectedProduct} 
                  onValueChange={(value) => {
                    setSelectedProduct(value)
                    setProductSearchTerm('')
                  }}
                  onOpenChange={(open) => {
                    if (!open) setProductSearchTerm('')
                  }}
                >
                  <SelectTrigger className="w-[400px]">
                    <SelectValue placeholder="Todos los productos">
                      {selectedProduct !== 'all' && (() => {
                        const product = productSales.find(s => s.producto === selectedProduct)
                        return product ? (
                          <div className="flex flex-col items-start">
                            <span className="font-medium">{product.producto}</span>
                          </div>
                        ) : 'Producto seleccionado'
                      })()}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    <div className="p-2 sticky top-0 bg-white z-10">
                      <input
                        type="text"
                        placeholder="Buscar producto..."
                        value={productSearchTerm}
                        onChange={(e) => setProductSearchTerm(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      />
                    </div>
                    <SelectItem value="all">Todos los productos</SelectItem>
                      {(() => {
                        const searchTerm = productSearchTerm.toLowerCase().trim()
                        const uniqueProducts = Array.from(new Set(productSales.map(sale => sale.producto)))
                          .map(productoName => {
                            const sale = productSales.find(s => s.producto === productoName)
                            return sale ? { name: productoName } : null
                          })
                          .filter((p): p is { name: string } => p !== null)
                      
                      if (searchTerm === '') {
                        return uniqueProducts
                          .sort((a, b) => a.name.localeCompare(b.name))
                          .map(product => (
                            <SelectItem key={product.name} value={product.name}>
                              <div className="flex flex-col">
                                <span className="font-medium">{product.name}</span>
                              </div>
                            </SelectItem>
                          ))
                      }
                      
                      // Buscar coincidencias exactas primero
                      const exactMatches = uniqueProducts.filter(product => {
                        const nameLower = product.name.toLowerCase()
                        return nameLower === searchTerm
                      })
                      
                      // Si hay coincidencias exactas, SOLO mostrar esas
                      if (exactMatches.length > 0) {
                        return exactMatches
                          .sort((a, b) => a.name.localeCompare(b.name))
                          .map(product => (
                            <SelectItem key={product.name} value={product.name}>
                              <div className="flex flex-col">
                                <span className="font-medium">{product.name}</span>
                              </div>
                            </SelectItem>
                          ))
                      }
                      
                      // Si no hay coincidencias exactas, buscar que contengan el término
                      const filteredProducts = uniqueProducts
                        .filter(product => {
                          const nameLower = product.name.toLowerCase()
                          return nameLower.includes(searchTerm)
                        })
                        .sort((a, b) => {
                          // Ordenar por: primero los que empiezan con el término, luego alfabético
                          const aStarts = a.name.toLowerCase().startsWith(searchTerm)
                          const bStarts = b.name.toLowerCase().startsWith(searchTerm)
                          if (aStarts && !bStarts) return -1
                          if (!aStarts && bStarts) return 1
                          return a.name.localeCompare(b.name)
                        })
                      
                      if (filteredProducts.length === 0) {
                        return (
                          <div className="p-2 text-sm text-gray-500 text-center">
                            No se encontraron productos
                          </div>
                        )
                      }
                      
                      return filteredProducts.map(product => (
                        <SelectItem key={product.name} value={product.name}>
                          <div className="flex flex-col">
                            <span className="font-medium">{product.name}</span>
                          </div>
                        </SelectItem>
                      ))
                    })()}
                  </SelectContent>
                </Select>
                {selectedProduct !== 'all' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedProduct('all')
                      setProductSearchTerm('')
                    }}
                    className="text-gray-600 hover:text-gray-900"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
      </div>
          </CardContent>
        </Card>

        {/* Detalle de productos vendidos */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-6 h-6 text-green-600" />
              Detalle de Productos Vendidos
            </CardTitle>
            <CardDescription>
              Lista de productos vendidos con sus cantidades totales
            </CardDescription>
          </CardHeader>
          <CardContent>
            {productSales.length > 0 ? (
              <div className="space-y-2">
                {(() => {
                  // Agrupar ventas por mes y año
                  const salesByMonth = productSales.reduce((acc, sale) => {
                    const key = `${sale.año}-${sale.mes}`
                    if (!acc[key]) {
                      acc[key] = {
                        year: sale.año,
                        month: sale.mes,
                        sales: []
                      }
                    }
                    acc[key].sales.push(sale)
                    return acc
                  }, {} as Record<string, {
                    year: number
                    month: number
                    sales: typeof productSales
                  }>)

                  // Ordenar meses (del primero al último: enero primero, diciembre último)
                  const sortedMonths = Object.values(salesByMonth).sort((a, b) => {
                    if (a.year !== b.year) return a.year - b.year
                    return a.month - b.month
                  })

                  // Calcular resumen anual - agrupar por año
                  const salesByYear = productSales.reduce((acc, sale) => {
                    const key = sale.año.toString()
                    if (!acc[key]) {
                      acc[key] = {
                        year: sale.año,
                        sales: []
                      }
                    }
                    acc[key].sales.push(sale)
                    return acc
                  }, {} as Record<string, {
                    year: number
                    sales: typeof productSales
                  }>)

                  // Ordenar años (del más antiguo al más reciente)
                  const sortedYears = Object.values(salesByYear).sort((a, b) => a.year - b.year)

                  // Combinar meses seleccionados
                  const combinedSales: typeof productSales = []
                  let filteredCombinedSales: typeof productSales = []
                  
                  if (selectedMonths.length > 1) {
                    selectedMonths.forEach(monthKey => {
                      const [year, month] = monthKey.split('-').map(Number)
                      const monthData = sortedMonths.find(m => m.year === year && m.month === month)
                      if (monthData) {
                        combinedSales.push(...monthData.sales)
                      }
                    })
                    
                    // Agrupar por producto y compañía, sumando cantidades
                    const combinedByProduct = combinedSales.reduce((acc, sale) => {
                      const key = `${sale.producto}-${sale.compañia}`
                      if (!acc[key]) {
                        acc[key] = {
                          ...sale,
                          cantidad_ventas: 0,
                          monto_total: 0
                        }
                      }
                      acc[key].cantidad_ventas += sale.cantidad_ventas
                      acc[key].monto_total += sale.monto_total
                      return acc
                    }, {} as Record<string, typeof productSales[0]>)

                    const finalCombinedSales = Object.values(combinedByProduct)
                    
                    // Aplicar filtros a la vista combinada
                    filteredCombinedSales = finalCombinedSales
                    if (combinedFilter.productName && combinedFilter.productName.trim()) {
                      const selectedProductName = combinedFilter.productName.trim()
                      filteredCombinedSales = filteredCombinedSales.filter(sale => {
                        return sale.producto === selectedProductName
                      })
                    }
                    if (combinedFilter.category !== 'all') {
                      filteredCombinedSales = filteredCombinedSales.filter(sale => {
                        const category = productNameToCategoryMap[sale.producto]
                        return category === combinedFilter.category
                      })
                    }
                    if (combinedFilter.type !== 'all') {
                      filteredCombinedSales = filteredCombinedSales.filter(sale => {
                        const type = productNameToTypeMap[sale.producto]
                        return type === combinedFilter.type
                      })
                    }
                  }

                  return (
                    <>
                      {/* Vista combinada de meses seleccionados */}
                      {selectedMonths.length > 1 && (
                        <div className="border border-blue-300 rounded overflow-hidden mb-4 bg-blue-50">
                          <div className="bg-blue-200 px-2 py-1 border-b border-blue-300">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center justify-between w-full">
                                <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
                                  <Package className="w-4 h-4" />
                                  Meses Combinados ({selectedMonths.map(key => {
                                    const [year, month] = key.split('-').map(Number)
                                    return `${monthNames[month - 1]} ${year}`
                                  }).join(', ')})
                                  <span className="ml-2 text-xs font-normal text-gray-600">
                                    (Total: {(() => {
                                      let filtered = Object.values(combinedSales.reduce((acc, sale) => {
                                        const key = `${sale.producto}-${sale.compañia}`
                                        if (!acc[key]) {
                                          acc[key] = { ...sale, cantidad_ventas: 0, monto_total: 0 }
                                        }
                                        acc[key].cantidad_ventas += sale.cantidad_ventas
                                        acc[key].monto_total += sale.monto_total
                                        return acc
                                      }, {} as Record<string, typeof productSales[0]>))
                                      
                                      if (combinedFilter.productName && combinedFilter.productName.trim()) {
                                        const selectedProductName = combinedFilter.productName.trim()
                                        filtered = filtered.filter(sale => sale.producto === selectedProductName)
                                      }
                                      
                                      return filtered.reduce((sum, s) => sum + s.cantidad_ventas, 0).toLocaleString()
                                    })()})
                                  </span>
                                </h3>
                                <div className="flex items-center gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setCombinedPlDialogOpen(true)}
                                    className="text-xs"
                                  >
                                    <Calculator className="w-3 h-3 mr-1" />
                                    P&L
                                  </Button>
                                  <button
                                    onClick={() => setSelectedMonths([])}
                                    className="text-xs px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50"
                                  >
                                    Deseleccionar todos
                                  </button>
    </div>
                              </div>
                            </div>
                          </div>
                          <div className="p-2">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="bg-gray-50 border-b border-gray-200">
                                  <th className="text-left py-1 px-2 font-semibold text-gray-700">
                                    <div className="relative filter-dropdown-container">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          setCombinedFilterOpen(!combinedFilterOpen)
                                        }}
                                        className="flex items-center gap-1 hover:text-blue-600 transition-colors"
                                      >
                                        Producto
                                        <Filter className="w-3 h-3" />
                                        {combinedFilter.productName && (
                                          <span className="ml-1 text-xs bg-blue-500 text-white rounded-full px-1.5 py-0.5">
                                            1
                                          </span>
                                        )}
                                      </button>
                                      
                                      {combinedFilterOpen && (
                                        <>
                                          {/* Overlay para cerrar al hacer click fuera */}
                                          <div 
                                            className="fixed inset-0 z-[99] bg-black/20"
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              setCombinedFilterOpen(false)
                                            }}
                                          />
                                          <div className="fixed bg-white border border-gray-300 rounded-lg shadow-xl z-[100] p-3 min-w-[400px] max-w-[90vw]" style={{
                                            top: '50%',
                                            left: '50%',
                                            transform: 'translate(-50%, -50%)'
                                          }}>
                                            <div className="space-y-2">
                                              <label className="text-xs font-semibold block text-gray-700">Seleccionar producto:</label>
                                              <div className="max-h-[300px] overflow-y-auto border border-gray-300 rounded">
                                              <input
                                                type="text"
                                                value={combinedFilter.productName || ''}
                                                onChange={(e) => {
                                                  setCombinedFilter(prev => ({
                                                    ...prev,
                                                    productName: e.target.value
                                                  }))
                                                }}
                                                  placeholder="Escribe para buscar..."
                                                  className="sticky top-0 w-full text-sm px-3 py-2 border-b border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white z-10"
                                                autoFocus
                                              />
                                                <div className="p-1">
                                                  {(() => {
                                                    const searchTerm = (combinedFilter.productName || '').toLowerCase().trim()
                                                    const allProducts = Array.from(new Set(combinedSales.map(sale => sale.producto)))
                                                      .map(productoName => {
                                                        const sale = combinedSales.find(s => s.producto === productoName)
                                                        return sale ? { name: productoName } : null
                                                      })
                                                      .filter((p): p is { name: string } => p !== null)
                                                      .sort((a, b) => a.name.localeCompare(b.name))
                                                    
                                                    const filteredProducts = searchTerm === '' 
                                                      ? allProducts
                                                      : allProducts.filter(product => 
                                                          product.name.toLowerCase().includes(searchTerm)
                                                        )
                                                    
                                                    if (filteredProducts.length === 0) {
                                                      return (
                                                        <div className="px-3 py-2 text-xs text-gray-500 text-center">
                                                          No se encontraron productos
                                                        </div>
                                                      )
                                                    }
                                                    
                                                    return filteredProducts.map(product => (
                                                      <button
                                                        key={product.name}
                                                        onClick={() => {
                                                          setCombinedFilter(prev => ({
                                                            ...prev,
                                                            productName: product.name
                                                          }))
                                                          setCombinedFilterOpen(false)
                                                        }}
                                                        className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 rounded transition-colors ${
                                                          combinedFilter.productName === product.name ? 'bg-blue-100 font-medium' : ''
                                                        }`}
                                                      >
                                                        <div className="font-medium">{product.name}</div>
                                                      </button>
                                                    ))
                                                  })()}
                                                </div>
                                              </div>
                                              {combinedFilter.productName && (
                                                <button
                                                  onClick={() => {
                                                    setCombinedFilter(prev => ({
                                                      ...prev,
                                                      productName: ''
                                                    }))
                                                  }}
                                                  className="w-full text-xs px-2 py-1 border border-gray-300 rounded hover:bg-gray-50 transition-colors flex items-center justify-center gap-1"
                                                >
                                                  <X className="w-3 h-3" />
                                                  Limpiar
                                                </button>
        )}
      </div>
    </div>
                                        </>
                                      )}
                                    </div>
                                  </th>
                                  <th className="text-left py-1 px-2 font-semibold text-gray-700">
                                    Compañía
                                  </th>
                                  <th className="text-right py-1 px-2 font-semibold text-gray-700">Cantidad</th>
                                  <th className="text-right py-1 px-2 font-semibold text-gray-700">Gross Sale</th>
                                  <th className="text-right py-1 px-2 font-semibold text-gray-700">Gross Profit</th>
                                  <th className="text-right py-1 px-2 font-semibold text-gray-700">Total Amount (Odoo)</th>
                                </tr>
                              </thead>
                              <tbody>
                                {filteredCombinedSales.map((sale, idx) => {
                                  const rowKey = `combined-${sale.producto}-${sale.compañia}-${sale.mes}-${sale.año}-${idx}`
                                  const productId = productNameToIdMap[sale.producto]
                                  const productCategory = productNameToCategoryMap[sale.producto]
                                  const productType = productNameToTypeMap[sale.producto]
                                  const grossSalesKey = `${sale.producto}-${sale.compañia}`
                                  const grossSalesPerUnit = productCompanyToGrossSalesMap[grossSalesKey] || 0
                                  const grossProfitPerUnit = productCompanyToGrossProfitMap[grossSalesKey] || 0
                                  const totalGrossSales = grossSalesPerUnit * sale.cantidad_ventas
                                  const totalGrossProfit = grossProfitPerUnit * sale.cantidad_ventas
                                  const isOutdated = Math.abs(grossSalesPerUnit - 10) < 0.01

                                  return (
                                    <tr key={rowKey} className="border-b border-gray-100 hover:bg-gray-50 last:border-b-0">
                                      <td className="py-1 px-2 text-gray-900">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          {productId ? (
                                            <Link 
                                              href={`/products/${productId}`}
                                              className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer font-medium"
                                              onClick={(e) => e.stopPropagation()}
                                            >
                                              {sale.producto}
                                            </Link>
                                          ) : (
                                            <span className="font-medium">{sale.producto}</span>
                                          )}
                                          <CategoryBadge category={productCategory} productName={sale.producto} size="sm" />
                                          <TypeBadge type={productType} size="sm" />
                                          {isOutdated && (
                                            <div className="relative group">
                                              <AlertCircle className="w-4 h-4 text-red-600" />
                                              <div className="absolute left-0 top-full mt-1 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
                                                Precio desactualizado
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      </td>
                                      <td className="py-1 px-2 text-gray-700">
                                        {sale.compañia}
                                      </td>
                                      <td className="py-1 px-2 text-right">
                                        <span className="font-semibold text-blue-600">
                                          {sale.cantidad_ventas.toLocaleString()}
                                        </span>
                                      </td>
                                      <td className="py-1 px-2 text-right">
                                        <span className="font-semibold text-purple-600">
                                          {formatCurrency(totalGrossSales)}
                                        </span>
                                      </td>
                                      <td className="py-1 px-2 text-right">
                                        <span className="font-semibold text-orange-600">
                                          {formatCurrency(totalGrossProfit)}
                                        </span>
                                      </td>
                                      <td className="py-1 px-2 text-right">
                                        <span className="font-semibold text-green-600">
                                          {formatCurrency(sale.monto_total)}
                                        </span>
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                              <tfoot>
                                {(() => {
                                  const totalQuantity = filteredCombinedSales.reduce((sum, s) => sum + s.cantidad_ventas, 0)
                                  const totalGrossSales = Math.max(0, filteredCombinedSales.reduce((sum, s) => {
                                    const key = `${s.producto}-${s.compañia}`
                                    const grossSalesPerUnit = Math.max(0, productCompanyToGrossSalesMap[key] || 0)
                                    return sum + (grossSalesPerUnit * s.cantidad_ventas)
                                  }, 0))
                                  const totalGrossProfit = Math.max(0, filteredCombinedSales.reduce((sum, s) => {
                                    const key = `${s.producto}-${s.compañia}`
                                    const grossProfitPerUnit = Math.max(0, productCompanyToGrossProfitMap[key] || 0)
                                    return sum + (grossProfitPerUnit * s.cantidad_ventas)
                                  }, 0))
                                  const totalAmount = filteredCombinedSales.reduce((sum, s) => sum + s.monto_total, 0)

                                  return (
                                    <tr className="bg-blue-100 font-semibold border-t-2 border-gray-300">
                                      <td colSpan={2} className="py-1 px-2 text-gray-900">Total Combinado</td>
                                      <td className="py-1 px-2 text-right text-blue-600">
                                        {totalQuantity.toLocaleString()}
                                      </td>
                                      <td className="py-1 px-2 text-right text-purple-600">
                                        {formatCurrency(totalGrossSales)}
                                      </td>
                                      <td className="py-1 px-2 text-right text-orange-600">
                                        {formatCurrency(totalGrossProfit)}
                                      </td>
                                      <td className="py-1 px-2 text-right text-green-600">
                                        {formatCurrency(totalAmount)}
                                      </td>
                                    </tr>
                                  )
                                })()}
                              </tfoot>
                            </table>
                          </div>
                          
                          {/* Dialog P&L Consolidado para meses combinados */}
                          <Dialog open={combinedPlDialogOpen} onOpenChange={setCombinedPlDialogOpen}>
                            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle>P&L Consolidado - Meses Combinados</DialogTitle>
                                <DialogDescription>
                                  Control de gastos consolidado de los productos vendidos en los meses seleccionados
                                  {(() => {
                                    const hasFilters = combinedFilter.productName
                                    if (hasFilters) {
                                      return ' (con filtros aplicados)'
                                    }
                                    return ''
                                  })()}
                                </DialogDescription>
                              </DialogHeader>
                              
                              <div className="mt-4">
                                {(() => {
                                  // Aplicar los mismos filtros que se usan en la vista combinada
                                  let filteredCombinedSalesForPl = Object.values(combinedSales.reduce((acc, sale) => {
                                    const key = `${sale.producto}-${sale.compañia}`
                                    if (!acc[key]) {
                                      acc[key] = { ...sale, cantidad_ventas: 0, monto_total: 0 }
                                    }
                                    acc[key].cantidad_ventas += sale.cantidad_ventas
                                    acc[key].monto_total += sale.monto_total
                                    return acc
                                  }, {} as Record<string, typeof productSales[0]>))
                                  
                                  if (combinedFilter.productName && combinedFilter.productName.trim()) {
                                    const selectedProductName = combinedFilter.productName.trim()
                                    filteredCombinedSalesForPl = filteredCombinedSalesForPl.filter(sale => {
                                      return sale.producto === selectedProductName
                                    })
                                  }
                                  
                                  const totalAmount = filteredCombinedSalesForPl.reduce((sum, s) => sum + s.monto_total, 0)
                                  const totalQuantity = filteredCombinedSalesForPl.reduce((sum, s) => sum + s.cantidad_ventas, 0)
                                  
                                  return (
                                    <div className="overflow-x-auto">
                                      <table className="w-full">
                                        <thead>
                                          <tr className="bg-gray-50 border-b border-gray-200">
                                            <th className="px-4 py-3 text-left text-sm font-semibold">Producto</th>
                                            <th className="px-4 py-3 text-left text-sm font-semibold">Compañía</th>
                                            <th className="px-4 py-3 text-right text-sm font-semibold">Cantidad</th>
                                            <th className="px-4 py-3 text-right text-sm font-semibold">Gross Sale</th>
                                            <th className="px-4 py-3 text-right text-sm font-semibold">Gross Profit</th>
                                            <th className="px-4 py-3 text-right text-sm font-semibold">Monto Total (Odoo)</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {filteredCombinedSalesForPl.map((sale, idx) => {
                                            const productId = productNameToIdMap[sale.producto]
                                            const productCategory = productNameToCategoryMap[sale.producto]
                                            const productType = productNameToTypeMap[sale.producto]
                                            const grossSalesKey = `${sale.producto}-${sale.compañia}`
                                            const grossSalesPerUnit = Math.max(0, productCompanyToGrossSalesMap[grossSalesKey] || 0)
                                            const grossProfitPerUnit = Math.max(0, productCompanyToGrossProfitMap[grossSalesKey] || 0)
                                            const totalGrossSales = Math.max(0, grossSalesPerUnit * sale.cantidad_ventas)
                                            const totalGrossProfit = Math.max(0, grossProfitPerUnit * sale.cantidad_ventas)
                                            const country = productCompanyCountryMap[grossSalesKey]
                                            // La alerta solo se muestra si grossSales es exactamente 10 USD
                                            const isOutdated = Math.abs(grossSalesPerUnit - 10) < 0.01
                                            return (
                                              <tr key={idx} className="border-b border-gray-100">
                                                <td className="px-4 py-3 text-left">
                                                  <div className="flex items-center gap-2 flex-wrap">
                                                    {productId ? (
                                                      <Link 
                                                        href={`/products/${productId}`}
                                                        className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                                                        onClick={(e) => e.stopPropagation()}
                                                      >
                                                        {sale.producto}
                                                      </Link>
                                                    ) : (
                                                      sale.producto
                                                    )}
                                                    <CategoryBadge category={productCategory} productName={sale.producto} size="sm" />
                                                    <TypeBadge type={productType} size="sm" />
                                                    {isOutdated && (
                                                      <div className="relative group">
                                                        <AlertCircle className="w-4 h-4 text-red-600" />
                                                        <div className="absolute left-0 top-full mt-1 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
                                                          Precio desactualizado
                                                        </div>
                                                      </div>
                                                    )}
                                                  </div>
                                                </td>
                                                <td className="px-4 py-3 text-left">{sale.compañia}</td>
                                                <td className="px-4 py-3 text-right">{sale.cantidad_ventas.toLocaleString()}</td>
                                                <td className="px-4 py-3 text-right font-mono text-purple-600">{formatCurrency(totalGrossSales)}</td>
                                                <td className="px-4 py-3 text-right font-mono text-orange-600">{formatCurrency(totalGrossProfit)}</td>
                                                <td className="px-4 py-3 text-right font-mono">{formatCurrency(sale.monto_total)}</td>
                                              </tr>
                                            )
                                          })}
                                          <tr className="border-t-2 border-gray-300 bg-gray-100 font-semibold">
                                            <td colSpan={2} className="px-4 py-3 text-left">Total</td>
                                            <td className="px-4 py-3 text-right">{totalQuantity.toLocaleString()}</td>
                                            <td className="px-4 py-3 text-right font-mono text-purple-600">
                                              {formatCurrency(Math.max(0, filteredCombinedSalesForPl.reduce((sum, s) => {
                                                const key = `${s.producto}-${s.compañia}`
                                                const grossSalesPerUnit = Math.max(0, productCompanyToGrossSalesMap[key] || 0)
                                                return sum + (grossSalesPerUnit * s.cantidad_ventas)
                                              }, 0)))}
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono text-orange-600">
                                              {formatCurrency(Math.max(0, filteredCombinedSalesForPl.reduce((sum, s) => {
                                                const key = `${s.producto}-${s.compañia}`
                                                const grossProfitPerUnit = Math.max(0, productCompanyToGrossProfitMap[key] || 0)
                                                return sum + (grossProfitPerUnit * s.cantidad_ventas)
                                              }, 0)))}
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono">{formatCurrency(totalAmount)}</td>
                                          </tr>
                                        </tbody>
                                      </table>
                                    </div>
                                  )
                                })()}
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                      )}
                      
                      {sortedMonths.map((monthData) => {
                        const monthKey = `${monthData.year}-${monthData.month}`
                        const monthFilter = monthFilters[monthKey] || { productName: '', category: 'all', type: 'all' }
                        
                        // Calcular total filtrado
                        let filteredMonthSales = monthData.sales
                        
                        // Filtro por nombre de producto
                        if (monthFilter.productName && monthFilter.productName.trim()) {
                          const selectedProductName = monthFilter.productName.trim()
                          filteredMonthSales = filteredMonthSales.filter(sale => {
                            return sale.producto === selectedProductName
                          })
                        }
                        // Filtro por categoría
                        if (monthFilter.category && monthFilter.category !== 'all') {
                          filteredMonthSales = filteredMonthSales.filter(sale => {
                            const category = productNameToCategoryMap[sale.producto]
                            return category === monthFilter.category
                          })
                        }
                        // Filtro por tipo
                        if (monthFilter.type && monthFilter.type !== 'all') {
                          filteredMonthSales = filteredMonthSales.filter(sale => {
                            const type = productNameToTypeMap[sale.producto]
                            return type === monthFilter.type
                          })
                        }
                        const monthTotal = filteredMonthSales.reduce((sum, s) => sum + s.cantidad_ventas, 0)
                        const isOpen = openMonths[monthKey] || false
                        
                        
                        const isSelected = selectedMonths.includes(monthKey)
                        
                        return (
                          <div key={monthKey} className="border border-gray-200 rounded overflow-hidden">
                            <div 
                              className={`px-2 py-1 border-b border-gray-200 cursor-pointer transition-colors ${
                                isSelected ? 'bg-blue-100 hover:bg-blue-200' : 'bg-gray-100 hover:bg-gray-200'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 flex-1">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={(e) => {
                                      e.stopPropagation()
                                      setSelectedMonths(prev => {
                                        if (e.target.checked) {
                                          return prev.includes(monthKey) ? prev : [...prev, monthKey]
                                        } else {
                                          return prev.filter(m => m !== monthKey)
                                        }
                                      })
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    className="rounded cursor-pointer"
                                  />
                                  <h3 
                                    className="font-semibold text-gray-900 text-sm flex items-center gap-2 flex-1"
                                    onClick={() => setOpenMonths(prev => ({ ...prev, [monthKey]: !prev[monthKey] }))}
                                  >
                                    {isOpen ? (
                                      <ChevronDown className="w-4 h-4" />
                                    ) : (
                                      <ChevronRight className="w-4 h-4" />
                                    )}
                                  {monthNames[monthData.month - 1]} {monthData.year}
                                  <span className="ml-2 text-xs font-normal text-gray-600">
                                    (Total: {monthTotal.toLocaleString()})
                                  </span>
                                </h3>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setPlDialogOpen(prev => ({ ...prev, [monthKey]: !prev[monthKey] }))
                                  }}
                                  className="text-xs"
                                >
                                  <Calculator className="w-3 h-3 mr-1" />
                                  P&L
                                </Button>
                              </div>
                            </div>
                            </div>
                            {isOpen && (
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="bg-gray-50 border-b border-gray-200">
                                  <th className="text-left py-1 px-2 font-semibold text-gray-700">
                                    <div className="relative filter-dropdown-container">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          setProductFilterOpen(prev => ({ ...prev, [monthKey]: !prev[monthKey] }))
                                        }}
                                        className="flex items-center gap-1 hover:text-blue-600 transition-colors"
                                      >
                                        Producto
                                        <Filter className="w-3 h-3" />
                                        {monthFilters[monthKey]?.productName && (
                                          <span className="ml-1 text-xs bg-blue-500 text-white rounded-full px-1.5 py-0.5">
                                            1
                                          </span>
                                        )}
                                      </button>
                                      
                                      {productFilterOpen[monthKey] && (
                                        <>
                                          {/* Overlay para cerrar al hacer click fuera */}
                                          <div 
                                            className="fixed inset-0 z-[99] bg-black/20"
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              setProductFilterOpen(prev => ({ ...prev, [monthKey]: false }))
                                            }}
                                          />
                                          <div className="fixed bg-white border border-gray-300 rounded-lg shadow-xl z-[100] p-3 min-w-[400px] max-w-[90vw]" style={{
                                            top: '50%',
                                            left: '50%',
                                            transform: 'translate(-50%, -50%)'
                                          }}>
                                          <div className="space-y-2">
                                              <label className="text-xs font-semibold block text-gray-700">Seleccionar producto:</label>
                                              <div className="max-h-[300px] overflow-y-auto border border-gray-300 rounded">
                                            <input
                                              type="text"
                                              value={monthFilters[monthKey]?.productName || ''}
                                              onChange={(e) => {
                                                const currentFilter = monthFilters[monthKey] || { productName: '' }
                                                setMonthFilters(prev => ({
                                                  ...prev,
                                                  [monthKey]: {
                                                    ...currentFilter,
                                                    productName: e.target.value
                                                  }
                                                }))
                                              }}
                                                  placeholder="Escribe para buscar..."
                                                  className="sticky top-0 w-full text-sm px-3 py-2 border-b border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white z-10"
                                              autoFocus
                                            />
                                                <div className="p-1">
                                                  {(() => {
                                                    const searchTerm = (monthFilters[monthKey]?.productName || '').toLowerCase().trim()
                                                    const monthSales = monthData.sales
                                                    const allProducts = Array.from(new Set(monthSales.map(sale => sale.producto)))
                                                      .map(productoName => {
                                                        const sale = monthSales.find(s => s.producto === productoName)
                                                        return sale ? { name: productoName } : null
                                                      })
                                                      .filter((p): p is { name: string } => p !== null)
                                                      .sort((a, b) => a.name.localeCompare(b.name))
                                                    
                                                    const filteredProducts = searchTerm === '' 
                                                      ? allProducts
                                                      : allProducts.filter(product => 
                                                          product.name.toLowerCase().includes(searchTerm)
                                                        )
                                                    
                                                    if (filteredProducts.length === 0) {
                                                      return (
                                                        <div className="px-3 py-2 text-xs text-gray-500 text-center">
                                                          No se encontraron productos
                                                        </div>
                                                      )
                                                    }
                                                    
                                                    return filteredProducts.map(product => (
                                                      <button
                                                        key={product.name}
                                                        onClick={() => {
                                                          const currentFilter = monthFilters[monthKey] || { productName: '' }
                                                          setMonthFilters(prev => ({
                                                            ...prev,
                                                            [monthKey]: {
                                                              ...currentFilter,
                                                              productName: product.name
                                                            }
                                                          }))
                                                          setProductFilterOpen(prev => ({ ...prev, [monthKey]: false }))
                                                        }}
                                                        className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 rounded transition-colors ${
                                                          monthFilters[monthKey]?.productName === product.name ? 'bg-blue-100 font-medium' : ''
                                                        }`}
                                                      >
                                                        <div className="font-medium">{product.name}</div>
                                                      </button>
                                                    ))
                                                  })()}
                                                </div>
                                              </div>
                                            {monthFilters[monthKey]?.productName && (
                                              <button
                                                onClick={() => {
                                                  const currentFilter = monthFilters[monthKey] || { productName: '' }
                                                  setMonthFilters(prev => ({
                                                    ...prev,
                                                    [monthKey]: {
                                                      ...currentFilter,
                                                      productName: ''
                                                    }
                                                  }))
                                                }}
                                                className="w-full text-xs px-2 py-1 border border-gray-300 rounded hover:bg-gray-50 transition-colors flex items-center justify-center gap-1"
                                              >
                                                <X className="w-3 h-3" />
                                                Limpiar
                                              </button>
                                            )}
                                          </div>
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  </th>
                                  <th className="text-left py-1 px-2 font-semibold text-gray-700">
                                    Compañía
                                  </th>
                                  <th className="text-right py-1 px-2 font-semibold text-gray-700">Cantidad</th>
                                  <th className="text-right py-1 px-2 font-semibold text-gray-700">Gross Sale</th>
                                  <th className="text-right py-1 px-2 font-semibold text-gray-700">Gross Profit</th>
                                  <th className="text-right py-1 px-2 font-semibold text-gray-700">Total Amount (Odoo)</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(() => {
                                  // Filtrar ventas del mes según el nombre de producto, categoría y tipo
                                  const monthFilter = monthFilters[monthKey] || { productName: '', category: 'all', type: 'all' }
                                  let filteredMonthSales = monthData.sales
                                  
                                  // Filtro por nombre de producto
                                  if (monthFilter.productName && monthFilter.productName.trim()) {
                                    const selectedProductName = monthFilter.productName.trim()
                                    filteredMonthSales = filteredMonthSales.filter(sale => {
                                      return sale.producto === selectedProductName
                                    })
                                  }
                                  // Filtro por categoría
                                  if (monthFilter.category && monthFilter.category !== 'all') {
                                    filteredMonthSales = filteredMonthSales.filter(sale => {
                                      const category = productNameToCategoryMap[sale.producto]
                                      return category === monthFilter.category
                                    })
                                  }
                                  // Filtro por tipo
                                  if (monthFilter.type && monthFilter.type !== 'all') {
                                    filteredMonthSales = filteredMonthSales.filter(sale => {
                                      const type = productNameToTypeMap[sale.producto]
                                      return type === monthFilter.type
                                    })
                                  }
                                  
                                  return filteredMonthSales.map((sale, idx): JSX.Element => {
                                    const rowKey = `${monthKey}-${sale.producto}-${sale.compañia}-${sale.mes}-${sale.año}-${idx}`
                                    const productId = productNameToIdMap[sale.producto]
                                    const productCategory = productNameToCategoryMap[sale.producto]
                                    const productType = productNameToTypeMap[sale.producto]
                                    const grossSalesKey = `${sale.producto}-${sale.compañia}`
                                    const grossSalesPerUnit = Math.max(0, productCompanyToGrossSalesMap[grossSalesKey] || 0)
                                    const grossProfitPerUnit = Math.max(0, productCompanyToGrossProfitMap[grossSalesKey] || 0)
                                    const totalGrossSales = Math.max(0, grossSalesPerUnit * sale.cantidad_ventas)
                                    const totalGrossProfit = Math.max(0, grossProfitPerUnit * sale.cantidad_ventas)
                                    const country = productCompanyCountryMap[grossSalesKey]
                                    // La alerta solo se muestra si grossSales es exactamente 10 USD
                                    const isOutdated = Math.abs(grossSalesPerUnit - 10) < 0.01

                                    return (
                                      <tr key={rowKey} className="border-b border-gray-100 hover:bg-gray-50 last:border-b-0">
                                        <td className="py-1 px-2 text-gray-900">
                                          <div className="flex items-center gap-2 flex-wrap">
                                            {productId ? (
                                              <Link 
                                                href={`/products/${productId}`}
                                                className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer font-medium"
                                                onClick={(e) => e.stopPropagation()}
                                              >
                                                {sale.producto}
                                              </Link>
                                            ) : (
                                              <span className="font-medium">{sale.producto}</span>
                                            )}
                                            <CategoryBadge category={productCategory} productName={sale.producto} size="sm" />
                                            <TypeBadge type={productType} size="sm" />
                                            {isOutdated && (
                                              <div className="relative group">
                                                <AlertCircle className="w-4 h-4 text-red-600" />
                                                <div className="absolute left-0 top-full mt-1 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
                                                  Precio desactualizado
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        </td>
                                        <td className="py-1 px-2 text-gray-700">
                                          {sale.compañia}
                                        </td>
                                        <td className="py-1 px-2 text-right">
                                          <span className="font-semibold text-blue-600">
                                            {sale.cantidad_ventas.toLocaleString()}
                                          </span>
                                        </td>
                                        <td className="py-1 px-2 text-right">
                                          <span className="font-semibold text-purple-600">
                                            {formatCurrency(totalGrossSales)}
                                          </span>
                                        </td>
                                        <td className="py-1 px-2 text-right">
                                          <span className="font-semibold text-orange-600">
                                            {formatCurrency(totalGrossProfit)}
                                          </span>
                                        </td>
                                        <td className="py-1 px-2 text-right">
                                          <span className="font-semibold text-green-600">
                                            {formatCurrency(sale.monto_total)}
                                          </span>
                                        </td>
                                      </tr>
                                    )
                                  })
                              })()}
                              </tbody>
                              <tfoot>
                                    {(() => {
                                      const monthFilter = monthFilters[monthKey] || { productName: '', category: 'all', type: 'all' }
                                      let filteredMonthSales = monthData.sales
                                      
                                      // Filtro por nombre de producto
                                      if (monthFilter.productName && monthFilter.productName.trim()) {
                                        const selectedProductName = monthFilter.productName.trim()
                                        filteredMonthSales = filteredMonthSales.filter(sale => {
                                          return sale.producto === selectedProductName
                                        })
                                      }
                                      // Filtro por categoría
                                      if (monthFilter.category && monthFilter.category !== 'all') {
                                        filteredMonthSales = filteredMonthSales.filter(sale => {
                                          const category = productNameToCategoryMap[sale.producto]
                                          return category === monthFilter.category
                                        })
                                      }
                                      // Filtro por tipo
                                      if (monthFilter.type && monthFilter.type !== 'all') {
                                        filteredMonthSales = filteredMonthSales.filter(sale => {
                                          const type = productNameToTypeMap[sale.producto]
                                          return type === monthFilter.type
                                        })
                                      }
                                      
                                      const totalQuantity = filteredMonthSales.reduce((sum, s) => sum + s.cantidad_ventas, 0)
                                      const totalGrossSales = Math.max(0, filteredMonthSales.reduce((sum, s) => {
                                        const key = `${s.producto}-${s.compañia}`
                                        const grossSalesPerUnit = Math.max(0, productCompanyToGrossSalesMap[key] || 0)
                                        return sum + (grossSalesPerUnit * s.cantidad_ventas)
                                      }, 0))
                                      const totalGrossProfit = Math.max(0, filteredMonthSales.reduce((sum, s) => {
                                        const key = `${s.producto}-${s.compañia}`
                                        const grossProfitPerUnit = Math.max(0, productCompanyToGrossProfitMap[key] || 0)
                                        return sum + (grossProfitPerUnit * s.cantidad_ventas)
                                      }, 0))
                                      const totalAmount = filteredMonthSales.reduce((sum, s) => sum + s.monto_total, 0)

                                      return (
                                        <tr className="bg-gray-100 font-semibold border-t-2 border-gray-300">
                                          <td colSpan={2} className="py-1 px-2 text-gray-900">Total</td>
                                          <td className="py-1 px-2 text-right text-blue-600">
                                            {totalQuantity.toLocaleString()}
                                          </td>
                                          <td className="py-1 px-2 text-right text-purple-600">
                                            {formatCurrency(totalGrossSales)}
                                          </td>
                                          <td className="py-1 px-2 text-right text-orange-600">
                                            {formatCurrency(totalGrossProfit)}
                                          </td>
                                          <td className="py-1 px-2 text-right text-green-600">
                                            {formatCurrency(totalAmount)}
                                          </td>
                                        </tr>
                                      )
                                    })()}
                              </tfoot>
                            </table>
                            )}
                            
                            {/* Dialog P&L Consolidado */}
                            <Dialog open={plDialogOpen[monthKey] || false} onOpenChange={(open) => setPlDialogOpen(prev => ({ ...prev, [monthKey]: open }))}>
                              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                                <DialogHeader>
                                  <DialogTitle>P&L Consolidado - {monthNames[monthData.month - 1]} {monthData.year}</DialogTitle>
                                  <DialogDescription>
                                    Control de gastos consolidado de los productos vendidos en este mes
                                    {(() => {
                                    const monthFilter = monthFilters[monthKey] || { productName: '' }
                                    const hasFilters = monthFilter.productName
                                      if (hasFilters) {
                                        return ' (con filtros aplicados)'
                                      }
                                      return ''
                                    })()}
                                  </DialogDescription>
                                </DialogHeader>
                                
                                <div className="mt-4">
                                  {(() => {
                                    // Aplicar los mismos filtros que se usan en la tabla
                                    const monthFilter = monthFilters[monthKey] || { productName: '' }
                                    let filteredMonthSales = monthData.sales
                                    
                                    // Filtro por nombre de producto
                                    if (monthFilter.productName && monthFilter.productName.trim()) {
                                      const selectedProductName = monthFilter.productName.trim()
                                      filteredMonthSales = filteredMonthSales.filter(sale => {
                                        return sale.producto === selectedProductName
                                      })
                                    }
                                    
                                    const totalAmount = filteredMonthSales.reduce((sum, s) => sum + s.monto_total, 0)
                                    const totalQuantity = filteredMonthSales.reduce((sum, s) => sum + s.cantidad_ventas, 0)
                                    
                                    return (
                                      <div className="overflow-x-auto">
                                        <table className="w-full">
                                          <thead>
                                            <tr className="bg-gray-50 border-b border-gray-200">
                                              <th className="px-4 py-3 text-left text-sm font-semibold">Producto</th>
                                              <th className="px-4 py-3 text-left text-sm font-semibold">Compañía</th>
                                              <th className="px-4 py-3 text-right text-sm font-semibold">Cantidad</th>
                                              <th className="px-4 py-3 text-right text-sm font-semibold">Gross Sale</th>
                                              <th className="px-4 py-3 text-right text-sm font-semibold">Gross Profit</th>
                                              <th className="px-4 py-3 text-right text-sm font-semibold">Monto Total (Odoo)</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {filteredMonthSales.map((sale, idx) => {
                                              const productId = productNameToIdMap[sale.producto]
                                              const productCategory = productNameToCategoryMap[sale.producto]
                                              const productType = productNameToTypeMap[sale.producto]
                                              const grossSalesKey = `${sale.producto}-${sale.compañia}`
                                              const grossSalesPerUnit = Math.max(0, productCompanyToGrossSalesMap[grossSalesKey] || 0)
                                              const grossProfitPerUnit = Math.max(0, productCompanyToGrossProfitMap[grossSalesKey] || 0)
                                              const totalGrossSales = Math.max(0, grossSalesPerUnit * sale.cantidad_ventas)
                                              const totalGrossProfit = Math.max(0, grossProfitPerUnit * sale.cantidad_ventas)
                                              const country = productCompanyCountryMap[grossSalesKey]
                                              // La alerta solo se muestra si grossSales es exactamente 10 USD
                                              const isOutdated = Math.abs(grossSalesPerUnit - 10) < 0.01
                                              return (
                                                <tr key={idx} className="border-b border-gray-100">
                                                  <td className="px-4 py-3 text-left">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                      {productId ? (
                                                        <Link 
                                                          href={`/products/${productId}`}
                                                          className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                                                          onClick={(e) => e.stopPropagation()}
                                                        >
                                                          {sale.producto}
                                                        </Link>
                                                      ) : (
                                                        sale.producto
                                                      )}
                                                      <CategoryBadge category={productCategory} productName={sale.producto} size="sm" />
                                                      <TypeBadge type={productType} size="sm" />
                                                      {isOutdated && (
                                                        <div className="relative group">
                                                          <AlertCircle className="w-4 h-4 text-red-600" />
                                                          <div className="absolute left-0 top-full mt-1 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
                                                            Precio desactualizado
                                                          </div>
                                                        </div>
                                                      )}
                                                    </div>
                                                  </td>
                                                  <td className="px-4 py-3 text-left">{sale.compañia}</td>
                                                  <td className="px-4 py-3 text-right">{sale.cantidad_ventas.toLocaleString()}</td>
                                                  <td className="px-4 py-3 text-right font-mono text-purple-600">{formatCurrency(totalGrossSales)}</td>
                                                  <td className="px-4 py-3 text-right font-mono text-orange-600">{formatCurrency(totalGrossProfit)}</td>
                                                  <td className="px-4 py-3 text-right font-mono">{formatCurrency(sale.monto_total)}</td>
                                                </tr>
                                              )
                                            })}
                                            <tr className="border-t-2 border-gray-300 bg-gray-100 font-semibold">
                                              <td colSpan={2} className="px-4 py-3 text-left">Total</td>
                                              <td className="px-4 py-3 text-right">{totalQuantity.toLocaleString()}</td>
                                              <td className="px-4 py-3 text-right font-mono text-purple-600">
                                                {formatCurrency(Math.max(0, filteredMonthSales.reduce((sum, s) => {
                                                  const key = `${s.producto}-${s.compañia}`
                                                  const grossSalesPerUnit = Math.max(0, productCompanyToGrossSalesMap[key] || 0)
                                                  return sum + (grossSalesPerUnit * s.cantidad_ventas)
                                                }, 0)))}
                                              </td>
                                              <td className="px-4 py-3 text-right font-mono text-orange-600">
                                                {formatCurrency(Math.max(0, filteredMonthSales.reduce((sum, s) => {
                                                  const key = `${s.producto}-${s.compañia}`
                                                  const grossProfitPerUnit = Math.max(0, productCompanyToGrossProfitMap[key] || 0)
                                                  return sum + (grossProfitPerUnit * s.cantidad_ventas)
                                                }, 0)))}
                                              </td>
                                              <td className="px-4 py-3 text-right font-mono">{formatCurrency(totalAmount)}</td>
                                            </tr>
                                          </tbody>
                                        </table>
                                      </div>
                                    )
                                  })()}
                                </div>
                              </DialogContent>
                            </Dialog>
                          </div>
                        )
                      })}
                      
                      {/* Resumen Anual - uno por cada año en los datos */}
                      {sortedYears.map((yearData) => {
                        const yearKey = `annual-${yearData.year}`
                        const isYearOpen = openMonths[yearKey] || false
                        // Agrupar por producto para el resumen anual de este año
                        const annualByProduct = yearData.sales.reduce((acc, sale) => {
                          const key = `${sale.producto}-${sale.compañia}`
                          if (!acc[key]) {
                            acc[key] = {
                              ...sale,
                              cantidad_ventas: 0,
                              monto_total: 0
                            }
                          }
                          acc[key].cantidad_ventas += sale.cantidad_ventas
                          acc[key].monto_total += sale.monto_total
                          return acc
                        }, {} as Record<string, typeof productSales[0]>)

                        const annualProducts = Object.values(annualByProduct).sort((a, b) => 
                          a.producto.localeCompare(b.producto)
                        )

                        if (annualProducts.length === 0) return null

                        return (
                          <div key={`annual-${yearData.year}`} className="border border-gray-200 rounded overflow-hidden border-blue-300">
                            <div 
                              className="bg-blue-100 px-2 py-1 border-b border-gray-200 cursor-pointer hover:bg-blue-200 transition-colors"
                              onClick={() => setOpenMonths(prev => ({ ...prev, [yearKey]: !prev[yearKey] }))}
                            >
                              <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
                                {isYearOpen ? (
                                  <ChevronDown className="w-4 h-4" />
                                ) : (
                                  <ChevronRight className="w-4 h-4" />
                                )}
                                Anual {yearData.year}
                                <span className="ml-2 text-xs font-normal text-gray-600">
                                  (Total: {annualProducts.reduce((sum, p) => sum + p.cantidad_ventas, 0).toLocaleString()})
                                </span>
                              </h3>
                            </div>
                            {isYearOpen && (
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="bg-gray-50 border-b border-gray-200">
                                  <th className="text-left py-1 px-2 font-semibold text-gray-700">Producto</th>
                                  <th className="text-left py-1 px-2 font-semibold text-gray-700">Compañía</th>
                                  <th className="text-right py-1 px-2 font-semibold text-gray-700">Cantidad</th>
                                  <th className="text-right py-1 px-2 font-semibold text-gray-700">Gross Sale</th>
                                  <th className="text-right py-1 px-2 font-semibold text-gray-700">Gross Profit</th>
                                  <th className="text-right py-1 px-2 font-semibold text-gray-700">Monto Total (Odoo)</th>
                                </tr>
                              </thead>
                              <tbody>
                                {annualProducts.map((sale, idx) => {
                                  const rowKey = `annual-${yearData.year}-${sale.producto}-${sale.compañia}-${sale.mes}-${sale.año}-${idx}`
                                  const productId = productNameToIdMap[sale.producto]
                                  const productCategory = productNameToCategoryMap[sale.producto]
                                  const productType = productNameToTypeMap[sale.producto]
                                  const grossSalesKey = `${sale.producto}-${sale.compañia}`
                                  const grossSalesPerUnit = productCompanyToGrossSalesMap[grossSalesKey] || 0
                                  const grossProfitPerUnit = productCompanyToGrossProfitMap[grossSalesKey] || 0
                                  const totalGrossSales = grossSalesPerUnit * sale.cantidad_ventas
                                  const totalGrossProfit = grossProfitPerUnit * sale.cantidad_ventas
                                  const isOutdated = Math.abs(grossSalesPerUnit - 10) < 0.01

                                  return (
                                    <tr key={rowKey} className="border-b border-gray-100 hover:bg-gray-50 last:border-b-0">
                                      <td className="py-1 px-2 text-gray-900">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          {productId ? (
                                            <Link 
                                              href={`/products/${productId}`}
                                              className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer font-medium"
                                              onClick={(e) => e.stopPropagation()}
                                            >
                                              {sale.producto}
                                            </Link>
                                          ) : (
                                            <span className="font-medium">{sale.producto}</span>
                                          )}
                                          <CategoryBadge category={productCategory} productName={sale.producto} size="sm" />
                                          <TypeBadge type={productType} size="sm" />
                                          {isOutdated && (
                                            <div className="relative group">
                                              <AlertCircle className="w-4 h-4 text-red-600" />
                                              <div className="absolute left-0 top-full mt-1 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
                                                Precio desactualizado
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      </td>
                                      <td className="py-1 px-2 text-gray-700">
                                        {sale.compañia}
                                      </td>
                                      <td className="py-1 px-2 text-right">
                                        <span className="font-semibold text-blue-600">
                                          {sale.cantidad_ventas.toLocaleString()}
                                        </span>
                                      </td>
                                      <td className="py-1 px-2 text-right">
                                        <span className="font-semibold text-purple-600">
                                          {formatCurrency(totalGrossSales)}
                                        </span>
                                      </td>
                                      <td className="py-1 px-2 text-right">
                                        <span className="font-semibold text-orange-600">
                                          {formatCurrency(totalGrossProfit)}
                                        </span>
                                      </td>
                                      <td className="py-1 px-2 text-right">
                                        <span className="font-semibold text-green-600">
                                          {formatCurrency(sale.monto_total)}
                                        </span>
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                              <tfoot>
                                {(() => {
                                  const totalQuantity = annualProducts.reduce((sum, p) => sum + p.cantidad_ventas, 0)
                                  const totalGrossSales = Math.max(0, annualProducts.reduce((sum, s) => {
                                    const key = `${s.producto}-${s.compañia}`
                                    const grossSalesPerUnit = Math.max(0, productCompanyToGrossSalesMap[key] || 0)
                                    return sum + (grossSalesPerUnit * s.cantidad_ventas)
                                  }, 0))
                                  const totalGrossProfit = Math.max(0, annualProducts.reduce((sum, s) => {
                                    const key = `${s.producto}-${s.compañia}`
                                    const grossProfitPerUnit = Math.max(0, productCompanyToGrossProfitMap[key] || 0)
                                    return sum + (grossProfitPerUnit * s.cantidad_ventas)
                                  }, 0))
                                  const totalAmount = annualProducts.reduce((sum, s) => sum + s.monto_total, 0)

                                  return (
                                    <tr className="bg-blue-100 font-semibold border-t-2 border-gray-300">
                                      <td colSpan={2} className="py-1 px-2 text-gray-900">Total Anual {yearData.year}</td>
                                      <td className="py-1 px-2 text-right text-blue-600">
                                        {totalQuantity.toLocaleString()}
                                      </td>
                                      <td className="py-1 px-2 text-right text-purple-600">
                                        {formatCurrency(totalGrossSales)}
                                      </td>
                                      <td className="py-1 px-2 text-right text-orange-600">
                                        {formatCurrency(totalGrossProfit)}
                                      </td>
                                      <td className="py-1 px-2 text-right text-green-600">
                                        {formatCurrency(totalAmount)}
                                      </td>
                                    </tr>
                                  )
                                })()}
                              </tfoot>
                            </table>
                            )}
                          </div>
                        )
                      })}
                    </>
                  )
                })()}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No hay productos vendidos disponibles</p>
                <p className="text-sm mt-1">Los datos se cargan automáticamente desde la base de datos</p>
              </div>
            )}
          </CardContent>
        </Card>
          </TabsContent>

          <TabsContent value="dashboard" className="space-y-6">
            {/* Dashboard con calendario y ventas del día seleccionado */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Calendario */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Calendar className="w-6 h-6 text-blue-600" />
                        Calendario de Ventas
                      </CardTitle>
                      <CardDescription>
                        {isMultiSelectMode 
                          ? 'Modo selección múltiple activo - Haz clic en varias fechas'
                          : 'Haz clic en una fecha para ver las ventas del día'
                        }
                      </CardDescription>
                    </div>
                    <Button
                      variant={isMultiSelectMode ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setIsMultiSelectMode(!isMultiSelectMode)
                        if (!isMultiSelectMode) {
                          setSelectedDates([])
                          setSelectedDate(null)
                        } else {
                          setSelectedDate(null)
                        }
                      }}
                      className={isMultiSelectMode ? "bg-blue-600 text-white" : ""}
                    >
                      {isMultiSelectMode ? "Cancelar" : "Seleccionar"}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Navegación del mes */}
                    <div className="flex items-center justify-between">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={goToPreviousMonth}
                        className="flex items-center gap-2"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        Anterior
                      </Button>
                      <h3 className="text-lg font-semibold">
                        {monthNames[currentMonth]} {currentYear}
                      </h3>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={goToNextMonth}
                        className="flex items-center gap-2"
                      >
                        Siguiente
                        <ChevronRight className="w-4 h-4" />
                      </Button>
      </div>

                    {/* Calendario */}
                    <div className="grid grid-cols-7 gap-1">
                      {/* Días de la semana */}
                      {dayNames.map(day => (
                        <div
                          key={day}
                          className="text-center text-xs font-semibold text-gray-600 py-2"
                        >
                          {day}
    </div>
                      ))}

                      {/* Días vacíos al inicio */}
                      {Array.from({ length: getFirstDayOfMonth(currentMonth, currentYear) }).map((_, idx) => (
                        <div key={`empty-${idx}`} className="aspect-square" />
                      ))}

                      {/* Días del mes */}
                      {Array.from({ length: getDaysInMonth(currentMonth, currentYear) }).map((_, idx) => {
                        const day = idx + 1
                        const totalSales = getTotalSalesForDay(day)
                        const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                        const hasSales = totalSales > 0
                        const isToday = new Date().getDate() === day &&
                          new Date().getMonth() === currentMonth &&
                          new Date().getFullYear() === currentYear
                        const dateForDay = new Date(currentYear, currentMonth, day)
                        const dateStrForDay = dateForDay.toISOString().split('T')[0]
                        
                        const isSelected = isMultiSelectMode
                          ? selectedDates.some(d => d.toISOString().split('T')[0] === dateStrForDay)
                          : selectedDate &&
                            selectedDate.getDate() === day &&
                            selectedDate.getMonth() === currentMonth &&
                            selectedDate.getFullYear() === currentYear

                        return (
                          <button
                            key={day}
                            onClick={() => handleDateClick(day)}
                            className={`
                              aspect-square rounded-lg transition-all duration-200
                              flex flex-col items-center justify-center p-1
                              ${isSelected
                                ? isMultiSelectMode
                                  ? 'bg-purple-600 text-white shadow-lg scale-105 border-2 border-purple-400'
                                  : 'bg-blue-600 text-white shadow-lg scale-105'
                                : isToday
                                ? 'bg-blue-100 text-blue-700 border-2 border-blue-400'
                                : hasSales
                                ? 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'
                                : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'
                              }
                            `}
                          >
                            <span className="text-sm font-medium">{day}</span>
                            {hasSales && (
                              <span className="text-xs font-semibold">
                                {formatCurrency(totalSales)}
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                    
                    {/* Botón para enviar webhook si hay fechas seleccionadas en modo múltiple */}
                    {isMultiSelectMode && selectedDates.length > 0 && (
                      <div className="flex items-center justify-between pt-2 border-t">
                        <div className="text-sm text-gray-600">
                          {selectedDates.length} fecha(s) seleccionada(s)
                        </div>
                        <Button
                          onClick={handleSendWebhook}
                          disabled={loadingVentas}
                          className="bg-blue-600 text-white hover:bg-blue-700"
                        >
                          {loadingVentas ? 'Enviando...' : 'Consultar Webhook'}
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Ventas del día seleccionado */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-6 h-6 text-purple-600" />
                    {isMultiSelectMode && selectedDates.length > 0 ? (
                      <>Ventas ({selectedDates.length} fecha{selectedDates.length > 1 ? 's' : ''})</>
                    ) : selectedDate ? (
                      <>Ventas del {selectedDate.toLocaleDateString('es-ES', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })}</>
                    ) : (
                      <>Ventas del Día</>
                    )}
                  </CardTitle>
                  <CardDescription>
                    {isMultiSelectMode && selectedDates.length > 0
                      ? `Rango: ${selectedDates.sort((a, b) => a.getTime() - b.getTime())[0].toLocaleDateString('es-ES')} - ${selectedDates.sort((a, b) => a.getTime() - b.getTime())[selectedDates.length - 1].toLocaleDateString('es-ES')}`
                      : selectedDate 
                        ? 'Detalle de todas las ventas realizadas en esta fecha'
                        : 'Selecciona una fecha en el calendario para ver las ventas'
                    }
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!selectedDate && (!isMultiSelectMode || selectedDates.length === 0) ? (
                    <div className="text-center py-8 text-gray-500">
                      <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>Selecciona una fecha en el calendario</p>
                      <p className="text-sm mt-1">para ver las ventas de ese día</p>
                    </div>
                  ) : (
                    <>
                      {loadingVentas ? (
                        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                          <div className="flex items-center gap-2 text-blue-700">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                            <span className="text-sm">Cargando ventas...</span>
                          </div>
                        </div>
                      ) : (
                        <div className="mb-4 p-3 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <FlaskConical className="w-4 h-4 text-purple-600" />
                              <h4 className="text-sm font-semibold text-purple-900">
                                Ventas del Día
                              </h4>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="text-xs text-purple-700">
                                <span className="font-semibold">Total:</span>{' '}
                                <span className="font-bold text-purple-900">
                                  {(() => {
                                    const filtered = selectedCompanyFilter === 'all' 
                                      ? ventasDelDia 
                                      : ventasDelDia.filter(item => item.company === selectedCompanyFilter)
                                    return filtered.length
                                  })()}
                                </span>
                                {' '}ventas
                              </div>
                              {ventasDelDia.length > 0 && (
                                <Select 
                                  value={selectedCompanyFilter} 
                                  onValueChange={setSelectedCompanyFilter}
                                >
                                  <SelectTrigger className="h-7 text-xs w-[180px]">
                                    <SelectValue placeholder="Filtrar por compañía" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="all">Todas las compañías</SelectItem>
                                    {Array.from(new Set(ventasDelDia.map(item => item.company).filter(Boolean)))
                                      .sort()
                                      .map(company => (
                                        <SelectItem key={company} value={company}>
                                          {company}
                                        </SelectItem>
                                      ))
                                    }
                                  </SelectContent>
                                </Select>
                              )}
                            </div>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b border-purple-300">
                                  <th className="text-left py-1.5 px-2 font-semibold text-purple-900 w-10"></th>
                                  <th className="text-left py-1.5 px-2 font-semibold text-purple-900">Test</th>
                                  <th className="text-right py-1.5 px-2 font-semibold text-purple-900">Costo</th>
                                  <th className="text-left py-1.5 px-2 font-semibold text-purple-900">Compañía</th>
                                </tr>
                              </thead>
                              <tbody>
                                {ventasDelDia.length === 0 ? (
                                  <tr>
                                    <td colSpan={4} className="py-4 text-center text-gray-500">
                                      No hay ventas registradas para esta fecha
                                    </td>
                                  </tr>
                                ) : (
                                  (() => {
                                    const filtered = selectedCompanyFilter === 'all' 
                                      ? ventasDelDia 
                                      : ventasDelDia.filter(item => item.company === selectedCompanyFilter)
                                    
                                    if (filtered.length === 0) {
                                      return (
                                        <tr>
                                          <td colSpan={4} className="py-4 text-center text-gray-500">
                                            No hay ventas para la compañía seleccionada
                                          </td>
                                        </tr>
                                      )
                                    }
                                    
                                    // Agrupar por test y company
                                    const grouped = filtered.reduce((acc, venta) => {
                                      const key = `${venta.test || 'N/A'}_${venta.company || 'N/A'}`
                                      if (!acc[key]) {
                                        acc[key] = {
                                          test: venta.test || 'N/A',
                                          company: venta.company || 'N/A',
                                          items: [],
                                          totalAmount: 0
                                        }
                                      }
                                      acc[key].items.push(venta)
                                      acc[key].totalAmount += parseFloat(venta.amount.toString()) || 0
                                      return acc
                                    }, {} as Record<string, { test: string; company: string; items: typeof filtered; totalAmount: number }>)
                                    
                                    const groupedArray = Object.values(grouped)
                                    
                                    const toggleRow = (key: string) => {
                                      setExpandedRows(prev => {
                                        const newSet = new Set(prev)
                                        if (newSet.has(key)) {
                                          newSet.delete(key)
                                        } else {
                                          newSet.add(key)
                                        }
                                        return newSet
                                      })
                                    }
                                    
                                    return groupedArray.map((group, index) => {
                                      const rowKey = `${group.test}_${group.company}_${index}`
                                      const isExpanded = expandedRows.has(rowKey)
                                      const hasMultipleItems = group.items.length > 1
                                      
                                      return (
                                        <React.Fragment key={rowKey}>
                                          <tr className="border-b border-purple-100 hover:bg-purple-50/50">
                                            <td className="py-1.5 px-2">
                                              {hasMultipleItems && (
                                                <button
                                                  onClick={() => toggleRow(rowKey)}
                                                  className="p-1 hover:bg-purple-200 rounded transition-colors"
                                                  title={isExpanded ? "Ocultar detalles" : "Ver detalles"}
                                                >
                                                  {isExpanded ? (
                                                    <ChevronDown className="w-3 h-3 text-purple-600" />
                                                  ) : (
                                                    <ChevronRight className="w-3 h-3 text-purple-600" />
                                                  )}
                                                </button>
                                              )}
                                            </td>
                                            <td className="py-1.5 px-2 text-gray-900">
                                              <span className="font-medium">{group.test}</span>
                                              {hasMultipleItems && (
                                                <span className="ml-2 text-[10px] text-gray-500">
                                                  x{group.items.length}
                                                </span>
                                              )}
                                            </td>
                                            <td className="py-1.5 px-2 text-right text-green-600 font-semibold">
                                              {formatCurrency(group.totalAmount)}
                                            </td>
                                            <td className="py-1.5 px-2 text-gray-900">
                                              {group.company}
                                            </td>
                                          </tr>
                                          {isExpanded && hasMultipleItems && (
                                            <tr>
                                              <td colSpan={4} className="py-2 px-2 bg-purple-50/30">
                                                <div className="pl-3 border-l-2 border-purple-300">
                                                  <div className="text-[10px] font-semibold text-gray-700 mb-1.5">
                                                    Detalle de ventas individuales:
                                                  </div>
                                                  <div className="space-y-1">
                                                    {group.items.map((item, itemIndex) => (
                                                      <div 
                                                        key={itemIndex}
                                                        className="flex items-center justify-between py-1 px-2 bg-white rounded border border-purple-200"
                                                      >
                                                        <span className="text-[10px] text-gray-600">
                                                          Venta #{itemIndex + 1}
                                                        </span>
                                                        <span className="text-[10px] font-semibold text-green-600">
                                                          {formatCurrency(parseFloat(item.amount.toString()) || 0)}
                                                        </span>
                                                      </div>
                                                    ))}
                                                  </div>
                                                </div>
                                              </td>
                                            </tr>
                                          )}
                                        </React.Fragment>
                                      )
                                    })
                                  })()
                                )}
                              </tbody>
                              {(() => {
                                const filtered = selectedCompanyFilter === 'all' 
                                  ? ventasDelDia 
                                  : ventasDelDia.filter(item => item.company === selectedCompanyFilter)
                                
                                if (filtered.length > 0) {
                                  // Calcular total usando los grupos para evitar duplicados
                                  const grouped = filtered.reduce((acc, venta) => {
                                    const key = `${venta.test || 'N/A'}_${venta.company || 'N/A'}`
                                    if (!acc[key]) {
                                      acc[key] = 0
                                    }
                                    acc[key] += parseFloat(venta.amount.toString()) || 0
                                    return acc
                                  }, {} as Record<string, number>)
                                  
                                  const total = Object.values(grouped).reduce((sum, amount) => sum + amount, 0)
                                  
                                  return (
                                    <tfoot>
                                      <tr className="border-t-2 border-purple-300 bg-purple-100/50">
                                        <td className="py-1.5 px-2 font-semibold text-purple-900" colSpan={2}>Total</td>
                                        <td className="py-1.5 px-2 text-right font-bold text-green-600">
                                          {formatCurrency(total)}
                                        </td>
                                        <td className="py-1.5 px-2"></td>
                                      </tr>
                                    </tfoot>
                                  )
                                }
                                return null
                              })()}
                            </table>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Últimas 10 ventas */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-6 h-6 text-green-600" />
                  Últimas 10 Ventas
                </CardTitle>
                <CardDescription>
                  Ventas más recientes registradas
                </CardDescription>
              </CardHeader>
              <CardContent>
                {ultimas10Ventas.length > 0 ? (
                  <div className="space-y-3">
                    {ultimas10Ventas.map((venta, index) => (
                      <div
                        key={index}
                        className="p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-semibold text-gray-900">
                                {venta.test || 'Test sin nombre'}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-gray-600">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {new Date(venta.fecha).toLocaleDateString('es-ES', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric'
                                })}
                              </span>
                              {venta.company && (
                                <span className="text-gray-500">
                                  {venta.company}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-green-600">
                              {formatCurrency(parseFloat(venta.amount.toString()) || 0)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No hay ventas registradas</p>
                    <p className="text-sm mt-1">Las ventas aparecerán aquí cuando se registren</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

