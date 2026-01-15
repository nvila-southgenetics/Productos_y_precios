/**
 * Funciones para interactuar con Supabase
 * Usa el cliente de Supabase normal para producción
 */

import { supabase } from './supabase'

export interface Product {
  id: string
  name: string
  sku: string
  description: string | null
  category: string | null
  tipo: string | null
  created_at: string
  user_id: string
}

export interface ProductCountryOverride {
  id: string
  product_id: string
  country_code: 'UY' | 'AR' | 'MX' | 'CL' | 'VE' | 'CO'
  overrides: {
    grossSalesUSD?: number
    commercialDiscountUSD?: number
    commercialDiscountPct?: number
    productCostUSD?: number
    productCostPct?: number
    kitCostUSD?: number
    kitCostPct?: number
    paymentFeeUSD?: number
    paymentFeePct?: number
    bloodDrawSampleUSD?: number
    bloodDrawSamplePct?: number
    sanitaryPermitsUSD?: number
    sanitaryPermitsPct?: number
    externalCourierUSD?: number
    externalCourierPct?: number
    internalCourierUSD?: number
    internalCourierPct?: number
    physiciansFeesUSD?: number
    physiciansFeesPct?: number
    salesCommissionUSD?: number
    salesCommissionPct?: number
  }
  created_at: string
  updated_at: string
}

export interface ProductWithOverrides extends Product {
  country_overrides?: ProductCountryOverride[]
}

export interface MonthlySales {
  producto: string
  mes: number
  año: number
  periodo: string
  compañia: string
  cantidad_ventas: number
  monto_total: number | null
  precio_promedio: number | null
}

export interface MonthlySalesWithProduct extends MonthlySales {
  product_id?: string
  category?: string | null
  tipo?: string | null
  overrides?: ProductCountryOverride['overrides']
}

/**
 * Obtiene todos los productos con sus overrides por país
 */
export async function getProductsWithOverrides(countryCode?: string): Promise<ProductWithOverrides[]> {
  // Obtener productos
  let productsQuery = supabase
    .from('products')
    .select('*')
    .order('created_at', { ascending: false })

  const { data: products, error: productsError } = await productsQuery

  if (productsError) throw productsError
  if (!products) return []

  // Obtener overrides
  let overridesQuery = supabase
    .from('product_country_overrides')
    .select('*')

  if (countryCode) {
    overridesQuery = overridesQuery.eq('country_code', countryCode)
  }

  const { data: overrides, error: overridesError } = await overridesQuery

  if (overridesError) throw overridesError

  // Combinar productos con sus overrides
  return products.map(product => ({
    ...product,
    country_overrides: overrides?.filter(o => o.product_id === product.id) || []
  }))
}

/**
 * Obtiene un producto específico con todos sus overrides por país
 */
export async function getProductById(productId: string): Promise<ProductWithOverrides | null> {
  const { data: product, error: productError } = await supabase
    .from('products')
    .select('*')
    .eq('id', productId)
    .single()

  if (productError || !product) return null

  // Obtener todos los overrides del producto (todos los países)
  const { data: overrides, error: overridesError } = await supabase
    .from('product_country_overrides')
    .select('*')
    .eq('product_id', productId)

  if (overridesError) throw overridesError

  return {
    ...product,
    country_overrides: overrides || []
  }
}

/**
 * Actualiza los overrides de un producto para un país específico
 */
export async function updateProductCountryOverride(
  productId: string,
  countryCode: string,
  overrides: ProductCountryOverride['overrides']
): Promise<void> {
  // Verificar si existe un override
  const { data: existing } = await supabase
    .from('product_country_overrides')
    .select('id')
    .eq('product_id', productId)
    .eq('country_code', countryCode)
    .single()

  if (existing) {
    // Actualizar existente
    const { error } = await supabase
      .from('product_country_overrides')
      .update({
        overrides,
        updated_at: new Date().toISOString()
      })
      .eq('product_id', productId)
      .eq('country_code', countryCode)

    if (error) throw error
  } else {
    // Crear nuevo
    const { error } = await supabase
      .from('product_country_overrides')
      .insert({
        product_id: productId,
        country_code: countryCode,
        overrides
      })

    if (error) throw error
  }
}

/**
 * Obtiene las compañías únicas de ventas mensuales
 */
export async function getCompanies(): Promise<string[]> {
  const { data, error } = await supabase
    .from('ventas_mensuales_view')
    .select('compañia')
    .order('compañia', { ascending: true })

  if (error) throw error
  if (!data) return []

  const uniqueCompanies = Array.from(new Set(data.map(item => item.compañia)))
  return uniqueCompanies
}

/**
 * Obtiene los productos únicos de ventas mensuales
 */
export async function getProductsFromSales(): Promise<string[]> {
  const { data, error } = await supabase
    .from('ventas_mensuales_view')
    .select('producto')
    .order('producto', { ascending: true })

  if (error) throw error
  if (!data) return []

  const uniqueProducts = Array.from(new Set(data.map(item => item.producto)))
  return uniqueProducts
}

/**
 * Obtiene las ventas mensuales por compañía y período
 */
export async function getMonthlySales(
  company: string,
  periodo?: string,
  productName?: string
): Promise<MonthlySalesWithProduct[]> {
  // Normalizar nombre de compañía (trim espacios)
  const normalizedCompany = company.trim()
  
  let query = supabase
    .from('ventas_mensuales_view')
    .select('*')
    .eq('compañia', normalizedCompany) // ✅ Usar compañía normalizada
    .order('cantidad_ventas', { ascending: false })

  // ✅ Filtro por período es OBLIGATORIO si se proporciona
  if (periodo) {
    // Asegurar formato correcto YYYY-MM
    const formattedPeriodo = periodo.includes('-') ? periodo : `${periodo.slice(0, 4)}-${periodo.slice(4).padStart(2, '0')}`
    query = query.eq('periodo', formattedPeriodo)
  }

  if (productName && productName !== 'Todos') {
    query = query.eq('producto', productName)
  }

  const { data: sales, error } = await query

  if (error) {
    console.error('Error en getMonthlySales:', { error, company: normalizedCompany, periodo, productName })
    throw error
  }
  if (!sales) return []
  
  // Debug: verificar resultados
  console.log(`📊 getMonthlySales: ${sales.length} ventas para ${normalizedCompany} - ${periodo || 'todos los períodos'}`)

  // Obtener productos para hacer join
  const { data: products } = await supabase
    .from('products')
    .select('id, name, category, tipo')

  // Obtener overrides
  const { data: overrides } = await supabase
    .from('product_country_overrides')
    .select('*')

  // Mapear compañía a país
  const companyToCountry: Record<string, 'UY' | 'AR' | 'MX' | 'CL' | 'VE' | 'CO'> = {
    'SouthGenetics LLC': 'UY',
    'SouthGenetics LLC Uruguay': 'UY',
    'SouthGenetics LLC Argentina': 'AR',
    'SouthGenetics LLC Arge': 'AR',
    'SouthGenetics LLC Chile': 'CL',
    'Southgenetics LLC Chile': 'CL',
    'SouthGenetics LLC Colombia': 'CO',
    'SouthGenetics LLC México': 'MX',
    'SouthGenetics LLC Venezuela': 'VE',
  }

  const countryCode = companyToCountry[company] || 'UY'

  // Combinar datos
  return sales.map(sale => {
    const product = products?.find(p => p.name === sale.producto)
    const productOverrides = overrides?.find(
      o => o.product_id === product?.id && o.country_code === countryCode
    )

    return {
      ...sale,
      product_id: product?.id,
      category: product?.category || null,
      tipo: product?.tipo || null,
      overrides: productOverrides?.overrides,
    }
  })
}

/**
 * Obtiene los períodos únicos disponibles para una compañía
 * Ordenados de forma ascendente (enero primero)
 */
export async function getAvailablePeriods(company: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('ventas_mensuales_view')
    .select('periodo')
    .eq('compañia', company)
    .order('periodo', { ascending: true }) // ✅ Cambiado a true para orden ascendente

  if (error) throw error
  if (!data) return []

  const uniquePeriods = Array.from(new Set(data.map(item => item.periodo)))
  
  // Ordenar numéricamente para asegurar orden correcto (2025-01, 2025-02, etc.)
  return uniquePeriods.sort((a, b) => {
    const [yearA, monthA] = a.split('-').map(Number)
    const [yearB, monthB] = b.split('-').map(Number)
    
    if (yearA !== yearB) return yearA - yearB
    return monthA - monthB
  })
}

/**
 * Calcula el total anual agregado por producto
 */
export async function getAnnualTotal(
  company: string,
  productName?: string
): Promise<MonthlySalesWithProduct[]> {
  // Normalizar nombre de compañía
  const normalizedCompany = company.trim()
  
  let query = supabase
    .from('ventas_mensuales_view')
    .select('producto, compañia, cantidad_ventas, monto_total')
    .eq('compañia', normalizedCompany) // ✅ Usar compañía normalizada

  if (productName && productName !== 'Todos') {
    query = query.eq('producto', productName)
  }

  const { data: sales, error } = await query

  if (error) throw error
  if (!sales) return []

  // Agregar por producto
  const aggregated = sales.reduce((acc, sale) => {
    const existing = acc.find(item => item.producto === sale.producto)
    if (existing) {
      existing.cantidad_ventas += sale.cantidad_ventas
      existing.monto_total = (existing.monto_total || 0) + (sale.monto_total || 0)
    } else {
      acc.push({
        ...sale,
        mes: 0,
        año: 0,
        periodo: 'Total',
        precio_promedio: null,
      } as MonthlySalesWithProduct)
    }
    return acc
  }, [] as MonthlySalesWithProduct[])

  // Obtener productos para join
  const { data: products } = await supabase
    .from('products')
    .select('id, name, category, tipo')

  // Obtener overrides
  const { data: overrides } = await supabase
    .from('product_country_overrides')
    .select('*')

  const companyToCountry: Record<string, 'UY' | 'AR' | 'MX' | 'CL' | 'VE' | 'CO'> = {
    'SouthGenetics LLC': 'UY',
    'SouthGenetics LLC Uruguay': 'UY',
    'SouthGenetics LLC Argentina': 'AR',
    'SouthGenetics LLC Arge': 'AR',
    'SouthGenetics LLC Chile': 'CL',
    'Southgenetics LLC Chile': 'CL',
    'SouthGenetics LLC Colombia': 'CO',
    'SouthGenetics LLC México': 'MX',
    'SouthGenetics LLC Venezuela': 'VE',
  }

  const countryCode = companyToCountry[company] || 'UY'

  // Combinar datos
  return aggregated.map(sale => {
    const product = products?.find(p => p.name === sale.producto)
    const productOverrides = overrides?.find(
      o => o.product_id === product?.id && o.country_code === countryCode
    )

    return {
      ...sale,
      product_id: product?.id,
      category: product?.category || null,
      tipo: product?.tipo || null,
      overrides: productOverrides?.overrides,
    }
  }).sort((a, b) => b.cantidad_ventas - a.cantidad_ventas)
}
