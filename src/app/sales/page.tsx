'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Navbar } from '@/components/Navbar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Upload, FileSpreadsheet, Save, BarChart3, TrendingUp, Package, AlertCircle, ChevronDown, ChevronRight, Filter, X, Calculator, Trash2, AlertTriangle, Edit2 } from 'lucide-react'
import { CategoryBadge } from '@/components/CategoryBadge'
import { TypeBadge } from '@/components/TypeBadge'
import { formatCurrency, formatPercentage, computePricing } from '@/lib/compute'
import { PRODUCT_CATEGORIES, getCategoryNames, getCategoryFromProductName, getTypeFromProductName, CategoryName } from '@/lib/categories'
import { supabase } from '@/lib/supabase'
import { CountryCode, Sale, Product } from '@/types'
import { COUNTRY_NAMES, COUNTRY_FLAGS } from '@/lib/countryRates'
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
import * as XLSX from 'xlsx'

interface ParsedSale {
  productName: string
  productSku?: string
  countryCode: CountryCode
  month: number
  year: number
  quantity: number
  grossSalesAmount?: number
  grossProfitAmount?: number
}

interface MonthlySales {
  month: number
  year: number
  quantity: number
}

/**
 * Página de importación y visualización de ventas desde Excel
 */
export default function SalesPage() {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>('')
  const [success, setSuccess] = useState<string>('')
  const [parsedSales, setParsedSales] = useState<ParsedSale[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [processingProgress, setProcessingProgress] = useState<{ current: number; total: number } | null>(null)
  const [selectedCountry, setSelectedCountry] = useState<CountryCode | 'all'>('all')
  const [monthlySales, setMonthlySales] = useState<MonthlySales[]>([])
  const [productSales, setProductSales] = useState<Array<{
    id: string
    product_id: string
    product_name: string
    product_sku: string
    product_category: string | null
    product_type: string | null
    product_price: number
    product_full: Product | null
    country_code: CountryCode
    quantity: number
    month: number
    year: number
  }>>([])
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
  const [productOverrides, setProductOverrides] = useState<Record<string, any>>({})
  const [userId, setUserId] = useState<string | null>(null)
  const [openMonths, setOpenMonths] = useState<Record<string, boolean>>({})
  const [selectedMonths, setSelectedMonths] = useState<Set<string>>(new Set())
  const [monthFilters, setMonthFilters] = useState<Record<string, {
    categories: string[]
    types: string[]
    productName: string
  }>>({})
  const [combinedFilter, setCombinedFilter] = useState<{
    categories: string[]
    types: string[]
    productName: string
  }>({ categories: [], types: [], productName: '' })
  const [filterDialogOpen, setFilterDialogOpen] = useState<Record<string, boolean>>({})
  const [productFilterOpen, setProductFilterOpen] = useState<Record<string, boolean>>({})
  const [combinedFilterOpen, setCombinedFilterOpen] = useState(false)
  const [plDialogOpen, setPlDialogOpen] = useState<Record<string, boolean>>({})
  const [combinedPlDialogOpen, setCombinedPlDialogOpen] = useState(false)
  const [clearAllDialogOpen, setClearAllDialogOpen] = useState(false)
  const [clearing, setClearing] = useState(false)
  const router = useRouter()

  // Cerrar dropdowns al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('.filter-dropdown-container')) {
        setFilterDialogOpen({})
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

      // Eliminar ventas hardcodeadas de Noviembre 2025 en Argentina
      try {
        await supabase
          .from('sales')
          .delete()
          .eq('user_id', session.user.id)
          .eq('country_code', 'AR')
          .eq('year', 2025)
          .eq('month', 11)
      } catch (e) {
        console.error('Error eliminando ventas hardcodeadas:', e)
      }

      // Cargar productos
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('*')
        .eq('user_id', session.user.id)

      if (productsError) {
        console.error('Error cargando productos:', productsError)
      } else {
        setProducts(productsData || [])
      }
    }
    loadData()
  }, [router])

  // Cargar ventas mensuales y detalle de productos cuando cambia el país seleccionado
  useEffect(() => {
    if (!userId) return

    const loadSalesData = async () => {
      let query = supabase
        .from('sales')
        .select(`
          month, 
          year, 
          quantity,
          product_id,
          country_code,
          products(id, name, sku, category, tipo, base_price, currency, description, user_id, created_at, updated_at)
        `)
        .eq('user_id', userId)

      if (selectedCountry !== 'all') {
        query = query.eq('country_code', selectedCountry)
      }

      const { data, error } = await query

      if (error) {
        console.error('Error cargando ventas:', error)
        return
      }

      // Cargar overrides de productos por país
      const productIds = Array.from(new Set((data || []).map((s: any) => s.product_id)))
      const countryCodes = selectedCountry !== 'all' 
        ? [selectedCountry] 
        : Array.from(new Set((data || []).map((s: any) => s.country_code)))

      const { data: overridesData } = await supabase
        .from('product_country_overrides')
        .select('*')
        .in('product_id', productIds)
        .in('country_code', countryCodes)

      // Crear mapa de overrides: key = `${product_id}-${country_code}`
      const overridesMap: Record<string, any> = {}
      if (overridesData) {
        overridesData.forEach((override: any) => {
          const key = `${override.product_id}-${override.country_code}`
          overridesMap[key] = override.overrides || {}
        })
      }
      setProductOverrides(overridesMap)

      // Agrupar por mes y año para el resumen mensual
      const grouped = (data || []).reduce((acc, sale) => {
        const key = `${sale.year}-${sale.month}`
        if (!acc[key]) {
          acc[key] = { month: sale.month, year: sale.year, quantity: 0 }
        }
        acc[key].quantity += sale.quantity
        return acc
      }, {} as Record<string, MonthlySales>)

      const monthly = Object.values(grouped).sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year
        return a.month - b.month
      })

      setMonthlySales(monthly)

      // Crear lista de ventas individuales con producto, cantidad y mes
      const salesList = (data || [])
        .map((sale: any) => {
          const product = sale.products
          if (!product || !product.id) return null

          return {
            id: sale.id,
            product_id: product.id,
            product_name: product.name || 'Producto sin nombre',
            product_sku: product.sku || 'N/A',
            product_category: product.category || null,
            product_type: product.tipo || null,
            product_price: product.base_price || 0,
            product_full: product as Product,
            country_code: sale.country_code as CountryCode,
            quantity: sale.quantity,
            month: sale.month,
            year: sale.year,
          }
        })
        .filter((item: any): item is NonNullable<typeof item> => item !== null)
        .sort((a: any, b: any) => {
          // Ordenar por año, mes y luego por nombre de producto
          if (a.year !== b.year) return a.year - b.year
          if (a.month !== b.month) return a.month - b.month
          return a.product_name.localeCompare(b.product_name)
        }) as any[]

      setProductSales(salesList as any)
    }

    loadSalesData()
  }, [selectedCountry, userId])

  /**
   * Parsea el Excel y extrae datos de ventas
   * Formato esperado: Año - Mes - Producto - Cantidad - País
   * Columnas: A=Año, B=Mes, C=Producto, D=Cantidad, E=País
   */
  const parseExcel = (rows: Array<Array<any>>): ParsedSale[] => {
    const sales: ParsedSale[] = []
    
    if (rows.length < 2) {
      throw new Error("El archivo Excel debe tener al menos 2 filas (encabezado + datos)")
    }

    // Mapeo de códigos de país
    const countryMap: Record<string, CountryCode> = {
      'UY': 'UY', 'Uruguay': 'UY', 'URUGUAY': 'UY',
      'AR': 'AR', 'Argentina': 'AR', 'ARGENTINA': 'AR',
      'MX': 'MX', 'México': 'MX', 'Mexico': 'MX', 'MEXICO': 'MX',
      'CL': 'CL', 'Chile': 'CL', 'CHILE': 'CL',
      'VE': 'VE', 'Venezuela': 'VE', 'VENEZUELA': 'VE',
      'CO': 'CO', 'Colombia': 'CO', 'COLOMBIA': 'CO',
    }

    // Mapeo de meses
    const monthMap: Record<string, number> = {
      'Enero': 1, 'Febrero': 2, 'Marzo': 3, 'Abril': 4,
      'Mayo': 5, 'Junio': 6, 'Julio': 7, 'Agosto': 8,
      'Septiembre': 9, 'Setiembre': 9, 'Octubre': 10, 'Noviembre': 11, 'Diciembre': 12,
      'Ene': 1, 'Feb': 2, 'Mar': 3, 'Abr': 4, 'May': 5, 'Jun': 6,
      'Jul': 7, 'Ago': 8, 'Sep': 9, 'Set': 9, 'Oct': 10, 'Nov': 11, 'Dic': 12,
      'Jan': 1, 'February': 2, 'March': 3, 'Apr': 4, 'June': 6,
      'July': 7, 'Aug': 8, 'September': 9, 'October': 10, 'November': 11, 'Dec': 12,
      '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6,
      '7': 7, '8': 8, '9': 9, '10': 10, '11': 11, '12': 12,
    }

    // Detectar fila de encabezado (buscar palabras clave como "Año", "Mes", "Producto", etc.)
    let headerRowIndex = 0
    const headerKeywords = ['año', 'year', 'mes', 'month', 'producto', 'product', 'cantidad', 'quantity', 'país', 'country', 'pais']
    
    for (let i = 0; i < Math.min(3, rows.length); i++) {
      const row = rows[i] || []
      const firstCell = String(row[0] || '').trim().toLowerCase()
      const secondCell = String(row[1] || '').trim().toLowerCase()
      const thirdCell = String(row[2] || '').trim().toLowerCase()
      
      if (headerKeywords.some(keyword => 
        firstCell.includes(keyword) || 
        secondCell.includes(keyword) || 
        thirdCell.includes(keyword)
      )) {
        headerRowIndex = i
        break
      }
    }

    // Procesar filas de datos (empezando después del encabezado)
    for (let rowIdx = headerRowIndex + 1; rowIdx < rows.length; rowIdx++) {
      const row = rows[rowIdx] || []
      
      // Formato: Año (col 0) - Mes (col 1) - Producto (col 2) - Cantidad (col 3) - País (col 4)
      const yearCell = row[0]
      const monthCell = row[1]
      const productCell = row[2]
      const quantityCell = row[3]
      const countryCell = row[4]

      // Validar que tengamos los datos mínimos (producto y cantidad son obligatorios)
      const hasProduct = productCell !== null && productCell !== undefined && String(productCell).trim() !== ''
      const hasQuantity = quantityCell !== null && quantityCell !== undefined && String(quantityCell).trim() !== ''
      
      if (!hasProduct || !hasQuantity) {
        // Si la fila está completamente vacía, saltarla
        const isEmpty = !yearCell && !monthCell && !productCell && !quantityCell && !countryCell
        if (isEmpty) continue
        
        // Si tiene algunos datos pero faltan producto o cantidad, loguear y saltar
        if (hasProduct || hasQuantity) {
          console.warn(`Fila ${rowIdx + 1} incompleta - Producto: ${hasProduct}, Cantidad: ${hasQuantity}`)
        }
        continue
      }

      // Parsear año
      let year = new Date().getFullYear()
      if (yearCell !== null && yearCell !== undefined && yearCell !== '') {
        // Si es número, puede ser año directo o fecha serial de Excel
        if (typeof yearCell === 'number') {
          if (yearCell > 2000 && yearCell < 2100) {
            // Es un año directo
            year = Math.round(yearCell)
          } else if (yearCell > 1 && yearCell < 100000) {
            // Puede ser una fecha serial de Excel
            try {
              const excelEpoch = new Date(1899, 11, 30)
              const date = new Date(excelEpoch.getTime() + (yearCell - 1) * 86400000)
              if (!isNaN(date.getTime())) {
                year = date.getFullYear()
              }
            } catch (e) {
              // Si falla, intentar como año de 2 dígitos
              if (yearCell >= 0 && yearCell < 100) {
                year = 2000 + Math.round(yearCell)
              }
            }
          }
        } else {
          // Es texto/string
          const yearStr = String(yearCell).trim()
          const yearNum = parseInt(yearStr)
          if (!isNaN(yearNum)) {
            if (yearNum > 2000 && yearNum < 2100) {
              year = yearNum
            } else if (yearNum >= 0 && yearNum < 100) {
              // Año de 2 dígitos
              year = 2000 + yearNum
            }
          } else {
            // Intentar extraer año de string
            const yearMatch = yearStr.match(/\b(20\d{2})\b/) || yearStr.match(/\b(19\d{2})\b/)
            if (yearMatch) {
              year = parseInt(yearMatch[1])
            } else {
              // Intentar parsear como fecha
              try {
                const date = new Date(yearStr)
                if (!isNaN(date.getTime())) {
                  year = date.getFullYear()
                }
              } catch (e) {
                console.warn(`No se pudo parsear el año en la fila ${rowIdx + 1}: ${yearCell}, usando año actual`)
              }
            }
          }
        }
      }
      
      // Validar que el año sea razonable
      if (year < 2000 || year > 2100) {
        console.warn(`Año inválido en la fila ${rowIdx + 1}: ${yearCell}, usando año actual`)
        year = new Date().getFullYear()
      }

      // Parsear mes
      let month = 1
      if (monthCell !== null && monthCell !== undefined && monthCell !== '') {
        let monthStr = String(monthCell).trim()
        
        // Si es una fecha de Excel (número serial), convertirla
        if (typeof monthCell === 'number') {
          if (monthCell >= 1 && monthCell <= 12) {
            // Es un número de mes directo
            month = Math.round(monthCell)
          } else if (monthCell > 1 && monthCell < 100000) {
            // Puede ser una fecha serial, intentar convertir
            try {
              const excelEpoch = new Date(1899, 11, 30)
              const date = new Date(excelEpoch.getTime() + (monthCell - 1) * 86400000)
              if (!isNaN(date.getTime())) {
                month = date.getMonth() + 1
                // Si el año no se había parseado antes, usar el de la fecha
                if (year === new Date().getFullYear()) {
                  year = date.getFullYear()
                }
              }
            } catch (e) {
              // Si falla, intentar como número de mes
              const monthNum = Math.round(monthCell)
              if (monthNum >= 1 && monthNum <= 12) {
                month = monthNum
              }
            }
          }
        } else {
          // Es texto o string
          // Si es número como string
          const monthNum = parseInt(monthStr)
          if (!isNaN(monthNum) && monthNum >= 1 && monthNum <= 12) {
            month = monthNum
          } else {
            // Buscar en el mapeo de meses
            let found = false
            for (const [key, monthNum] of Object.entries(monthMap)) {
              if (monthStr.toLowerCase().includes(key.toLowerCase()) || 
                  key.toLowerCase().includes(monthStr.toLowerCase())) {
                month = monthNum
                found = true
                break
              }
            }
            // Si no se encontró, intentar parsear como fecha
            if (!found) {
              try {
                const date = new Date(monthStr)
                if (!isNaN(date.getTime())) {
                  month = date.getMonth() + 1
                  // Si el año no se había parseado antes, usar el de la fecha
                  if (year === new Date().getFullYear()) {
                    year = date.getFullYear()
                  }
                }
              } catch (e) {
                console.warn(`No se pudo parsear el mes en la fila ${rowIdx + 1}: ${monthCell}, usando mes 1`)
              }
            }
          }
        }
      }
      
      // Validar que el mes sea válido
      if (month < 1 || month > 12) {
        console.warn(`Mes inválido en la fila ${rowIdx + 1}: ${monthCell}, usando mes 1`)
        month = 1
      }

      // Parsear producto
      const productName = String(productCell || '').trim()
      if (!productName || productName === '') continue

      // Extraer SKU del nombre del producto si está disponible
      const skuMatch = productName.match(/\[([^\]]+)\]/)
      const productSku = skuMatch ? skuMatch[1] : undefined

      // Parsear cantidad
      let quantity = 0
      if (quantityCell !== null && quantityCell !== undefined && quantityCell !== '') {
        if (typeof quantityCell === 'number') {
          quantity = quantityCell
        } else {
          const quantityStr = String(quantityCell).replace(/[^\d.-]/g, '')
          const quantityNum = parseFloat(quantityStr)
          if (!isNaN(quantityNum)) {
            quantity = quantityNum
          }
        }
      }

      if (quantity <= 0) continue

      // Parsear país
      let countryCode: CountryCode | null = null
      if (countryCell !== null && countryCell !== undefined && countryCell !== '') {
        const countryStr = String(countryCell).trim().toUpperCase()
        for (const [key, code] of Object.entries(countryMap)) {
          if (countryStr === key.toUpperCase() || 
              countryStr.includes(key.toUpperCase()) ||
              countryStr === code) {
            countryCode = code
            break
          }
        }
      }

      // Si no encontramos país, intentar buscar en otras columnas o saltar esta fila
      if (!countryCode) {
        console.warn(`No se pudo identificar el país en la fila ${rowIdx + 1}: ${countryCell}`)
        continue
      }

      // Agregar la venta
      sales.push({
        productName,
        productSku,
        countryCode,
        month,
        year,
        quantity,
      })
      
      // Log para debug (solo las primeras 5 ventas)
      if (sales.length <= 5) {
        console.log(`Venta parseada: ${productName} - Mes: ${month}/${year} - Cantidad: ${quantity} - País: ${countryCode}`)
      }
    }
    
    console.log(`Total de ventas parseadas: ${sales.length}`)
    console.log(`Meses encontrados: ${Array.from(new Set(sales.map(s => `${s.year}-${s.month}`))).join(', ')}`)

    if (sales.length === 0) {
      throw new Error("No se encontraron ventas válidas en el archivo. Verifica que el formato sea: Año - Mes - Producto - Cantidad - País")
    }

    return sales
  }

  /**
   * Maneja la carga del archivo Excel
   */
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    setError('')
    setSuccess('')
    setParsedSales([])

    const reader = new FileReader()

    reader.onload = async (evt) => {
      try {
        const result = evt.target?.result
        if (!result || !(result instanceof ArrayBuffer)) {
          throw new Error("Error al leer el archivo")
        }

        const workbook = XLSX.read(result, { 
          type: "array",
          cellDates: false,
          cellNF: false,
          cellText: false
        })

        if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
          throw new Error("El archivo Excel no contiene hojas válidas")
        }

        const sheetName = workbook.SheetNames.includes("Hoja 1") 
          ? "Hoja 1" 
          : workbook.SheetNames[0]

        const sheet = workbook.Sheets[sheetName]
        if (!sheet) {
          throw new Error(`No se pudo acceder a la hoja "${sheetName}"`)
        }

        const rows = XLSX.utils.sheet_to_json(sheet, {
          header: 1,
          raw: true,
          defval: "",
          blankrows: true
        }) as Array<Array<any>>

        if (!rows || rows.length === 0) {
          throw new Error("El archivo Excel está vacío")
        }

        // Normalizar filas
        const maxColumns = Math.max(...rows.map(row => Array.isArray(row) ? row.length : 0), 0)
        const normalizedRows = rows.map(row => {
          if (!Array.isArray(row)) return Array(maxColumns).fill("")
          const normalized = [...row]
          while (normalized.length < maxColumns) normalized.push("")
          return normalized
        })

        // Parsear ventas (procesar en chunks para archivos grandes)
        const totalRows = normalizedRows.length
        const chunkSize = 1000 // Procesar 1000 filas a la vez
        const sales: ParsedSale[] = []
        
        setProcessingProgress({ current: 0, total: totalRows })
        
        for (let i = 0; i < normalizedRows.length; i += chunkSize) {
          const chunk = normalizedRows.slice(i, Math.min(i + chunkSize, normalizedRows.length))
          const chunkSales = parseExcel(chunk)
          sales.push(...chunkSales)
          
          // Actualizar progreso y permitir que el navegador respire
          setProcessingProgress({ current: Math.min(i + chunkSize, totalRows), total: totalRows })
          await new Promise(resolve => setTimeout(resolve, 0))
        }
        
        setProcessingProgress(null)
        
        if (sales.length === 0) {
          throw new Error("No se encontraron ventas en el archivo. Verifica que el formato sea correcto.")
        }

        setParsedSales(sales)
        setSuccess(`Se encontraron ${sales.length} registros de ventas`)
      } catch (err: any) {
        console.error("Error procesando Excel:", err)
        setError(err?.message || "Error al procesar el archivo Excel")
      } finally {
        setLoading(false)
      }
    }

    reader.onerror = () => {
      setError("Error al leer el archivo")
      setLoading(false)
    }

    reader.readAsArrayBuffer(file)
  }

  /**
   * Guarda las ventas parseadas en la base de datos
   */
  const handleSaveSales = async () => {
    if (!userId || parsedSales.length === 0) return

    setSaving(true)
    setError('')
    setSuccess('')
    setProcessingProgress({ current: 0, total: parsedSales.length })

    try {
      // Crear índices de productos para búsqueda O(1) en lugar de O(n)
      const productIndexBySku = new Map<string, Product>()
      const productIndexByName = new Map<string, Product>()
      const productIndexByCleanName = new Map<string, Product>()
      
      products.forEach(p => {
        const skuLower = p.sku.toLowerCase().trim()
        const nameLower = p.name.toLowerCase().trim()
        const cleanName = p.name.replace(/\[.*?\]/g, '').trim().toLowerCase()
        
        productIndexBySku.set(skuLower, p)
        productIndexByName.set(nameLower, p)
        productIndexByCleanName.set(cleanName, p)
      })

      // Buscar productos por SKU o nombre, crear automáticamente si no existen
      const salesToInsert = []
      const createdProducts: string[] = []
      const BATCH_SIZE = 500 // Procesar en lotes para mostrar progreso

      for (let i = 0; i < parsedSales.length; i += BATCH_SIZE) {
        const batch = parsedSales.slice(i, Math.min(i + BATCH_SIZE, parsedSales.length))
        
        for (const sale of batch) {
          // Limpiar el nombre del producto (remover corchetes y espacios extra)
          const cleanProductName = sale.productName.replace(/\[.*?\]/g, '').trim()
          const productNameLower = sale.productName.toLowerCase().trim()
          const cleanNameLower = cleanProductName.toLowerCase().trim()
          
          // Buscar producto usando índices (más eficiente)
          let product: Product | null = null

          // 1. Buscar por SKU exacto (si existe)
          if (sale.productSku) {
            product = productIndexBySku.get(sale.productSku.toLowerCase().trim()) || null
          }

          // 2. Buscar por nombre exacto (con y sin corchetes)
          if (!product) {
            product = productIndexByName.get(productNameLower) || 
                     productIndexByName.get(cleanNameLower) ||
                     (sale.productSku ? productIndexByName.get(sale.productSku.toLowerCase().trim()) : null) ||
                     productIndexByCleanName.get(cleanNameLower) ||
                     null
          }

          // 3. Búsqueda parcial (solo si no se encontró con índices exactos)
          // Priorizar coincidencias exactas y evitar que términos cortos coincidan con productos más largos
          if (!product) {
            const searchTerm = cleanNameLower || productNameLower
            
            // Primero intentar coincidencias exactas de SKU
            if (sale.productSku) {
              const skuLower = sale.productSku.toLowerCase().trim()
              product = products.find(p => {
                const pSkuLower = p.sku.toLowerCase().trim()
                const pNameLower = p.name.toLowerCase().trim()
                return pSkuLower === skuLower || pNameLower === skuLower
              }) || null
            }
            
            // Si no se encontró, buscar coincidencias más estrictas
            // CRÍTICO: Si el término de búsqueda es más corto que el nombre del producto,
            // NO coincidir a menos que sea exactamente igual. Esto evita que "Unity" coincida con "Unity BPS"
            if (!product) {
              product = products.find(p => {
                const pNameLower = p.name.toLowerCase().trim()
                
                // Coincidencia exacta
                if (pNameLower === searchTerm) {
                  return true
                }
                
                // Si el término de búsqueda es más corto que el nombre del producto, NO coincidir
                // Esto previene que "Unity" (5 chars) coincida con "Unity BPS" (9 chars)
                if (searchTerm.length < pNameLower.length) {
                  return false
                }
                
                // Si el término de búsqueda es igual o más largo, verificar que contenga el nombre del producto
                // y que la diferencia sea razonable (máximo 3 caracteres adicionales)
                if (searchTerm.length >= pNameLower.length) {
                  if (searchTerm.includes(pNameLower) && searchTerm.length - pNameLower.length <= 3) {
                    return true
                  }
                }
                
                return false
              }) || null
            }
          }

          // 4. Si no se encontró, crear el producto automáticamente
          if (!product) {
            try {
              // Detectar categoría y tipo automáticamente
              const category = getCategoryFromProductName(sale.productName) || null
              const tipo = getTypeFromProductName(sale.productName) || null
              
              // Usar el nombre del producto como SKU si no hay SKU, o generar uno único
              const sku = sale.productSku || sale.productName.trim().substring(0, 50) || `AUTO-${Date.now()}`
              
              // Crear el producto con precio base de 10 USD (para mostrar alerta de desactualizado)
              const { data: newProduct, error: createError } = await supabase
                .from('products')
                .insert([{
                  name: sale.productName.trim(),
                  sku: sku,
                  description: null,
                  category: category,
                  tipo: tipo,
                  base_price: 10, // Precio por defecto que activará la alerta de desactualizado
                  currency: 'USD',
                  user_id: userId
                }])
                .select()
                .single()

              if (createError) {
                console.error(`Error creando producto "${sale.productName}":`, createError)
                // Si falla la creación, continuar sin este producto
                continue
              }

              if (newProduct) {
                product = newProduct as Product
                createdProducts.push(sale.productName)
                
                // Actualizar los índices para evitar crear duplicados en el mismo batch
                const skuLower = product.sku.toLowerCase().trim()
                const nameLower = product.name.toLowerCase().trim()
                const cleanName = product.name.replace(/\[.*?\]/g, '').trim().toLowerCase()
                
                productIndexBySku.set(skuLower, product)
                productIndexByName.set(nameLower, product)
                productIndexByCleanName.set(cleanName, product)
                products.push(product)
              }
            } catch (err: any) {
              console.error(`Error creando producto "${sale.productName}":`, err)
              // Continuar sin este producto
              continue
            }
          }

          if (!product) {
            // Si aún no hay producto después de intentar crearlo, saltar esta venta
            continue
          }

          salesToInsert.push({
            user_id: userId,
            product_id: product.id,
            country_code: sale.countryCode,
            month: sale.month,
            year: sale.year,
            quantity: sale.quantity,
            gross_sales_amount: sale.grossSalesAmount || null,
            gross_profit_amount: sale.grossProfitAmount || null,
          })
        }
        
        // Actualizar progreso
        setProcessingProgress({ current: Math.min(i + BATCH_SIZE, parsedSales.length), total: parsedSales.length })
        // Permitir que el navegador respire
        await new Promise(resolve => setTimeout(resolve, 0))
      }

      if (salesToInsert.length === 0) {
        throw new Error("No se encontraron productos coincidentes para guardar las ventas")
      }

      // Guardar mensaje de productos creados para mostrarlo después del upsert
      let createdProductsMsg = ''
      if (createdProducts.length > 0) {
        const uniqueCreated = Array.from(new Set(createdProducts))
        console.log(`${uniqueCreated.length} productos creados automáticamente:`, uniqueCreated)
        
        createdProductsMsg = `\n\nSe crearon ${uniqueCreated.length} producto(s) automáticamente:\n${uniqueCreated.slice(0, 5).join('\n')}${uniqueCreated.length > 5 ? `\n... y ${uniqueCreated.length - 5} más` : ''}\n\nEstos productos fueron creados con precio base de $10.00 USD y mostrarán una alerta de "precio desactualizado". Puedes actualizar los precios desde la vista del producto.`
      }

      // Agrupar ventas por clave única dentro del mismo archivo para sumar duplicados
      const salesMap = new Map<string, typeof salesToInsert[0] & { quantity: number }>()
      
      for (const sale of salesToInsert) {
        const key = `${sale.user_id}-${sale.product_id}-${sale.country_code}-${sale.month}-${sale.year}`
        
        if (salesMap.has(key)) {
          // Si ya existe en el mismo archivo, sumar la cantidad
          const existing = salesMap.get(key)!
          existing.quantity += sale.quantity
        } else {
          // Si no existe, agregarlo
          salesMap.set(key, { ...sale })
        }
      }
      
      const finalSalesToInsert = Array.from(salesMap.values())
      
      // Obtener ventas existentes en la base de datos para sumar cantidades
      const uniqueKeys = Array.from(salesMap.keys())
      const existingSalesMap = new Map<string, any>()
      
      // Obtener registros existentes en batches
      const QUERY_BATCH_SIZE = 100
      for (let i = 0; i < uniqueKeys.length; i += QUERY_BATCH_SIZE) {
        const batch = uniqueKeys.slice(i, i + QUERY_BATCH_SIZE)
        
        for (const key of batch) {
          const [user_id, product_id, country_code, month, year] = key.split('-')
          
          const { data: existingData } = await supabase
            .from('sales')
            .select('*')
            .eq('user_id', user_id)
            .eq('product_id', product_id)
            .eq('country_code', country_code)
            .eq('month', parseInt(month))
            .eq('year', parseInt(year))
            .maybeSingle()
          
          if (existingData) {
            existingSalesMap.set(key, existingData)
          }
        }
      }
      
      // Preparar datos para upsert: si existe, sumar cantidad; si no, insertar nuevo
      const upsertData = finalSalesToInsert.map(sale => {
        const key = `${sale.user_id}-${sale.product_id}-${sale.country_code}-${sale.month}-${sale.year}`
        const existing = existingSalesMap.get(key)
        
        if (existing) {
          // Si existe, actualizar sumando la cantidad
          return {
            ...sale,
            quantity: existing.quantity + sale.quantity
          }
        } else {
          // Si no existe, insertar nuevo
          return sale
        }
      })
      
      // Usar upsert en batches para evitar límites de payload de Supabase
      const UPSERT_BATCH_SIZE = 1000
      let processedCount = 0
      
      for (let i = 0; i < upsertData.length; i += UPSERT_BATCH_SIZE) {
        const batch = upsertData.slice(i, Math.min(i + UPSERT_BATCH_SIZE, upsertData.length))
        
        // Usar upsert con onConflict para actualizar si existe
        const { error: upsertError } = await supabase
          .from('sales')
          .upsert(batch, {
            onConflict: 'user_id,country_code,month,year,product_id',
            ignoreDuplicates: false
          })

        if (upsertError) {
          throw upsertError
        }
        
        processedCount += batch.length
        setProcessingProgress({ current: processedCount, total: upsertData.length })
      }

      const newRecords = upsertData.filter(sale => {
        const key = `${sale.user_id}-${sale.product_id}-${sale.country_code}-${sale.month}-${sale.year}`
        return !existingSalesMap.has(key)
      }).length
      const updatedRecords = upsertData.length - newRecords
      
      let successMsg = `Se procesaron ${upsertData.length} registros`
      if (newRecords > 0 && updatedRecords > 0) {
        successMsg += `: ${newRecords} nuevos, ${updatedRecords} actualizados (cantidades sumadas)`
      } else if (newRecords > 0) {
        successMsg += ` (${newRecords} nuevos)`
      } else if (updatedRecords > 0) {
        successMsg += ` (${updatedRecords} actualizados, cantidades sumadas)`
      }
      
      // Agregar información sobre productos creados si hay
      if (createdProductsMsg) {
        successMsg += createdProductsMsg
      }
      
      setSuccess(successMsg)
      setParsedSales([])
      setProcessingProgress(null)
      
      // Recargar productos si se crearon nuevos
      if (createdProducts.length > 0) {
        const { data: productsData } = await supabase
          .from('products')
          .select('*')
          .eq('user_id', userId)
          .order('name', { ascending: true })
        
        if (productsData) {
          setProducts(productsData as Product[])
        }
      }
      
      // Recargar datos de ventas
      let query = supabase
        .from('sales')
        .select(`
          id,
          month, 
          year, 
          quantity,
          product_id,
          country_code,
          products(id, name, sku, category, tipo, base_price, currency, description, user_id, created_at, updated_at)
        `)
        .eq('user_id', userId)
        
      if (selectedCountry !== 'all') {
        query = query.eq('country_code', selectedCountry)
      }
      
      const { data: salesData } = await query

      if (salesData) {
        // Actualizar ventas mensuales
        const grouped = salesData.reduce((acc, sale: any) => {
          const key = `${sale.year}-${sale.month}`
          if (!acc[key]) {
            acc[key] = { month: sale.month, year: sale.year, quantity: 0 }
          }
          acc[key].quantity += sale.quantity
          return acc
        }, {} as Record<string, MonthlySales>)

        setMonthlySales(Object.values(grouped).sort((a, b) => {
          if (a.year !== b.year) return a.year - b.year
          return a.month - b.month
        }))

        // Cargar overrides si hay datos
        let overridesMap: Record<string, any> = {}
        if (salesData && salesData.length > 0) {
          const productIds = Array.from(new Set(salesData.map((s: any) => s.product_id)))
          const countryCodes = selectedCountry !== 'all' 
            ? [selectedCountry] 
            : Array.from(new Set(salesData.map((s: any) => s.country_code)))

          const { data: overridesData } = await supabase
            .from('product_country_overrides')
            .select('*')
            .in('product_id', productIds)
            .in('country_code', countryCodes)

          if (overridesData) {
            overridesData.forEach((override: any) => {
              const key = `${override.product_id}-${override.country_code}`
              overridesMap[key] = override.overrides || {}
            })
          }
          setProductOverrides(overridesMap)
        }

        // Actualizar detalle de productos (lista de ventas individuales)
        const salesList = salesData
          .map((sale: any) => {
            const product = sale.products
            if (!product || !product.id) return null

            return {
              id: sale.id,
              product_id: product.id,
              product_name: product.name || 'Producto sin nombre',
              product_sku: product.sku || 'N/A',
              product_category: product.category || null,
              product_type: product.tipo || null,
              product_price: product.base_price || 0,
              product_full: product as Product,
              country_code: sale.country_code as CountryCode,
              quantity: sale.quantity,
              month: sale.month,
              year: sale.year,
            }
          })
          .filter((item: any): item is NonNullable<typeof item> => item !== null)
          .sort((a: any, b: any) => {
            // Ordenar por año, mes y luego por nombre de producto
            if (a.year !== b.year) return a.year - b.year
            if (a.month !== b.month) return a.month - b.month
            return a.product_name.localeCompare(b.product_name)
          }) as any[]

        setProductSales(salesList as any)
      }
    } catch (err: any) {
      console.error("Error guardando ventas:", err)
      setError(err?.message || "Error al guardar las ventas")
    } finally {
      setSaving(false)
    }
  }

  /**
   * Actualiza la cantidad de una venta
   */
  const handleUpdateQuantity = async (saleId: string, newQuantity: number) => {
    if (!userId) return

    try {
      const { error } = await supabase
        .from('sales')
        .update({ quantity: newQuantity })
        .eq('id', saleId)
        .eq('user_id', userId)

      if (error) {
        throw error
      }

      // Actualizar el estado local
      setProductSales(prev => prev.map(sale => 
        sale.id === saleId ? { ...sale, quantity: newQuantity } : sale
      ))

      // Recargar ventas mensuales
      const { data: salesData } = await supabase
        .from('sales')
        .select('month, year, quantity')
        .eq('user_id', userId)
      
      if (salesData) {
        const grouped = salesData.reduce((acc, sale: any) => {
          const key = `${sale.year}-${sale.month}`
          if (!acc[key]) {
            acc[key] = { month: sale.month, year: sale.year, quantity: 0 }
          }
          acc[key].quantity += sale.quantity
          return acc
        }, {} as Record<string, MonthlySales>)

        setMonthlySales(Object.values(grouped).sort((a, b) => {
          if (a.year !== b.year) return a.year - b.year
          return a.month - b.month
        }))
      }
    } catch (err: any) {
      console.error("Error actualizando cantidad:", err)
      setError(err?.message || "Error al actualizar la cantidad")
    }
  }

  /**
   * Limpia todos los datos de ventas del usuario
   */
  const handleClearAllSales = async () => {
    if (!userId) return

    setClearing(true)
    setError('')
    setSuccess('')

    try {
      const { error: deleteError } = await supabase
        .from('sales')
        .delete()
        .eq('user_id', userId)

      if (deleteError) {
        throw deleteError
      }

      setSuccess('Todos los datos de ventas han sido eliminados exitosamente')
      setClearAllDialogOpen(false)
      
      // Recargar datos (debería estar vacío ahora)
      setProductSales([])
      setMonthlySales([])
    } catch (err: any) {
      console.error("Error eliminando ventas:", err)
      setError(err?.message || "Error al eliminar las ventas")
    } finally {
      setClearing(false)
    }
  }

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-6 h-6 text-green-600" />
              Importar Ventas desde Excel
            </CardTitle>
            <CardDescription>
              Sube un archivo Excel con datos de ventas. El sistema extraerá información de productos, países, meses y cantidades.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-4">
                <label htmlFor="excel-upload" className="cursor-pointer">
                  <Button asChild variant="outline" className="flex items-center gap-2" disabled={loading}>
                    <span>
                      <Upload className="w-4 h-4" />
                      {loading ? 'Procesando...' : 'Seleccionar archivo Excel'}
                    </span>
                  </Button>
                </label>
                <input
                  id="excel-upload"
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={loading}
                />
                {parsedSales.length > 0 && (
                  <Button 
                    onClick={handleSaveSales} 
                    disabled={saving || !userId}
                    className="flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    {saving ? 'Guardando...' : `Guardar ${parsedSales.length} ventas`}
                  </Button>
                )}
              </div>

              {processingProgress && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-blue-700 text-sm font-medium">
                      Procesando: {processingProgress.current} de {processingProgress.total} registros
                    </span>
                    <span className="text-blue-600 text-sm">
                      {Math.round((processingProgress.current / processingProgress.total) * 100)}%
                    </span>
                  </div>
                  <div className="w-full bg-blue-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(processingProgress.current / processingProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}

              {success && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
                  {success}
                </div>
              )}

              {parsedSales.length > 0 && (
                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>Ventas encontradas:</strong> {parsedSales.length} registros
                  </p>
                  <p className="text-xs text-blue-600 mt-1">
                    Productos: {new Set(parsedSales.map(s => s.productName)).size} | 
                    Países: {new Set(parsedSales.map(s => s.countryCode)).size} | 
                    Períodos: {new Set(parsedSales.map(s => `${s.year}-${s.month}`)).size}
                  </p>
                </div>
              )}

              {/* Botón para limpiar todos los datos */}
              {productSales.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <Button
                    onClick={() => setClearAllDialogOpen(true)}
                    variant="destructive"
                    className="flex items-center gap-2"
                    disabled={clearing || !userId}
                  >
                    <Trash2 className="w-4 h-4" />
                    {clearing ? 'Eliminando...' : 'Limpiar todos los datos de ventas'}
                  </Button>
                  <p className="text-xs text-gray-500 mt-2">
                    Esta acción eliminará permanentemente todas las ventas guardadas. Esta acción no se puede deshacer.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Dialog para confirmar limpieza de datos */}
        <Dialog open={clearAllDialogOpen} onOpenChange={setClearAllDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="w-5 h-5" />
                Confirmar eliminación de datos
              </DialogTitle>
              <DialogDescription>
                ¿Estás seguro de que deseas eliminar <strong>todas</strong> las ventas guardadas?
                <br />
                <br />
                Esta acción es <strong>irreversible</strong> y eliminará permanentemente todos los registros de ventas.
                <br />
                <br />
                <span className="text-sm text-gray-600">
                  Total de registros a eliminar: <strong>{productSales.length}</strong>
                </span>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setClearAllDialogOpen(false)}
                disabled={clearing}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={handleClearAllSales}
                disabled={clearing}
                className="flex items-center gap-2"
              >
                {clearing ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    Eliminando...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Sí, eliminar todo
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Filtro de país */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-blue-600" />
              Filtros de Visualización
            </CardTitle>
            <CardDescription>
              Selecciona un país para filtrar las ventas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium">País:</label>
              <Select value={selectedCountry} onValueChange={(value) => setSelectedCountry(value as CountryCode | 'all')}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los países</SelectItem>
                  {Object.entries(COUNTRY_NAMES).map(([code, name]) => (
                    <SelectItem key={code} value={code}>
                      {COUNTRY_FLAGS[code as CountryCode]} {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                    const key = `${sale.year}-${sale.month}`
                    if (!acc[key]) {
                      acc[key] = {
                        year: sale.year,
                        month: sale.month,
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

                  // Ordenar meses (del primero al último)
                  const sortedMonths = Object.values(salesByMonth).sort((a, b) => {
                    if (a.year !== b.year) return a.year - b.year
                    return a.month - b.month
                  })

                  // Calcular resumen anual - agrupar por año
                  const salesByYear = productSales.reduce((acc, sale) => {
                    const key = sale.year.toString()
                    if (!acc[key]) {
                      acc[key] = {
                        year: sale.year,
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
                  let combinedAvailableCategories = new Set<string>()
                  let combinedAvailableTypes = new Set<string>()
                  
                  if (selectedMonths.size > 1) {
                    selectedMonths.forEach(monthKey => {
                      const [year, month] = monthKey.split('-').map(Number)
                      const monthData = sortedMonths.find(m => m.year === year && m.month === month)
                      if (monthData) {
                        combinedSales.push(...monthData.sales)
                      }
                    })
                    
                    // Agrupar por producto y país, sumando cantidades
                    const combinedByProduct = combinedSales.reduce((acc, sale) => {
                      const key = `${sale.product_id}-${sale.country_code}`
                      if (!acc[key]) {
                        acc[key] = {
                          ...sale,
                          quantity: 0
                        }
                      }
                      acc[key].quantity += sale.quantity
                      return acc
                    }, {} as Record<string, typeof productSales[0]>)

                    const finalCombinedSales = Object.values(combinedByProduct)
                    
                    // Obtener categorías y tipos disponibles en la vista combinada
                    finalCombinedSales.forEach(sale => {
                      const category = sale.product_category || (sale.product_name ? getCategoryFromProductName(sale.product_name) : null)
                      if (category) combinedAvailableCategories.add(category)
                      if (sale.product_type) {
                        sale.product_type.split(',').forEach(t => combinedAvailableTypes.add(t.trim()))
                      }
                    })
                    
                    // Aplicar filtros a la vista combinada
                    filteredCombinedSales = finalCombinedSales
                    if (combinedFilter.productName && combinedFilter.productName.trim()) {
                      const searchTerm = combinedFilter.productName.toLowerCase().trim()
                      filteredCombinedSales = filteredCombinedSales.filter(sale => {
                        return sale.product_name.toLowerCase().includes(searchTerm)
                      })
                    }
                    if (combinedFilter.categories.length > 0) {
                      filteredCombinedSales = filteredCombinedSales.filter(sale => {
                        const category = sale.product_category || (sale.product_name ? getCategoryFromProductName(sale.product_name) : null)
                        return category && combinedFilter.categories.includes(category)
                      })
                    }
                    if (combinedFilter.types.length > 0) {
                      filteredCombinedSales = filteredCombinedSales.filter(sale => {
                        if (!sale.product_type) return false
                        const types = sale.product_type.split(',').map(t => t.trim())
                        return combinedFilter.types.some(selectedType => types.includes(selectedType))
                      })
                    }
                  }

                  return (
                    <>
                      {/* Vista combinada de meses seleccionados */}
                      {selectedMonths.size > 1 && (
                        <div className="border border-blue-300 rounded overflow-hidden mb-4 bg-blue-50">
                          <div className="bg-blue-200 px-2 py-1 border-b border-blue-300">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center justify-between w-full">
                                <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
                                  <Package className="w-4 h-4" />
                                  Meses Combinados ({Array.from(selectedMonths).map(key => {
                                    const [year, month] = key.split('-').map(Number)
                                    return `${monthNames[month - 1]} ${year}`
                                  }).join(', ')})
                                  <span className="ml-2 text-xs font-normal text-gray-600">
                                    (Total: {(() => {
                                      let filtered = Object.values(combinedSales.reduce((acc, sale) => {
                                        const key = `${sale.product_id}-${sale.country_code}`
                                        if (!acc[key]) {
                                          acc[key] = { ...sale, quantity: 0 }
                                        }
                                        acc[key].quantity += sale.quantity
                                        return acc
                                      }, {} as Record<string, typeof productSales[0]>))
                                      
                                      if (combinedFilter.productName && combinedFilter.productName.trim()) {
                                        const searchTerm = combinedFilter.productName.toLowerCase().trim()
                                        filtered = filtered.filter(sale => sale.product_name.toLowerCase().includes(searchTerm))
                                      }
                                      if (combinedFilter.categories.length > 0) {
                                        filtered = filtered.filter(sale => {
                                          const category = sale.product_category || (sale.product_name ? getCategoryFromProductName(sale.product_name) : null)
                                          return category && combinedFilter.categories.includes(category)
                                        })
                                      }
                                      if (combinedFilter.types.length > 0) {
                                        filtered = filtered.filter(sale => {
                                          if (!sale.product_type) return false
                                          const types = sale.product_type.split(',').map(t => t.trim())
                                          return combinedFilter.types.some(selectedType => types.includes(selectedType))
                                        })
                                      }
                                      
                                      return filtered.reduce((sum, s) => sum + s.quantity, 0).toLocaleString()
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
                                    onClick={() => setSelectedMonths(new Set())}
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
                                          <div className="fixed bg-white border border-gray-300 rounded-lg shadow-xl z-[100] p-3 min-w-[250px] max-w-[90vw]" style={{
                                            top: '50%',
                                            left: '50%',
                                            transform: 'translate(-50%, -50%)'
                                          }}>
                                            <div className="space-y-2">
                                              <label className="text-xs font-semibold block text-gray-700">Buscar producto:</label>
                                              <input
                                                type="text"
                                                value={combinedFilter.productName || ''}
                                                onChange={(e) => {
                                                  setCombinedFilter(prev => ({
                                                    ...prev,
                                                    productName: e.target.value
                                                  }))
                                                }}
                                                placeholder="Escribe el nombre..."
                                                className="w-full text-xs px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                autoFocus
                                              />
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
                                    <div className="relative filter-dropdown-container">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          setCombinedFilterOpen(!combinedFilterOpen)
                                        }}
                                        className="flex items-center gap-1 hover:text-blue-600 transition-colors"
                                      >
                                        Etiquetas
                                        <Filter className="w-3 h-3" />
                                        {(combinedFilter.categories.length > 0 || combinedFilter.types.length > 0) && (
                                          <span className="ml-1 text-xs bg-blue-500 text-white rounded-full px-1.5 py-0.5">
                                            {(combinedFilter.categories.length || 0) + (combinedFilter.types.length || 0)}
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
                                          <div className="fixed bg-white border border-gray-300 rounded-lg shadow-xl z-[100] p-4 min-w-[600px] max-h-[80vh] overflow-y-auto" style={{
                                            top: '50%',
                                            left: '50%',
                                            transform: 'translate(-50%, -50%)',
                                            maxWidth: '90vw'
                                          }}>
                                            <div className="flex gap-4">
                                              <div className="flex-1">
                                                <label className="text-xs font-semibold mb-2 block text-gray-700">Categorías:</label>
                                                <div className="space-y-1 max-h-[320px] overflow-y-auto">
                                                  {getCategoryNames().filter(cat => cat !== 'Todos' && combinedAvailableCategories.has(cat)).map((category) => (
                                                    <label key={category} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded text-xs">
                                                      <input
                                                        type="checkbox"
                                                        checked={combinedFilter.categories.includes(category)}
                                                        onChange={(e) => {
                                                          const newCategories = e.target.checked
                                                            ? [...combinedFilter.categories, category]
                                                            : combinedFilter.categories.filter(c => c !== category)
                                                          setCombinedFilter(prev => ({
                                                            ...prev,
                                                            categories: newCategories
                                                          }))
                                                        }}
                                                        className="rounded"
                                                      />
                                                      <span>{category}</span>
                                                    </label>
                                                  ))}
                                                </div>
                                              </div>
                                              <div className="flex-1">
                                                <label className="text-xs font-semibold mb-2 block text-gray-700">Tipos:</label>
                                                <div className="space-y-1 max-h-[320px] overflow-y-auto">
                                                  {Array.from(combinedAvailableTypes).sort().map((type) => (
                                                    <label key={type} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded text-xs">
                                                      <input
                                                        type="checkbox"
                                                        checked={combinedFilter.types.includes(type)}
                                                        onChange={(e) => {
                                                          const newTypes = e.target.checked
                                                            ? [...combinedFilter.types, type]
                                                            : combinedFilter.types.filter(t => t !== type)
                                                          setCombinedFilter(prev => ({
                                                            ...prev,
                                                            types: newTypes
                                                          }))
                                                        }}
                                                        className="rounded"
                                                      />
                                                      <span>{type}</span>
                                                    </label>
                                                  ))}
                                                </div>
                                              </div>
                                            </div>
                                            {((combinedFilter.categories?.length || 0) > 0 || (combinedFilter.types?.length || 0) > 0) && (
                                              <button
                                                onClick={() => {
                                                  setCombinedFilter({ categories: [], types: [], productName: '' })
                                                }}
                                                className="w-full mt-3 text-xs px-2 py-1 border border-gray-300 rounded hover:bg-gray-50 transition-colors flex items-center justify-center gap-1"
                                              >
                                                <X className="w-3 h-3" />
                                                Limpiar filtros
                                              </button>
                                            )}
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  </th>
                                  <th className="text-right py-1 px-2 font-semibold text-gray-700">Cantidad</th>
                                  <th className="text-right py-1 px-2 font-semibold text-gray-700">Gross Sale</th>
                                  <th className="text-right py-1 px-2 font-semibold text-gray-700">Gross Profit</th>
                                  <th className="text-right py-1 px-2 font-semibold text-gray-700">Margen</th>
                                </tr>
                              </thead>
                              <tbody>
                                {filteredCombinedSales.map((sale, idx) => {
                                  let grossSalesAmount = 0
                                  let grossProfitAmount = 0
                                  let margin = 0
                                  
                                  if (sale.product_full) {
                                    const overrideKey = `${sale.product_id}-${sale.country_code}`
                                    const overrides = productOverrides[overrideKey] || {}
                                    
                                    try {
                                      const computed = computePricing(sale.product_full, sale.country_code, overrides)
                                      grossSalesAmount = computed.grossSales.amount * sale.quantity
                                      grossProfitAmount = Math.abs(computed.grossProfit.amount) * sale.quantity
                                      margin = computed.grossProfit.pct || 0
                                    } catch (e) {
                                      grossSalesAmount = sale.product_price * sale.quantity
                                      grossProfitAmount = Math.abs(sale.product_price) * sale.quantity
                                      margin = 0
                                    }
                                  } else {
                                    grossSalesAmount = sale.product_price * sale.quantity
                                    grossProfitAmount = Math.abs(sale.product_price) * sale.quantity
                                    margin = 0
                                  }

                                  const isOutdatedPrice = sale.product_full && (() => {
                                    try {
                                      const overrideKey = `${sale.product_id}-${sale.country_code}`
                                      const overrides = productOverrides[overrideKey] || {}
                                      const computed = computePricing(sale.product_full, sale.country_code, overrides)
                                      return computed.grossSales.amount === 10
                                    } catch (e) {
                                      return false
                                    }
                                  })()

                                  // Crear una clave única para esta fila específica
                                  const rowKey = `combined-${sale.id || sale.product_id}-${sale.country_code}-${idx}`

                                  return (
                                    <tr key={rowKey} className="border-b border-gray-100 hover:bg-gray-50 last:border-b-0">
                                      <td className="py-1 px-2 text-gray-900">
                                        <div className="flex items-center gap-2">
                                          <Link 
                                            href={`/products/${sale.product_id}?country=${sale.country_code}`}
                                            className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                                          >
                                            {sale.product_name}
                                          </Link>
                                          {isOutdatedPrice && (
                                            <div className="relative group">
                                              <AlertCircle className="w-4 h-4 text-red-500" />
                                              <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block z-10 bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                                                Precio desactualizado
                                                <div className="absolute left-2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      </td>
                                      <td className="py-1 px-2">
                                        <div className="flex items-center gap-1 flex-wrap">
                                          <CategoryBadge 
                                            category={sale.product_category} 
                                            productName={sale.product_name} 
                                            size="sm" 
                                          />
                                          <TypeBadge 
                                            type={sale.product_type} 
                                            size="sm" 
                                          />
                                        </div>
                                      </td>
                                      <td className="py-1 px-2 text-right">
                                        {editingQuantity === rowKey ? (
                                          <div className="flex items-center justify-end gap-2">
                                            <input
                                              ref={(el) => {
                                                if (el) {
                                                  editInputRefs.current[rowKey] = el
                                                }
                                              }}
                                              type="number"
                                              min="0"
                                              value={quantityEditValue}
                                              data-edit-id={rowKey}
                                              onChange={(e) => setQuantityEditValue(e.target.value)}
                                              onBlur={async () => {
                                                const newQty = parseInt(quantityEditValue) || 0
                                                if (sale.id && newQty !== sale.quantity && newQty >= 0) {
                                                  await handleUpdateQuantity(sale.id, newQty)
                                                }
                                                setEditingQuantity(null)
                                                setQuantityEditValue('')
                                              }}
                                              onKeyDown={async (e) => {
                                                if (e.key === 'Enter') {
                                                  e.preventDefault()
                                                  const newQty = parseInt(quantityEditValue) || 0
                                                  if (sale.id && newQty !== sale.quantity && newQty >= 0) {
                                                    await handleUpdateQuantity(sale.id, newQty)
                                                  }
                                                  setEditingQuantity(null)
                                                  setQuantityEditValue('')
                                                } else if (e.key === 'Escape') {
                                                  e.preventDefault()
                                                  setEditingQuantity(null)
                                                  setQuantityEditValue('')
                                                }
                                              }}
                                              onClick={(e) => e.stopPropagation()}
                                              onFocus={(e) => {
                                                e.target.select()
                                              }}
                                              className="w-20 px-2 py-1 border border-blue-300 rounded text-right font-semibold text-blue-600"
                                            />
                                          </div>
                                        ) : (
                                          <div className="flex items-center justify-end gap-1">
                                            <span className="font-semibold text-blue-600">
                                              {sale.quantity.toLocaleString()}
                                            </span>
                                            {sale.id && (
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation()
                                                  e.preventDefault()
                                                  e.nativeEvent.stopImmediatePropagation()
                                                  setEditingQuantity(rowKey)
                                                  setQuantityEditValue(sale.quantity.toString())
                                                }}
                                                onMouseDown={(e) => {
                                                  e.preventDefault()
                                                  e.stopPropagation()
                                                }}
                                                className="p-1 hover:bg-blue-50 rounded text-blue-600 transition-colors"
                                                title="Editar cantidad"
                                                type="button"
                                              >
                                                <Edit2 className="w-3 h-3" />
                                              </button>
                                            )}
                                          </div>
                                        )}
                                      </td>
                                      <td className="py-1 px-2 text-right">
                                        <span className="font-semibold text-green-600">
                                          {formatCurrency(grossSalesAmount)}
                                        </span>
                                      </td>
                                      <td className="py-1 px-2 text-right">
                                        <span className="font-semibold text-purple-600">
                                          {formatCurrency(grossProfitAmount)}
                                        </span>
                                      </td>
                                      <td className="py-1 px-2 text-right">
                                        <span className="font-semibold text-orange-600">
                                          {margin.toFixed(1)}%
                                        </span>
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                              <tfoot>
                                {(() => {
                                  const totalQuantity = filteredCombinedSales.reduce((sum, s) => sum + s.quantity, 0)
                                  const totalGrossSales = filteredCombinedSales.reduce((sum, s) => {
                                        if (s.product_full) {
                                          const overrideKey = `${s.product_id}-${s.country_code}`
                                          const overrides = productOverrides[overrideKey] || {}
                                          try {
                                            const computed = computePricing(s.product_full, s.country_code, overrides)
                                            return sum + (computed.grossSales.amount * s.quantity)
                                          } catch (e) {
                                            return sum + (s.product_price * s.quantity)
                                          }
                                        }
                                        return sum + (s.product_price * s.quantity)
                                      }, 0)
                                  const totalGrossProfit = filteredCombinedSales.reduce((sum, s) => {
                                        if (s.product_full) {
                                          const overrideKey = `${s.product_id}-${s.country_code}`
                                          const overrides = productOverrides[overrideKey] || {}
                                          try {
                                            const computed = computePricing(s.product_full, s.country_code, overrides)
                                            return sum + (Math.abs(computed.grossProfit.amount) * s.quantity)
                                          } catch (e) {
                                            return sum + (Math.abs(s.product_price) * s.quantity)
                                          }
                                        }
                                        return sum + (Math.abs(s.product_price) * s.quantity)
                                      }, 0)
                                  const totalMargin = totalGrossSales > 0 
                                    ? (totalGrossProfit / totalGrossSales * 100)
                                    : 0

                                  return (
                                    <tr className="bg-blue-100 font-semibold border-t-2 border-gray-300">
                                      <td colSpan={2} className="py-1 px-2 text-gray-900">Total Combinado</td>
                                      <td className="py-1 px-2 text-right text-blue-600">
                                        {totalQuantity.toLocaleString()}
                                      </td>
                                      <td className="py-1 px-2 text-right text-green-600">
                                        {formatCurrency(totalGrossSales)}
                                      </td>
                                      <td className="py-1 px-2 text-right text-purple-600">
                                        {formatCurrency(totalGrossProfit)}
                                      </td>
                                      <td className="py-1 px-2 text-right text-orange-600">
                                        {totalMargin.toFixed(1)}%
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
                                    const hasFilters = combinedFilter.productName || combinedFilter.categories.length > 0 || combinedFilter.types.length > 0
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
                                    const key = `${sale.product_id}-${sale.country_code}`
                                    if (!acc[key]) {
                                      acc[key] = { ...sale, quantity: 0 }
                                    }
                                    acc[key].quantity += sale.quantity
                                    return acc
                                  }, {} as Record<string, typeof productSales[0]>))
                                  
                                  if (combinedFilter.productName && combinedFilter.productName.trim()) {
                                    const searchTerm = combinedFilter.productName.toLowerCase().trim()
                                    filteredCombinedSalesForPl = filteredCombinedSalesForPl.filter(sale => {
                                      return sale.product_name.toLowerCase().includes(searchTerm)
                                    })
                                  }
                                  if (combinedFilter.categories.length > 0) {
                                    filteredCombinedSalesForPl = filteredCombinedSalesForPl.filter(sale => {
                                      const category = sale.product_category || (sale.product_name ? getCategoryFromProductName(sale.product_name) : null)
                                      return category && combinedFilter.categories.includes(category)
                                    })
                                  }
                                  if (combinedFilter.types.length > 0) {
                                    filteredCombinedSalesForPl = filteredCombinedSalesForPl.filter(sale => {
                                      if (!sale.product_type) return false
                                      const types = sale.product_type.split(',').map(t => t.trim())
                                      return combinedFilter.types.some(selectedType => types.includes(selectedType))
                                    })
                                  }
                                  
                                  // Calcular P&L consolidado con las ventas filtradas
                                  let consolidatedPl = {
                                    grossSales: { amount: 0, pct: 100 },
                                    discount: { amount: 0, pct: 0 },
                                    salesRevenue: { amount: 0, pct: 0 },
                                    costRows: [] as Array<{ label: string; amount: number; pct: number; account?: string }>,
                                    totalCostOfSales: { amount: 0, pct: 0 },
                                    grossProfit: { amount: 0, pct: 0 }
                                  }
                                  
                                  // Inicializar costRows con todas las filas posibles
                                  const costRowLabels = [
                                    'Product Cost',
                                    'Kit Cost',
                                    'Payment Fee Costs',
                                    'Blood Drawn & Sample Handling',
                                    'Sanitary Permits to export blood',
                                    'External Courier',
                                    'Internal Courier',
                                    'Physicians Fees',
                                    'Sales Commission'
                                  ]
                                  
                                  costRowLabels.forEach(label => {
                                    consolidatedPl.costRows.push({
                                      label,
                                      amount: 0,
                                      pct: 0,
                                      account: undefined
                                    })
                                  })
                                  
                                  // Calcular para cada producto filtrado
                                  filteredCombinedSalesForPl.forEach(sale => {
                                    if (!sale.product_full) return
                                    
                                    const overrideKey = `${sale.product_id}-${sale.country_code}`
                                    const overrides = productOverrides[overrideKey] || {}
                                    
                                    try {
                                      const computed = computePricing(sale.product_full, sale.country_code, overrides)
                                      
                                      // Multiplicar cada valor por la cantidad vendida
                                      consolidatedPl.grossSales.amount += computed.grossSales.amount * sale.quantity
                                      consolidatedPl.discount.amount += computed.discount.amount * sale.quantity
                                      consolidatedPl.salesRevenue.amount += computed.salesRevenue.amount * sale.quantity
                                      
                                      // Sumar costRows
                                      computed.costRows.forEach((row, idx) => {
                                        if (consolidatedPl.costRows[idx]) {
                                          consolidatedPl.costRows[idx].amount += row.amount * sale.quantity
                                          consolidatedPl.costRows[idx].account = row.account
                                        }
                                      })
                                      
                                      consolidatedPl.totalCostOfSales.amount += computed.totalCostOfSales.amount * sale.quantity
                                      consolidatedPl.grossProfit.amount += computed.grossProfit.amount * sale.quantity
                                    } catch (e) {
                                      console.error('Error calculando P&L para producto:', sale.product_name, e)
                                    }
                                  })
                                  
                                  // Calcular porcentajes basados en el total de salesRevenue
                                  const totalSalesRevenue = consolidatedPl.salesRevenue.amount
                                  if (totalSalesRevenue > 0) {
                                    consolidatedPl.discount.pct = (Math.abs(consolidatedPl.discount.amount) / consolidatedPl.grossSales.amount) * 100
                                    consolidatedPl.salesRevenue.pct = (totalSalesRevenue / consolidatedPl.grossSales.amount) * 100
                                    
                                    consolidatedPl.costRows.forEach(row => {
                                      row.pct = (row.amount / totalSalesRevenue) * 100
                                    })
                                    
                                    consolidatedPl.totalCostOfSales.pct = (consolidatedPl.totalCostOfSales.amount / totalSalesRevenue) * 100
                                    consolidatedPl.grossProfit.pct = (consolidatedPl.grossProfit.amount / totalSalesRevenue) * 100
                                  }
                                  
                                  return (
                                    <div className="overflow-x-auto">
                                      <table className="w-full">
                                        <thead>
                                          <tr className="bg-gray-50 border-b border-gray-200">
                                            <th className="px-4 py-3 text-left text-sm font-semibold">Concepto</th>
                                            <th className="px-4 py-3 text-right text-sm font-semibold">
                                              <span className="inline-flex items-center gap-1">
                                                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                                                USD
                                              </span>
                                            </th>
                                            <th className="px-4 py-3 text-right text-sm font-semibold">
                                              <span className="inline-flex items-center gap-1">
                                                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                                                %
                                              </span>
                                            </th>
                                            <th className="px-4 py-3 text-right text-sm font-semibold">Cuenta</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {/* Gross Sales */}
                                          <tr className="border-b border-gray-100">
                                            <td className="px-4 py-3 text-left">Gross Sales (sin IVA)</td>
                                            <td className="px-4 py-3 text-right font-mono">{formatCurrency(consolidatedPl.grossSales.amount)}</td>
                                            <td className="px-4 py-3 text-right font-mono text-sm">{formatPercentage(consolidatedPl.grossSales.pct)}</td>
                                            <td className="px-4 py-3 text-right text-xs text-muted-foreground font-mono">-</td>
                                          </tr>
                                          
                                          {/* Commercial Discount */}
                                          <tr className="border-b border-gray-100">
                                            <td className="px-4 py-3 text-left">Commercial Discount</td>
                                            <td className="px-4 py-3 text-right font-mono">{formatCurrency(Math.abs(consolidatedPl.discount.amount))}</td>
                                            <td className="px-4 py-3 text-right font-mono text-sm">{formatPercentage(consolidatedPl.discount.pct)}</td>
                                            <td className="px-4 py-3 text-right text-xs text-muted-foreground font-mono">-</td>
                                          </tr>
                                          
                                          {/* Sales Revenue */}
                                          <tr className="border-b-2 border-gray-300 bg-gray-100 font-semibold">
                                            <td className="px-4 py-3 text-left">Sales Revenue</td>
                                            <td className="px-4 py-3 text-right font-mono">{formatCurrency(consolidatedPl.salesRevenue.amount)}</td>
                                            <td className="px-4 py-3 text-right font-mono text-sm">{formatPercentage(consolidatedPl.salesRevenue.pct)}</td>
                                            <td className="px-4 py-3 text-right text-xs text-muted-foreground font-mono">-</td>
                                          </tr>
                                          
                                          {/* Separador Cost of Sales */}
                                          <tr>
                                            <td colSpan={4} className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100">
                                              Cost of Sales
                                            </td>
                                          </tr>
                                          
                                          {/* Cost Rows */}
                                          {consolidatedPl.costRows.map((row, idx) => (
                                            <tr key={idx} className="border-b border-gray-100">
                                              <td className="px-4 py-3 text-left">{row.label}</td>
                                              <td className="px-4 py-3 text-right font-mono">{formatCurrency(row.amount)}</td>
                                              <td className="px-4 py-3 text-right font-mono text-sm">{formatPercentage(row.pct)}</td>
                                              <td className="px-4 py-3 text-right text-xs text-muted-foreground font-mono">{row.account || '-'}</td>
                                            </tr>
                                          ))}
                                          
                                          {/* Total Cost of Sales */}
                                          <tr className="border-t-2 border-gray-300 bg-gray-100 font-semibold">
                                            <td className="px-4 py-3 text-left">Total Cost of Sales</td>
                                            <td className="px-4 py-3 text-right font-mono">{formatCurrency(consolidatedPl.totalCostOfSales.amount)}</td>
                                            <td className="px-4 py-3 text-right font-mono text-sm">{formatPercentage(consolidatedPl.totalCostOfSales.pct)}</td>
                                            <td className="px-4 py-3 text-right text-xs text-muted-foreground font-mono">-</td>
                                          </tr>
                                          
                                          {/* Gross Profit */}
                                          <tr className="border-t-2 border-emerald-300 bg-emerald-50 font-semibold">
                                            <td className="px-4 py-3 text-left text-emerald-700">Gross Profit</td>
                                            <td className="px-4 py-3 text-right font-mono text-emerald-700 font-bold">{formatCurrency(consolidatedPl.grossProfit.amount)}</td>
                                            <td className="px-4 py-3 text-right font-mono text-sm text-emerald-600">{formatPercentage(consolidatedPl.grossProfit.pct)}</td>
                                            <td className="px-4 py-3 text-right text-xs text-muted-foreground font-mono">-</td>
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
                        const monthFilter = monthFilters[monthKey] || { categories: [], types: [], productName: '' }
                        
                        // Calcular total filtrado
                        let filteredMonthSales = monthData.sales
                        
                        // Filtro por nombre de producto
                        if (monthFilter.productName && monthFilter.productName.trim()) {
                          const searchTerm = monthFilter.productName.toLowerCase().trim()
                          filteredMonthSales = filteredMonthSales.filter(sale => {
                            return sale.product_name.toLowerCase().includes(searchTerm)
                          })
                        }
                        
                        if (monthFilter.categories.length > 0) {
                          filteredMonthSales = filteredMonthSales.filter(sale => {
                            const category = sale.product_category || (sale.product_name ? getCategoryFromProductName(sale.product_name) : null)
                            return category && monthFilter.categories.includes(category)
                          })
                        }
                        if (monthFilter.types.length > 0) {
                          filteredMonthSales = filteredMonthSales.filter(sale => {
                            if (!sale.product_type) return false
                            const types = sale.product_type.split(',').map(t => t.trim())
                            return monthFilter.types.some(selectedType => types.includes(selectedType))
                          })
                        }
                        const monthTotal = filteredMonthSales.reduce((sum, s) => sum + s.quantity, 0)
                        const isOpen = openMonths[monthKey] || false
                        
                        // Obtener todas las categorías y tipos únicos de este mes
                        const availableCategories = new Set<string>()
                        const availableTypes = new Set<string>()
                        monthData.sales.forEach(sale => {
                          const category = sale.product_category || (sale.product_name ? getCategoryFromProductName(sale.product_name) : null)
                          if (category) availableCategories.add(category)
                          if (sale.product_type) {
                            sale.product_type.split(',').forEach(t => availableTypes.add(t.trim()))
                          }
                        })
                        
                        const isSelected = selectedMonths.has(monthKey)
                        
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
                                        const newSet = new Set(prev)
                                        if (e.target.checked) {
                                          newSet.add(monthKey)
                                        } else {
                                          newSet.delete(monthKey)
                                        }
                                        return newSet
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
                                          <div className="fixed bg-white border border-gray-300 rounded-lg shadow-xl z-[100] p-3 min-w-[250px] max-w-[90vw]" style={{
                                            top: '50%',
                                            left: '50%',
                                            transform: 'translate(-50%, -50%)'
                                          }}>
                                          <div className="space-y-2">
                                            <label className="text-xs font-semibold block text-gray-700">Buscar producto:</label>
                                            <input
                                              type="text"
                                              value={monthFilters[monthKey]?.productName || ''}
                                              onChange={(e) => {
                                                const currentFilter = monthFilters[monthKey] || { categories: [], types: [], productName: '' }
                                                setMonthFilters(prev => ({
                                                  ...prev,
                                                  [monthKey]: {
                                                    ...currentFilter,
                                                    productName: e.target.value
                                                  }
                                                }))
                                              }}
                                              placeholder="Escribe el nombre..."
                                              className="w-full text-xs px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                              autoFocus
                                            />
                                            {monthFilters[monthKey]?.productName && (
                                              <button
                                                onClick={() => {
                                                  const currentFilter = monthFilters[monthKey] || { categories: [], types: [], productName: '' }
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
                                    <div className="relative filter-dropdown-container">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          setFilterDialogOpen(prev => ({ ...prev, [monthKey]: !prev[monthKey] }))
                                        }}
                                        className="flex items-center gap-1 hover:text-blue-600 transition-colors"
                                      >
                                        Etiquetas
                                        <Filter className="w-3 h-3" />
                                        {(monthFilters[monthKey]?.categories.length > 0 || monthFilters[monthKey]?.types.length > 0) && (
                                          <span className="ml-1 text-xs bg-blue-500 text-white rounded-full px-1.5 py-0.5">
                                            {(monthFilters[monthKey]?.categories.length || 0) + (monthFilters[monthKey]?.types.length || 0)}
                                          </span>
                                        )}
                                      </button>
                                      
                                      {filterDialogOpen[monthKey] && (
                                        <>
                                          {/* Overlay para cerrar al hacer click fuera */}
                                          <div 
                                            className="fixed inset-0 z-[99] bg-black/20"
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              setFilterDialogOpen(prev => ({ ...prev, [monthKey]: false }))
                                            }}
                                          />
                                          <div className="fixed bg-white border border-gray-300 rounded-lg shadow-xl z-[100] p-4 min-w-[600px] max-h-[80vh] overflow-y-auto" style={{
                                            top: '50%',
                                            left: '50%',
                                            transform: 'translate(-50%, -50%)',
                                            maxWidth: '90vw'
                                          }}>
                                          <div className="flex gap-4">
                                            {/* Categorías */}
                                            <div className="flex-1">
                                              <label className="text-xs font-semibold mb-2 block text-gray-700">Categorías:</label>
                                              <div className="space-y-1 max-h-[320px] overflow-y-auto">
                                                {getCategoryNames().filter(cat => cat !== 'Todos' && availableCategories.has(cat)).map((category) => (
                                                  <label key={category} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded text-xs">
                                                    <input
                                                      type="checkbox"
                                                      checked={(monthFilters[monthKey]?.categories || []).includes(category)}
                                                      onChange={(e) => {
                                                        const currentFilter = monthFilters[monthKey] || { categories: [], types: [], productName: '' }
                                                        const newCategories = e.target.checked
                                                          ? [...currentFilter.categories, category]
                                                          : currentFilter.categories.filter(c => c !== category)
                                                        setMonthFilters(prev => ({
                                                          ...prev,
                                                          [monthKey]: {
                                                            ...currentFilter,
                                                            categories: newCategories,
                                                            types: currentFilter.types
                                                          }
                                                        }))
                                                      }}
                                                      className="rounded"
                                                    />
                                                    <span>{category}</span>
                                                  </label>
                                                ))}
                                              </div>
                                            </div>
                                            
                                            {/* Tipos */}
                                            <div className="flex-1">
                                              <label className="text-xs font-semibold mb-2 block text-gray-700">Tipos:</label>
                                              <div className="space-y-1 max-h-[320px] overflow-y-auto">
                                                {Array.from(availableTypes).sort().map((type) => (
                                                  <label key={type} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded text-xs">
                                                    <input
                                                      type="checkbox"
                                                      checked={(monthFilters[monthKey]?.types || []).includes(type)}
                                                      onChange={(e) => {
                                                        const currentFilter = monthFilters[monthKey] || { categories: [], types: [], productName: '' }
                                                        const newTypes = e.target.checked
                                                          ? [...currentFilter.types, type]
                                                          : currentFilter.types.filter(t => t !== type)
                                                        setMonthFilters(prev => ({
                                                          ...prev,
                                                          [monthKey]: {
                                                            ...currentFilter,
                                                            categories: currentFilter.categories,
                                                            types: newTypes
                                                          }
                                                        }))
                                                      }}
                                                      className="rounded"
                                                    />
                                                    <span>{type}</span>
                                                  </label>
                                                ))}
                                              </div>
                                            </div>
                                          </div>
                                          
                                          {/* Botón limpiar filtros */}
                                          {((monthFilters[monthKey]?.categories?.length || 0) > 0 || (monthFilters[monthKey]?.types?.length || 0) > 0) && (
                                              <button
                                                onClick={() => {
                                                  setMonthFilters(prev => ({
                                                    ...prev,
                                                    [monthKey]: { categories: [], types: [], productName: '' }
                                                  }))
                                                }}
                                                className="w-full mt-3 text-xs px-2 py-1 border border-gray-300 rounded hover:bg-gray-50 transition-colors flex items-center justify-center gap-1"
                                              >
                                                <X className="w-3 h-3" />
                                                Limpiar filtros
                                              </button>
                                          )}
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  </th>
                                  <th className="text-right py-1 px-2 font-semibold text-gray-700">Cantidad</th>
                                  <th className="text-right py-1 px-2 font-semibold text-gray-700">Gross Sale</th>
                                  <th className="text-right py-1 px-2 font-semibold text-gray-700">Gross Profit</th>
                                  <th className="text-right py-1 px-2 font-semibold text-gray-700">Margen</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(() => {
                                  // Filtrar ventas del mes según las etiquetas seleccionadas y nombre de producto
                                  const monthFilter = monthFilters[monthKey] || { categories: [], types: [], productName: '' }
                                  let filteredMonthSales = monthData.sales
                                  
                                  // Filtro por nombre de producto
                                  if (monthFilter.productName && monthFilter.productName.trim()) {
                                    const searchTerm = monthFilter.productName.toLowerCase().trim()
                                    filteredMonthSales = filteredMonthSales.filter(sale => {
                                      return sale.product_name.toLowerCase().includes(searchTerm)
                                    })
                                  }
                                  
                                  // Filtro por categorías
                                  if (monthFilter.categories.length > 0) {
                                    filteredMonthSales = filteredMonthSales.filter(sale => {
                                      const category = sale.product_category || (sale.product_name ? getCategoryFromProductName(sale.product_name) : null)
                                      return category && monthFilter.categories.includes(category)
                                    })
                                  }
                                  
                                  // Filtro por tipos
                                  if (monthFilter.types.length > 0) {
                                    filteredMonthSales = filteredMonthSales.filter(sale => {
                                      if (!sale.product_type) return false
                                      const types = sale.product_type.split(',').map(t => t.trim())
                                      return monthFilter.types.some(selectedType => types.includes(selectedType))
                                    })
                                  }
                                  
                                  return filteredMonthSales.map((sale, idx): JSX.Element => {
                                    // Calcular gross sales y gross profit usando computePricing
                                    let grossSalesAmount = 0
                                    let grossProfitAmount = 0
                                    let margin = 0
                                    
                                    if (sale.product_full) {
                                      const overrideKey = `${sale.product_id}-${sale.country_code}`
                                      const overrides = productOverrides[overrideKey] || {}
                                      
                                      try {
                                        const computed = computePricing(
                                          sale.product_full,
                                          sale.country_code,
                                          overrides
                                        )
                                        // Multiplicar por la cantidad, usar valor absoluto para grossProfit
                                        grossSalesAmount = computed.grossSales.amount * sale.quantity
                                        grossProfitAmount = Math.abs(computed.grossProfit.amount) * sale.quantity
                                        margin = computed.grossProfit.pct || 0
                                      } catch (e) {
                                        console.error('Error calculando precios:', e)
                                        // Fallback al precio base
                                        grossSalesAmount = sale.product_price * sale.quantity
                                        grossProfitAmount = Math.abs(sale.product_price) * sale.quantity
                                        margin = 0
                                      }
                                    } else {
                                      // Fallback si no hay producto completo
                                      grossSalesAmount = sale.product_price * sale.quantity
                                      grossProfitAmount = Math.abs(sale.product_price) * sale.quantity
                                      margin = 0
                                    }

                                    // Verificar si el gross sale es 10 USD
                                    const isOutdatedPrice = sale.product_full && (() => {
                                      try {
                                        const overrideKey = `${sale.product_id}-${sale.country_code}`
                                        const overrides = productOverrides[overrideKey] || {}
                                        const computed = computePricing(sale.product_full, sale.country_code, overrides)
                                        return computed.grossSales.amount === 10
                                      } catch (e) {
                                        return false
                                      }
                                    })()

                                    // Crear una clave única para esta fila específica
                                    const rowKey = `${monthKey}-${sale.id || sale.product_id}-${sale.country_code}-${idx}`

                                    return (
                                      <tr key={`${monthKey}-${sale.id || sale.product_id}-${idx}`} className="border-b border-gray-100 hover:bg-gray-50 last:border-b-0">
                                      <td className="py-1 px-2 text-gray-900">
                                        <div className="flex items-center gap-2">
                                          <Link 
                                            href={`/products/${sale.product_id}?country=${sale.country_code}`}
                                            className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                                          >
                                            {sale.product_name}
                                          </Link>
                                          {isOutdatedPrice && (
                                            <div className="relative group">
                                              <AlertCircle className="w-4 h-4 text-red-500" />
                                              <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block z-10 bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                                                Precio desactualizado
                                                <div className="absolute left-2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      </td>
                                      <td className="py-1 px-2">
                                        <div className="flex items-center gap-1 flex-wrap">
                                          <CategoryBadge 
                                            category={sale.product_category} 
                                            productName={sale.product_name} 
                                            size="sm" 
                                          />
                                          <TypeBadge 
                                            type={sale.product_type} 
                                            size="sm" 
                                          />
                                        </div>
                                      </td>
                                      <td className="py-1 px-2 text-right">
                                        {editingQuantity === rowKey ? (
                                          <div className="flex items-center justify-end gap-2">
                                            <input
                                              ref={(el) => {
                                                if (el) {
                                                  editInputRefs.current[rowKey] = el
                                                }
                                              }}
                                              type="number"
                                              min="0"
                                              value={quantityEditValue}
                                              data-edit-id={rowKey}
                                              onChange={(e) => setQuantityEditValue(e.target.value)}
                                              onBlur={async () => {
                                                const newQty = parseInt(quantityEditValue) || 0
                                                if (sale.id && newQty !== sale.quantity && newQty >= 0) {
                                                  await handleUpdateQuantity(sale.id, newQty)
                                                }
                                                setEditingQuantity(null)
                                                setQuantityEditValue('')
                                              }}
                                              onKeyDown={async (e) => {
                                                if (e.key === 'Enter') {
                                                  e.preventDefault()
                                                  const newQty = parseInt(quantityEditValue) || 0
                                                  if (sale.id && newQty !== sale.quantity && newQty >= 0) {
                                                    await handleUpdateQuantity(sale.id, newQty)
                                                  }
                                                  setEditingQuantity(null)
                                                  setQuantityEditValue('')
                                                } else if (e.key === 'Escape') {
                                                  e.preventDefault()
                                                  setEditingQuantity(null)
                                                  setQuantityEditValue('')
                                                }
                                              }}
                                              onClick={(e) => e.stopPropagation()}
                                              onFocus={(e) => {
                                                e.target.select()
                                              }}
                                              className="w-20 px-2 py-1 border border-blue-300 rounded text-right font-semibold text-blue-600"
                                            />
                                          </div>
                                        ) : (
                                          <div className="flex items-center justify-end gap-1">
                                            <span className="font-semibold text-blue-600">
                                              {sale.quantity.toLocaleString()}
                                            </span>
                                            {sale.id && (
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation()
                                                  e.preventDefault()
                                                  e.nativeEvent.stopImmediatePropagation()
                                                  setEditingQuantity(rowKey)
                                                  setQuantityEditValue(sale.quantity.toString())
                                                }}
                                                onMouseDown={(e) => {
                                                  e.preventDefault()
                                                  e.stopPropagation()
                                                }}
                                                className="p-1 hover:bg-blue-50 rounded text-blue-600 transition-colors"
                                                title="Editar cantidad"
                                                type="button"
                                              >
                                                <Edit2 className="w-3 h-3" />
                                              </button>
                                            )}
                                          </div>
                                        )}
                                      </td>
                                      <td className="py-1 px-2 text-right">
                                        <span className="font-semibold text-green-600">
                                          {formatCurrency(grossSalesAmount)}
                                        </span>
                                      </td>
                                      <td className="py-1 px-2 text-right">
                                        <span className="font-semibold text-purple-600">
                                          {formatCurrency(grossProfitAmount)}
                                        </span>
                                      </td>
                                      <td className="py-1 px-2 text-right">
                                        <span className="font-semibold text-orange-600">
                                          {margin.toFixed(1)}%
                                        </span>
                                      </td>
                                    </tr>
                                  )
                                })
                              })()}
                              </tbody>
                              <tfoot>
                                    {(() => {
                                      const monthFilter = monthFilters[monthKey] || { categories: [], types: [], productName: '' }
                                      let filteredMonthSales = monthData.sales
                                      
                                      // Filtro por nombre de producto
                                      if (monthFilter.productName && monthFilter.productName.trim()) {
                                        const searchTerm = monthFilter.productName.toLowerCase().trim()
                                        filteredMonthSales = filteredMonthSales.filter(sale => {
                                          return sale.product_name.toLowerCase().includes(searchTerm)
                                        })
                                      }
                                      
                                      if (monthFilter.categories.length > 0) {
                                        filteredMonthSales = filteredMonthSales.filter(sale => {
                                          const category = sale.product_category || (sale.product_name ? getCategoryFromProductName(sale.product_name) : null)
                                          return category && monthFilter.categories.includes(category)
                                        })
                                      }
                                      
                                      if (monthFilter.types.length > 0) {
                                        filteredMonthSales = filteredMonthSales.filter(sale => {
                                          if (!sale.product_type) return false
                                          const types = sale.product_type.split(',').map(t => t.trim())
                                          return monthFilter.types.some(selectedType => types.includes(selectedType))
                                        })
                                      }
                                      
                                  const totalQuantity = filteredMonthSales.reduce((sum, s) => sum + s.quantity, 0)
                                  const totalGrossSales = filteredMonthSales.reduce((sum, s) => {
                                          if (s.product_full) {
                                            const overrideKey = `${s.product_id}-${s.country_code}`
                                            const overrides = productOverrides[overrideKey] || {}
                                            try {
                                              const computed = computePricing(s.product_full, s.country_code, overrides)
                                              return sum + (computed.grossSales.amount * s.quantity)
                                            } catch (e) {
                                              return sum + (s.product_price * s.quantity)
                                            }
                                          }
                                          return sum + (s.product_price * s.quantity)
                                        }, 0)
                                  const totalGrossProfit = filteredMonthSales.reduce((sum, s) => {
                                          if (s.product_full) {
                                            const overrideKey = `${s.product_id}-${s.country_code}`
                                            const overrides = productOverrides[overrideKey] || {}
                                            try {
                                              const computed = computePricing(s.product_full, s.country_code, overrides)
                                              return sum + (Math.abs(computed.grossProfit.amount) * s.quantity)
                                            } catch (e) {
                                              return sum + (Math.abs(s.product_price) * s.quantity)
                                            }
                                          }
                                          return sum + (Math.abs(s.product_price) * s.quantity)
                                        }, 0)
                                  const totalMargin = totalGrossSales > 0 
                                    ? (totalGrossProfit / totalGrossSales * 100)
                                    : 0

                                  return (
                                    <tr className="bg-gray-100 font-semibold border-t-2 border-gray-300">
                                      <td colSpan={2} className="py-1 px-2 text-gray-900">Total</td>
                                      <td className="py-1 px-2 text-right text-blue-600">
                                        {totalQuantity.toLocaleString()}
                                      </td>
                                      <td className="py-1 px-2 text-right text-green-600">
                                        {formatCurrency(totalGrossSales)}
                                      </td>
                                      <td className="py-1 px-2 text-right text-purple-600">
                                        {formatCurrency(totalGrossProfit)}
                                      </td>
                                      <td className="py-1 px-2 text-right text-orange-600">
                                        {totalMargin.toFixed(1)}%
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
                                      const monthFilter = monthFilters[monthKey] || { categories: [], types: [], productName: '' }
                                      const hasFilters = monthFilter.productName || monthFilter.categories.length > 0 || monthFilter.types.length > 0
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
                                    const monthFilter = monthFilters[monthKey] || { categories: [], types: [], productName: '' }
                                    let filteredMonthSales = monthData.sales
                                    
                                    // Filtro por nombre de producto
                                    if (monthFilter.productName && monthFilter.productName.trim()) {
                                      const searchTerm = monthFilter.productName.toLowerCase().trim()
                                      filteredMonthSales = filteredMonthSales.filter(sale => {
                                        return sale.product_name.toLowerCase().includes(searchTerm)
                                      })
                                    }
                                    
                                    // Filtro por categorías
                                    if (monthFilter.categories.length > 0) {
                                      filteredMonthSales = filteredMonthSales.filter(sale => {
                                        const category = sale.product_category || (sale.product_name ? getCategoryFromProductName(sale.product_name) : null)
                                        return category && monthFilter.categories.includes(category)
                                      })
                                    }
                                    
                                    // Filtro por tipos
                                    if (monthFilter.types.length > 0) {
                                      filteredMonthSales = filteredMonthSales.filter(sale => {
                                        if (!sale.product_type) return false
                                        const types = sale.product_type.split(',').map(t => t.trim())
                                        return monthFilter.types.some(selectedType => types.includes(selectedType))
                                      })
                                    }
                                    
                                    // Calcular P&L consolidado con las ventas filtradas
                                    let consolidatedPl = {
                                      grossSales: { amount: 0, pct: 100 },
                                      discount: { amount: 0, pct: 0 },
                                      salesRevenue: { amount: 0, pct: 0 },
                                      costRows: [] as Array<{ label: string; amount: number; pct: number; account?: string }>,
                                      totalCostOfSales: { amount: 0, pct: 0 },
                                      grossProfit: { amount: 0, pct: 0 }
                                    }
                                    
                                    // Inicializar costRows con todas las filas posibles
                                    const costRowLabels = [
                                      'Product Cost',
                                      'Kit Cost',
                                      'Payment Fee Costs',
                                      'Blood Drawn & Sample Handling',
                                      'Sanitary Permits to export blood',
                                      'External Courier',
                                      'Internal Courier',
                                      'Physicians Fees',
                                      'Sales Commission'
                                    ]
                                    
                                    costRowLabels.forEach(label => {
                                      consolidatedPl.costRows.push({
                                        label,
                                        amount: 0,
                                        pct: 0,
                                        account: undefined
                                      })
                                    })
                                    
                                    // Calcular para cada producto filtrado del mes
                                    filteredMonthSales.forEach(sale => {
                                      if (!sale.product_full) return
                                      
                                      const overrideKey = `${sale.product_id}-${sale.country_code}`
                                      const overrides = productOverrides[overrideKey] || {}
                                      
                                      try {
                                        const computed = computePricing(sale.product_full, sale.country_code, overrides)
                                        
                                        // Multiplicar cada valor por la cantidad vendida
                                        consolidatedPl.grossSales.amount += computed.grossSales.amount * sale.quantity
                                        consolidatedPl.discount.amount += computed.discount.amount * sale.quantity
                                        consolidatedPl.salesRevenue.amount += computed.salesRevenue.amount * sale.quantity
                                        
                                        // Sumar costRows
                                        computed.costRows.forEach((row, idx) => {
                                          if (consolidatedPl.costRows[idx]) {
                                            consolidatedPl.costRows[idx].amount += row.amount * sale.quantity
                                            consolidatedPl.costRows[idx].account = row.account
                                          }
                                        })
                                        
                                        consolidatedPl.totalCostOfSales.amount += computed.totalCostOfSales.amount * sale.quantity
                                        consolidatedPl.grossProfit.amount += computed.grossProfit.amount * sale.quantity
                                      } catch (e) {
                                        console.error('Error calculando P&L para producto:', sale.product_name, e)
                                      }
                                    })
                                    
                                    // Calcular porcentajes basados en el total de salesRevenue
                                    const totalSalesRevenue = consolidatedPl.salesRevenue.amount
                                    if (totalSalesRevenue > 0) {
                                      consolidatedPl.discount.pct = (Math.abs(consolidatedPl.discount.amount) / consolidatedPl.grossSales.amount) * 100
                                      consolidatedPl.salesRevenue.pct = (totalSalesRevenue / consolidatedPl.grossSales.amount) * 100
                                      
                                      consolidatedPl.costRows.forEach(row => {
                                        row.pct = (row.amount / totalSalesRevenue) * 100
                                      })
                                      
                                      consolidatedPl.totalCostOfSales.pct = (consolidatedPl.totalCostOfSales.amount / totalSalesRevenue) * 100
                                      consolidatedPl.grossProfit.pct = (consolidatedPl.grossProfit.amount / totalSalesRevenue) * 100
                                    }
                                    
                                    return (
                                      <div className="overflow-x-auto">
                                        <table className="w-full">
                                          <thead>
                                            <tr className="bg-gray-50 border-b border-gray-200">
                                              <th className="px-4 py-3 text-left text-sm font-semibold">Concepto</th>
                                              <th className="px-4 py-3 text-right text-sm font-semibold">
                                                <span className="inline-flex items-center gap-1">
                                                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                                                  USD
                                                </span>
                                              </th>
                                              <th className="px-4 py-3 text-right text-sm font-semibold">
                                                <span className="inline-flex items-center gap-1">
                                                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                                                  %
                                                </span>
                                              </th>
                                              <th className="px-4 py-3 text-right text-sm font-semibold">Cuenta</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {/* Gross Sales */}
                                            <tr className="border-b border-gray-100">
                                              <td className="px-4 py-3 text-left">Gross Sales (sin IVA)</td>
                                              <td className="px-4 py-3 text-right font-mono">{formatCurrency(consolidatedPl.grossSales.amount)}</td>
                                              <td className="px-4 py-3 text-right font-mono text-sm">{formatPercentage(consolidatedPl.grossSales.pct)}</td>
                                              <td className="px-4 py-3 text-right text-xs text-muted-foreground font-mono">-</td>
                                            </tr>
                                            
                                            {/* Commercial Discount */}
                                            <tr className="border-b border-gray-100">
                                              <td className="px-4 py-3 text-left">Commercial Discount</td>
                                              <td className="px-4 py-3 text-right font-mono">{formatCurrency(Math.abs(consolidatedPl.discount.amount))}</td>
                                              <td className="px-4 py-3 text-right font-mono text-sm">{formatPercentage(consolidatedPl.discount.pct)}</td>
                                              <td className="px-4 py-3 text-right text-xs text-muted-foreground font-mono">-</td>
                                            </tr>
                                            
                                            {/* Sales Revenue */}
                                            <tr className="border-b-2 border-gray-300 bg-gray-100 font-semibold">
                                              <td className="px-4 py-3 text-left">Sales Revenue</td>
                                              <td className="px-4 py-3 text-right font-mono">{formatCurrency(consolidatedPl.salesRevenue.amount)}</td>
                                              <td className="px-4 py-3 text-right font-mono text-sm">{formatPercentage(consolidatedPl.salesRevenue.pct)}</td>
                                              <td className="px-4 py-3 text-right text-xs text-muted-foreground font-mono">-</td>
                                            </tr>
                                            
                                            {/* Separador Cost of Sales */}
                                            <tr>
                                              <td colSpan={4} className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100">
                                                Cost of Sales
                                              </td>
                                            </tr>
                                            
                                            {/* Cost Rows */}
                                            {consolidatedPl.costRows.map((row, idx) => (
                                              <tr key={idx} className="border-b border-gray-100">
                                                <td className="px-4 py-3 text-left">{row.label}</td>
                                                <td className="px-4 py-3 text-right font-mono">{formatCurrency(row.amount)}</td>
                                                <td className="px-4 py-3 text-right font-mono text-sm">{formatPercentage(row.pct)}</td>
                                                <td className="px-4 py-3 text-right text-xs text-muted-foreground font-mono">{row.account || '-'}</td>
                                              </tr>
                                            ))}
                                            
                                            {/* Total Cost of Sales */}
                                            <tr className="border-t-2 border-gray-300 bg-gray-100 font-semibold">
                                              <td className="px-4 py-3 text-left">Total Cost of Sales</td>
                                              <td className="px-4 py-3 text-right font-mono">{formatCurrency(consolidatedPl.totalCostOfSales.amount)}</td>
                                              <td className="px-4 py-3 text-right font-mono text-sm">{formatPercentage(consolidatedPl.totalCostOfSales.pct)}</td>
                                              <td className="px-4 py-3 text-right text-xs text-muted-foreground font-mono">-</td>
                                            </tr>
                                            
                                            {/* Gross Profit */}
                                            <tr className="border-t-2 border-emerald-300 bg-emerald-50 font-semibold">
                                              <td className="px-4 py-3 text-left text-emerald-700">Gross Profit</td>
                                              <td className="px-4 py-3 text-right font-mono text-emerald-700 font-bold">{formatCurrency(consolidatedPl.grossProfit.amount)}</td>
                                              <td className="px-4 py-3 text-right font-mono text-sm text-emerald-600">{formatPercentage(consolidatedPl.grossProfit.pct)}</td>
                                              <td className="px-4 py-3 text-right text-xs text-muted-foreground font-mono">-</td>
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
                          const key = `${sale.product_id}-${sale.country_code}`
                          if (!acc[key]) {
                            acc[key] = {
                              ...sale,
                              quantity: 0
                            }
                          }
                          acc[key].quantity += sale.quantity
                          return acc
                        }, {} as Record<string, typeof productSales[0]>)

                        const annualProducts = Object.values(annualByProduct).sort((a, b) => 
                          a.product_name.localeCompare(b.product_name)
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
                                  (Total: {annualProducts.reduce((sum, p) => sum + p.quantity, 0).toLocaleString()})
                                </span>
                              </h3>
                            </div>
                            {isYearOpen && (
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="bg-gray-50 border-b border-gray-200">
                                  <th className="text-left py-1 px-2 font-semibold text-gray-700">Producto</th>
                                  <th className="text-left py-1 px-2 font-semibold text-gray-700">Etiquetas</th>
                                  <th className="text-right py-1 px-2 font-semibold text-gray-700">Cantidad</th>
                                  <th className="text-right py-1 px-2 font-semibold text-gray-700">Gross Sale</th>
                                  <th className="text-right py-1 px-2 font-semibold text-gray-700">Gross Profit</th>
                                  <th className="text-right py-1 px-2 font-semibold text-gray-700">Margen</th>
                                </tr>
                              </thead>
                              <tbody>
                                {annualProducts.map((sale, idx) => {
                                  // Calcular gross sales y gross profit usando computePricing
                                  let grossSalesAmount = 0
                                  let grossProfitAmount = 0
                                  let margin = 0
                                  
                                  if (sale.product_full) {
                                    const overrideKey = `${sale.product_id}-${sale.country_code}`
                                    const overrides = productOverrides[overrideKey] || {}
                                    
                                    try {
                                      const computed = computePricing(
                                        sale.product_full,
                                        sale.country_code,
                                        overrides
                                      )
                                      // Multiplicar por la cantidad total del año
                                      grossSalesAmount = computed.grossSales.amount * sale.quantity
                                      grossProfitAmount = Math.abs(computed.grossProfit.amount) * sale.quantity
                                      margin = computed.grossProfit.pct || 0
                                    } catch (e) {
                                      console.error('Error calculando precios:', e)
                                      grossSalesAmount = sale.product_price * sale.quantity
                                      grossProfitAmount = Math.abs(sale.product_price) * sale.quantity
                                      margin = 0
                                    }
                                  } else {
                                    grossSalesAmount = sale.product_price * sale.quantity
                                    grossProfitAmount = Math.abs(sale.product_price) * sale.quantity
                                    margin = 0
                                  }

                                  // Verificar si el gross sale es 10 USD
                                  const isOutdatedPrice = sale.product_full && (() => {
                                    try {
                                      const overrideKey = `${sale.product_id}-${sale.country_code}`
                                      const overrides = productOverrides[overrideKey] || {}
                                      const computed = computePricing(sale.product_full, sale.country_code, overrides)
                                      return computed.grossSales.amount === 10
                                    } catch (e) {
                                      return false
                                    }
                                  })()

                                  // Crear una clave única para esta fila específica
                                  const rowKey = `${yearKey}-${sale.id || sale.product_id}-${sale.country_code}-${idx}`

                                  return (
                                    <tr key={`annual-${yearData.year}-${sale.product_id}-${idx}`} className="border-b border-gray-100 hover:bg-gray-50 last:border-b-0">
                                      <td className="py-1 px-2 text-gray-900">
                                        <div className="flex items-center gap-2">
                                          <Link 
                                            href={`/products/${sale.product_id}?country=${sale.country_code}`}
                                            className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                                          >
                                            {sale.product_name}
                                          </Link>
                                          {isOutdatedPrice && (
                                            <div className="relative group">
                                              <AlertCircle className="w-4 h-4 text-red-500" />
                                              <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block z-10 bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                                                Precio desactualizado
                                                <div className="absolute left-2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      </td>
                                      <td className="py-1 px-2">
                                        <div className="flex items-center gap-1 flex-wrap">
                                          <CategoryBadge 
                                            category={sale.product_category} 
                                            productName={sale.product_name} 
                                            size="sm" 
                                          />
                                          <TypeBadge 
                                            type={sale.product_type} 
                                            size="sm" 
                                          />
                                        </div>
                                      </td>
                                      <td className="py-1 px-2 text-right">
                                        {editingQuantity === rowKey ? (
                                          <div className="flex items-center justify-end gap-2">
                                            <input
                                              ref={(el) => {
                                                if (el) {
                                                  editInputRefs.current[rowKey] = el
                                                }
                                              }}
                                              type="number"
                                              min="0"
                                              value={quantityEditValue}
                                              data-edit-id={rowKey}
                                              onChange={(e) => setQuantityEditValue(e.target.value)}
                                              onBlur={async () => {
                                                const newQty = parseInt(quantityEditValue) || 0
                                                if (sale.id && newQty !== sale.quantity && newQty >= 0) {
                                                  await handleUpdateQuantity(sale.id, newQty)
                                                }
                                                setEditingQuantity(null)
                                                setQuantityEditValue('')
                                              }}
                                              onKeyDown={async (e) => {
                                                if (e.key === 'Enter') {
                                                  e.preventDefault()
                                                  const newQty = parseInt(quantityEditValue) || 0
                                                  if (sale.id && newQty !== sale.quantity && newQty >= 0) {
                                                    await handleUpdateQuantity(sale.id, newQty)
                                                  }
                                                  setEditingQuantity(null)
                                                  setQuantityEditValue('')
                                                } else if (e.key === 'Escape') {
                                                  e.preventDefault()
                                                  setEditingQuantity(null)
                                                  setQuantityEditValue('')
                                                }
                                              }}
                                              onClick={(e) => e.stopPropagation()}
                                              onFocus={(e) => {
                                                e.target.select()
                                              }}
                                              className="w-20 px-2 py-1 border border-blue-300 rounded text-right font-semibold text-blue-600"
                                            />
                                          </div>
                                        ) : (
                                          <div className="flex items-center justify-end gap-1">
                                            <span className="font-semibold text-blue-600">
                                              {sale.quantity.toLocaleString()}
                                            </span>
                                            {sale.id && (
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation()
                                                  e.preventDefault()
                                                  e.nativeEvent.stopImmediatePropagation()
                                                  setEditingQuantity(rowKey)
                                                  setQuantityEditValue(sale.quantity.toString())
                                                }}
                                                onMouseDown={(e) => {
                                                  e.preventDefault()
                                                  e.stopPropagation()
                                                }}
                                                className="p-1 hover:bg-blue-50 rounded text-blue-600 transition-colors"
                                                title="Editar cantidad"
                                                type="button"
                                              >
                                                <Edit2 className="w-3 h-3" />
                                              </button>
                                            )}
                                          </div>
                                        )}
                                      </td>
                                      <td className="py-1 px-2 text-right">
                                        <span className="font-semibold text-green-600">
                                          {formatCurrency(grossSalesAmount)}
                                        </span>
                                      </td>
                                      <td className="py-1 px-2 text-right">
                                        <span className="font-semibold text-purple-600">
                                          {formatCurrency(grossProfitAmount)}
                                        </span>
                                      </td>
                                      <td className="py-1 px-2 text-right">
                                        <span className="font-semibold text-orange-600">
                                          {margin.toFixed(1)}%
                                        </span>
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                              <tfoot>
                                {(() => {
                                  const totalQuantity = annualProducts.reduce((sum, p) => sum + p.quantity, 0)
                                  const totalGrossSales = annualProducts.reduce((sum, s) => {
                                    if (s.product_full) {
                                      const overrideKey = `${s.product_id}-${s.country_code}`
                                      const overrides = productOverrides[overrideKey] || {}
                                      try {
                                        const computed = computePricing(s.product_full, s.country_code, overrides)
                                        return sum + (computed.grossSales.amount * s.quantity)
                                      } catch (e) {
                                        return sum + (s.product_price * s.quantity)
                                      }
                                    }
                                    return sum + (s.product_price * s.quantity)
                                  }, 0)
                                  const totalGrossProfit = annualProducts.reduce((sum, s) => {
                                    if (s.product_full) {
                                      const overrideKey = `${s.product_id}-${s.country_code}`
                                      const overrides = productOverrides[overrideKey] || {}
                                      try {
                                        const computed = computePricing(s.product_full, s.country_code, overrides)
                                        return sum + (Math.abs(computed.grossProfit.amount) * s.quantity)
                                      } catch (e) {
                                        return sum + (Math.abs(s.product_price) * s.quantity)
                                      }
                                    }
                                    return sum + (Math.abs(s.product_price) * s.quantity)
                                  }, 0)
                                  const totalMargin = totalGrossSales > 0 
                                    ? (totalGrossProfit / totalGrossSales * 100)
                                    : 0

                                  return (
                                    <tr className="bg-blue-100 font-semibold border-t-2 border-gray-300">
                                      <td colSpan={2} className="py-1 px-2 text-gray-900">Total Anual {yearData.year}</td>
                                      <td className="py-1 px-2 text-right text-blue-600">
                                        {totalQuantity.toLocaleString()}
                                      </td>
                                      <td className="py-1 px-2 text-right text-green-600">
                                        {formatCurrency(totalGrossSales)}
                                      </td>
                                      <td className="py-1 px-2 text-right text-purple-600">
                                        {formatCurrency(totalGrossProfit)}
                                      </td>
                                      <td className="py-1 px-2 text-right text-orange-600">
                                        {totalMargin.toFixed(1)}%
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
                <p className="text-sm mt-1">Importa un archivo Excel para comenzar</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

