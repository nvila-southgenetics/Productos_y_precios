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

/** Canales de venta por país (orden alfabético en UI) */
export const CHANNELS = ['Aseguradoras', 'Distribuidores', 'Gobierno', 'Instituciones SFL', 'Paciente'] as const
export type Channel = typeof CHANNELS[number]

export interface ProductCountryOverride {
  id: string
  product_id: string
  country_code: 'UY' | 'AR' | 'MX' | 'CL' | 'VE' | 'CO'
  channel?: string
  overrides: {
    grossSalesUSD?: number
    grossProfitUSD?: number
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
    reviewed?: boolean
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
  companyBreakdown?: Array<{
    compañia: string
    cantidad_ventas: number
    monto_total: number | null
  }>
}

export interface DashboardProduct {
  producto: string
  product_id?: string
  category?: string | null
  tipo?: string | null
  cantidad_ventas: number
  monto_total: number | null
  gross_sale: number
  gross_profit: number
  gross_margin_percent: number
  overrides?: ProductCountryOverride['overrides']
}

/** Venta de la tabla ventas (por fecha) */
export interface VentaByDate {
  id: string
  fecha: string
  test: string
  amount: number
  company: string
}

/**
 * Obtiene todas las ventas de una fecha desde la tabla ventas
 * @param fecha Formato YYYY-MM-DD
 */
export async function getSalesByDate(fecha: string): Promise<VentaByDate[]> {
  const { data, error } = await supabase
    .from('ventas')
    .select('id, fecha, test, amount, company')
    .eq('fecha', fecha)
    .order('company', { ascending: true })
    .order('test', { ascending: true })

  if (error) throw error
  if (!data) return []

  return data.map((row: { id: string; fecha: string; test: string; amount: string | number; company: string }) => ({
    id: row.id,
    fecha: row.fecha,
    test: row.test,
    amount: typeof row.amount === 'string' ? parseFloat(row.amount) : row.amount,
    company: row.company,
  }))
}

/**
 * Borra todas las ventas con fecha en un año específico
 * @param year Año en formato YYYY (ej: "2026")
 */
export async function deleteSalesByYear(year: string): Promise<{ deleted: number; error: any }> {
  const yearStart = `${year}-01-01`
  const yearEnd = `${year}-12-31`
  
  const { data, error } = await supabase
    .from('ventas')
    .delete()
    .gte('fecha', yearStart)
    .lte('fecha', yearEnd)
    .select()

  if (error) {
    console.error('Error borrando ventas:', error)
    return { deleted: 0, error }
  }

  const deletedCount = data?.length || 0
  console.log(`✅ Borradas ${deletedCount} ventas del año ${year}`)
  return { deleted: deletedCount, error: null }
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
  const productsWithOverrides = products.map((product: Product) => ({
    ...product,
    country_overrides: overrides?.filter((o: ProductCountryOverride) => o.product_id === product.id) || []
  }))

  // Si se especifica un país, solo devolver productos que tengan overrides para ese país
  if (countryCode) {
    return productsWithOverrides.filter((product: ProductWithOverrides) =>
      product.country_overrides && product.country_overrides.length > 0
    )
  }

  return productsWithOverrides
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
 * Crea un producto nuevo con la información mínima necesaria.
 * Si no se especifica SKU, se genera uno simple a partir del nombre.
 */
export async function createProduct(input: {
  name: string
  description?: string | null
  category?: string | null
  tipo?: string | null
}): Promise<ProductWithOverrides> {
  const baseName = input.name.trim()
  if (!baseName) {
    throw new Error('El nombre del producto es obligatorio')
  }

  // SKU requerido por DB: lo generamos a partir del nombre (sin necesidad de input del usuario).
  const generatedSku = baseName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toUpperCase() || `SKU-${Date.now()}`

  // productos.user_id y productos.base_price son NOT NULL, así que deben setearse al insertar.
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    throw new Error('No hay usuario autenticado para crear el producto.')
  }

  // Evitar errores por duplicados: si ya existe el producto con el mismo nombre, lo devolvemos.
  const { data: existing, error: existingError } = await supabase
    .from('products')
    .select('*')
    .eq('name', baseName)
    .maybeSingle()

  if (existingError) throw existingError
  if (existing) {
    return {
      ...(existing as Product),
      country_overrides: [],
    }
  }

  const { data, error } = await supabase
    .from('products')
    .insert({
      name: baseName,
      sku: generatedSku,
      base_price: 0,
      user_id: user.id,
      description: input.description ?? null,
      category: input.category ?? null,
      tipo: input.tipo ?? null,
    })
    .select('*')
    .single()

  if (error || !data) {
    console.error('Error creating product:', error)
    throw error || new Error('No se pudo crear el producto')
  }

  return {
    ...(data as Product),
    country_overrides: [],
  }
}

/**
 * Actualiza los overrides de un producto para un país y canal
 */
export async function updateProductCountryOverride(
  productId: string,
  countryCode: string,
  overrides: ProductCountryOverride['overrides'],
  channel: string = 'Paciente'
): Promise<void> {
  const { data: existing, error: selectError } = await supabase
    .from('product_country_overrides')
    .select('id, overrides')
    .eq('product_id', productId)
    .eq('country_code', countryCode)
    .eq('channel', channel)
    .maybeSingle()

  if (selectError) {
    console.error('Error checking existing override:', selectError)
    throw selectError
  }

  if (existing) {
    const existingOverrides = existing.overrides as ProductCountryOverride['overrides']
    const preservedOverrides: ProductCountryOverride['overrides'] = {
      ...overrides,
      reviewed: overrides.reviewed !== undefined ? overrides.reviewed : (existingOverrides?.reviewed || false),
    }

    const { error } = await supabase
      .from('product_country_overrides')
      .update({
        overrides: preservedOverrides,
        updated_at: new Date().toISOString()
      })
      .eq('product_id', productId)
      .eq('country_code', countryCode)
      .eq('channel', channel)

    if (error) {
      console.error('Error updating override:', error)
      throw error
    }
  } else {
    const { error } = await supabase
      .from('product_country_overrides')
      .insert({
        product_id: productId,
        country_code: countryCode,
        channel,
        overrides
      })

    if (error) {
      console.error('Error creating override:', error)
      throw error
    }
  }
}

/**
 * Elimina un producto de un país específico (elimina el override)
 */
export async function deleteProductFromCountry(
  productId: string,
  countryCode: string
): Promise<void> {
  const { error } = await supabase
    .from('product_country_overrides')
    .delete()
    .eq('product_id', productId)
    .eq('country_code', countryCode)

  if (error) {
    console.error('Error deleting product from country:', error)
    throw error
  }
}

/**
 * Elimina un producto de todos los países (elimina todos los overrides y el producto)
 */
export async function deleteProductFromAllCountries(productId: string): Promise<void> {
  // Primero eliminar todos los overrides del producto
  const { error: overridesError } = await supabase
    .from('product_country_overrides')
    .delete()
    .eq('product_id', productId)

  if (overridesError) {
    console.error('Error deleting product overrides:', overridesError)
    throw overridesError
  }

  // Luego eliminar el producto mismo
  const { error: productError } = await supabase
    .from('products')
    .delete()
    .eq('id', productId)

  if (productError) {
    console.error('Error deleting product:', productError)
    throw productError
  }
}

/** Mapeo compañía -> código de país (ventas están por compañía, no por país) */
export const COMPANY_TO_COUNTRY: Record<string, 'UY' | 'AR' | 'MX' | 'CL' | 'VE' | 'CO'> = {
  'SouthGenetics LLC': 'UY',
  'SouthGenetics LLC Uruguay': 'UY',
  'SouthGenetics LLC Argentina': 'AR',
  'SouthGenetics LLC Arge': 'AR',
  'SouthGenetics LLC Chile': 'CL',
  'Southgenetics LLC Chile': 'CL',
  'Southgenetics LTDA': 'CL',
  'SouthGenetics LLC Colombia': 'CO',
  'SouthGenetics LLC México': 'MX',
  'SouthGenetics LLC Venezuela': 'VE',
}

/**
 * Obtiene el total de ventas registradas por producto (tabla ventas), sin filtrar por año.
 * Si se pasa countryCode, solo cuenta ventas de compañías que pertenecen a ese país.
 * Devuelve un mapa product_id -> cantidad total de ventas.
 */
export async function getTotalSalesByProductIds(
  productIds: string[],
  countryCode?: string
): Promise<Record<string, number>> {
  if (productIds.length === 0) return {}

  const { data, error } = await supabase
    .from('ventas')
    .select('id_producto, company')
    .in('id_producto', productIds)

  if (error) {
    console.error('Error fetching total sales by product:', error)
    throw error
  }

  const counts: Record<string, number> = {}
  productIds.forEach(id => { counts[id] = 0 })

  ;(data || []).forEach((row: { id_producto: string | null; company: string | null }) => {
    if (!row.id_producto) return
    if (countryCode) {
      const companyCountry = row.company ? COMPANY_TO_COUNTRY[row.company.trim()] : undefined
      if (companyCountry !== countryCode) return
    }
    counts[row.id_producto] = (counts[row.id_producto] ?? 0) + 1
  })
  return counts
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

  const uniqueCompanies: string[] = Array.from(
    new Set(data.map((item: { compañia: string }) => item.compañia))
  )
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

  const uniqueProducts: string[] = Array.from(new Set(data.map((item: { producto: string }) => item.producto)))
  return uniqueProducts
}

/** Evolución mensual de ventas (para gráfico 2025 vs 2026) */
export interface MonthlyEvolutionPoint {
  mes: number
  mesLabel: string
  año: number
  periodo: string
  cantidad_ventas: number
  monto_total: number
}

const MES_LABELS: Record<number, string> = {
  1: 'Ene', 2: 'Feb', 3: 'Mar', 4: 'Abr', 5: 'May', 6: 'Jun',
  7: 'Jul', 8: 'Ago', 9: 'Sep', 10: 'Oct', 11: 'Nov', 12: 'Dic',
}

function isAllCompaniesLabel(company: string): boolean {
  // Normaliza para que el "modo todas las compañías" sea robusto ante acentos/espaciado.
  const normalized = (company ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")

  // Ej: "todas las companias"
  return normalized === "todas las companias" || normalized.startsWith("todas las compan")
}

/**
 * Obtiene la evolución mensual de ventas para 2025 y 2026 (agregado por mes).
 * Opcionalmente filtra por compañía y producto.
 */
export async function getMonthlySalesEvolution(
  company?: string,
  productName?: string | string[]
): Promise<{ year2025: MonthlyEvolutionPoint[]; year2026: MonthlyEvolutionPoint[] }> {
  let query = supabase
    .from('ventas_mensuales_view')
    .select('año, mes, periodo, cantidad_ventas, monto_total, compañia, producto')

  const { data, error } = await query

  if (error) {
    console.error('Error getMonthlySalesEvolution:', error)
    throw error
  }
  if (!data || data.length === 0) {
    const emptyMonth = (mes: number) => ({
      mes,
      mesLabel: MES_LABELS[mes] || String(mes),
      año: 0,
      periodo: '',
      cantidad_ventas: 0,
      monto_total: 0,
    })
    return {
      year2025: [1,2,3,4,5,6,7,8,9,10,11,12].map(m => ({ ...emptyMonth(m), año: 2025 })),
      year2026: [1,2,3,4,5,6,7,8,9,10,11,12].map(m => ({ ...emptyMonth(m), año: 2026 })),
    }
  }

  const normalizedCompany = company?.trim()
  const normalizedProduct =
    typeof productName === 'string' ? productName.trim() : undefined
  const normalizedProducts =
    Array.isArray(productName) ? productName.map((p) => p.trim()).filter(Boolean) : undefined

  const filtered = (data as any[]).filter((row) => {
    if (normalizedCompany && !isAllCompaniesLabel(normalizedCompany) && row.compañia !== normalizedCompany) return false
    if (normalizedProducts && normalizedProducts.length > 0) {
      if (!normalizedProducts.includes(row.producto)) return false
    } else if (normalizedProduct && normalizedProduct !== 'Todos' && row.producto !== normalizedProduct) {
      return false
    }
    return row.año === 2025 || row.año === 2026
  })

  const agg = new Map<string, { año: number; mes: number; cantidad_ventas: number; monto_total: number }>()
  filtered.forEach((row: any) => {
    const key = `${row.año}-${row.mes}`
    const current = agg.get(key) || { año: row.año, mes: row.mes, cantidad_ventas: 0, monto_total: 0 }
    current.cantidad_ventas += Number(row.cantidad_ventas) || 0
    current.monto_total += Number(row.monto_total) || 0
    agg.set(key, current)
  })

  const toPoints = (año: number): MonthlyEvolutionPoint[] => {
    return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((mes) => {
      const key = `${año}-${mes}`
      const v = agg.get(key)
      return {
        mes,
        mesLabel: MES_LABELS[mes] || String(mes),
        año,
        periodo: v ? `${año}-${String(mes).padStart(2, '0')}` : '',
        cantidad_ventas: v?.cantidad_ventas ?? 0,
        monto_total: v?.monto_total ?? 0,
      }
    })
  }

  return {
    year2025: toPoints(2025),
    year2026: toPoints(2026),
  }
}

/**
 * Obtiene las ventas mensuales por compañía y período
 */
export async function getMonthlySales(
  company: string,
  periodo?: string,
  productName?: string | string[]
): Promise<MonthlySalesWithProduct[]> {
  // Normalizar nombre de compañía (trim espacios)
  const normalizedCompany = company.trim()
  
  let query = supabase
    .from('ventas_mensuales_view')
    .select('*')
    .order('cantidad_ventas', { ascending: false })
  
  // Solo filtrar por compañía si no es "Todas las compañías"
  if (!isAllCompaniesLabel(normalizedCompany)) {
    query = query.eq('compañia', normalizedCompany) // ✅ Usar compañía normalizada
  }

  // ✅ Filtro por período es OBLIGATORIO si se proporciona
  if (periodo) {
    // Asegurar formato correcto YYYY-MM
    const formattedPeriodo = periodo.includes('-') ? periodo : `${periodo.slice(0, 4)}-${periodo.slice(4).padStart(2, '0')}`
    query = query.eq('periodo', formattedPeriodo)
  }

  if (Array.isArray(productName) && productName.length > 0) {
    query = query.in('producto', productName)
  } else if (typeof productName === 'string' && productName !== 'Todos') {
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

  // Si es "Todas las compañías", agrupar por producto y crear desglose por compañía
  const isAllCompanies = isAllCompaniesLabel(normalizedCompany)
  
  if (isAllCompanies) {
    // Agrupar por producto
    const groupedByProduct = sales.reduce((acc: any, sale: any) => {
      const productKey = sale.producto
      if (!acc[productKey]) {
        acc[productKey] = {
          producto: sale.producto,
          mes: sale.mes,
          año: sale.año,
          periodo: sale.periodo,
          compañia: "Todas las compañías", // Placeholder
          cantidad_ventas: 0,
          monto_total: 0,
          precio_promedio: null,
          companyBreakdown: []
        }
      }
      
      // Agregar al total
      acc[productKey].cantidad_ventas += sale.cantidad_ventas
      acc[productKey].monto_total = (acc[productKey].monto_total || 0) + (sale.monto_total || 0)
      
      // Agregar al desglose por compañía
      const companyBreakdown = acc[productKey].companyBreakdown.find((cb: any) => cb.compañia === sale.compañia)
      if (companyBreakdown) {
        companyBreakdown.cantidad_ventas += sale.cantidad_ventas
        companyBreakdown.monto_total = (companyBreakdown.monto_total || 0) + (sale.monto_total || 0)
      } else {
        acc[productKey].companyBreakdown.push({
          compañia: sale.compañia,
          cantidad_ventas: sale.cantidad_ventas,
          monto_total: sale.monto_total || 0
        })
      }
      
      return acc
    }, {})
    
    // Convertir a array y agregar información de productos
    return (Object.values(groupedByProduct) as MonthlySales[]).map((sale: MonthlySales) => {
      const product = products?.find((p: Product) => p.name === sale.producto)
      // Buscar overrides de cualquier país (usar el primero disponible)
      const productOverrides = overrides?.find((o: ProductCountryOverride) => o.product_id === product?.id)
      
      // Recalcular precio promedio
      if (sale.cantidad_ventas > 0 && sale.monto_total) {
        sale.precio_promedio = sale.monto_total / sale.cantidad_ventas
      }
      
      return {
        ...sale,
        product_id: product?.id,
        category: product?.category || null,
        tipo: product?.tipo || null,
        overrides: productOverrides?.overrides,
      } as MonthlySalesWithProduct
    })
  }
  
  // Si no es "Todas las compañías", comportamiento normal
  return sales.map((sale: MonthlySales) => {
    const product = products?.find((p: Product) => p.name === sale.producto)
    const saleCompany = sale.compañia
    const saleCountryCode = companyToCountry[saleCompany] || 'UY'
    const productOverrides = overrides?.find(
      (o: ProductCountryOverride) => o.product_id === product?.id && o.country_code === saleCountryCode
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
  // Normalizar nombre de compañía (trim espacios)
  const normalizedCompany = company.trim()
  
  let query = supabase
    .from('ventas_mensuales_view')
    .select('periodo')
    .order('periodo', { ascending: true }) // ✅ Cambiado a true para orden ascendente
  
  // Solo filtrar por compañía si no es "Todas las compañías"
  if (!isAllCompaniesLabel(normalizedCompany)) {
    query = query.eq('compañia', normalizedCompany) // ✅ Usar compañía normalizada
  }
  
  const { data, error } = await query

  if (error) {
    console.error('Error en getAvailablePeriods:', { error, company: normalizedCompany })
    throw error
  }
  if (!data) {
    console.warn(`⚠️ No se encontraron períodos para la compañía: ${normalizedCompany}`)
    return []
  }

  const uniquePeriods: string[] = Array.from(
    new Set(
      (data as any[])
        .map((item: any) => item?.periodo)
        .filter((p: any) => typeof p === "string" && p.trim().length > 0)
    )
  )
  
  // Debug: mostrar períodos encontrados
  console.log(`📅 Períodos encontrados para ${normalizedCompany}:`, uniquePeriods)
  
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
  productName?: string | string[]
): Promise<MonthlySalesWithProduct[]> {
  // Normalizar nombre de compañía
  const normalizedCompany = company.trim()
  
  let query = supabase
    .from('ventas_mensuales_view')
    .select('producto, compañia, cantidad_ventas, monto_total')
  
  // Solo filtrar por compañía si no es "Todas las compañías"
  if (!isAllCompaniesLabel(normalizedCompany)) {
    query = query.eq('compañia', normalizedCompany) // ✅ Usar compañía normalizada
  }

  if (Array.isArray(productName) && productName.length > 0) {
    query = query.in('producto', productName)
  } else if (typeof productName === 'string' && productName !== 'Todos') {
    query = query.eq('producto', productName)
  }

  const { data: sales, error } = await query

  if (error) throw error
  if (!sales) return []

  const isAllCompanies = isAllCompaniesLabel(normalizedCompany)
  type SaleRow = { producto: string; compañia: string; cantidad_ventas: number; monto_total: number | null }
  type CompanyBreakdownItem = { compañia: string; cantidad_ventas: number; monto_total: number | null }

  // Agregar por producto
  const aggregated = sales.reduce((acc: MonthlySalesWithProduct[], sale: SaleRow) => {
    const existing = acc.find((item: MonthlySalesWithProduct) => item.producto === sale.producto)
    if (existing) {
      existing.cantidad_ventas += sale.cantidad_ventas
      existing.monto_total = (existing.monto_total || 0) + (sale.monto_total || 0)
      
      // Si es "Todas las compañías", mantener el desglose por compañía
      if (isAllCompanies) {
        if (!existing.companyBreakdown) {
          existing.companyBreakdown = []
        }
        const companyBreakdown = existing.companyBreakdown!.find((cb: CompanyBreakdownItem) => cb.compañia === sale.compañia)
        if (companyBreakdown) {
          companyBreakdown.cantidad_ventas += sale.cantidad_ventas
          companyBreakdown.monto_total = (companyBreakdown.monto_total || 0) + (sale.monto_total || 0)
        } else {
          existing.companyBreakdown.push({
            compañia: sale.compañia,
            cantidad_ventas: sale.cantidad_ventas,
            monto_total: sale.monto_total || 0
          })
        }
      }
    } else {
      const newItem: MonthlySalesWithProduct = {
        ...sale,
        mes: 0,
        año: 0,
        periodo: 'Total',
        precio_promedio: null,
        ...(isAllCompanies ? { companyBreakdown: [{ compañia: sale.compañia, cantidad_ventas: sale.cantidad_ventas, monto_total: sale.monto_total || 0 }] } : {}),
      }
      acc.push(newItem)
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

  const countryCode = isAllCompanies ? null : (companyToCountry[company] || 'UY')

  // Combinar datos
  return aggregated.map((sale: MonthlySalesWithProduct) => {
    const product = products?.find((p: Product) => p.name === sale.producto)
    // Si es todas las compañías, buscar overrides de cualquier país o usar el primero disponible
    const productOverrides = isAllCompanies 
      ? overrides?.find((o: ProductCountryOverride) => o.product_id === product?.id) // Cualquier override del producto
      : overrides?.find((o: ProductCountryOverride) => o.product_id === product?.id && o.country_code === countryCode)

    return {
      ...sale,
      product_id: product?.id,
      category: product?.category || null,
      tipo: product?.tipo || null,
      overrides: productOverrides?.overrides,
    }
  }).sort((a: any, b: any) => b.cantidad_ventas - a.cantidad_ventas)
}

/**
 * Función auxiliar para obtener productos con métricas calculadas
 */
async function getProductsWithMetrics(
  company: string,
  year?: string,
  month?: string,
  productName?: string | string[],
  channel?: string
): Promise<DashboardProduct[]> {
  const normalizedCompany = company.trim()
  const isAllCompanies = isAllCompaniesLabel(normalizedCompany)
  
  let query = supabase
    .from('ventas_mensuales_view')
    .select('producto, compañia, cantidad_ventas, monto_total, mes, año, periodo')
  
  if (!isAllCompanies) {
    query = query.eq('compañia', normalizedCompany)
  }
  
  if (year && year !== "Todos") {
    query = query.eq('año', parseInt(year))
  }
  
  if (month && month !== "Todos") {
    query = query.eq('mes', parseInt(month))
  }
  
  if (Array.isArray(productName) && productName.length > 0) {
    query = query.in('producto', productName)
  } else if (typeof productName === 'string' && productName !== 'Todos') {
    query = query.eq('producto', productName)
  }
  
  const { data: sales, error } = await query
  
  if (error) throw error
  if (!sales) return []
  
  // Agrupar por producto
  type ProductAgg = { producto: string; cantidad_ventas: number; monto_total: number }
  const productMap = new Map<string, ProductAgg>()
  
  sales.forEach((sale: { producto: string; cantidad_ventas: number; monto_total: number | null }) => {
    const key = sale.producto
    if (!productMap.has(key)) {
      productMap.set(key, {
        producto: sale.producto,
        cantidad_ventas: 0,
        monto_total: 0,
      })
    }
    const product = productMap.get(key)!
    product.cantidad_ventas += sale.cantidad_ventas
    product.monto_total = (product.monto_total || 0) + (sale.monto_total || 0)
  })
  
  // Obtener productos y overrides
  const { data: products } = await supabase
    .from('products')
    .select('id, name, category, tipo')
  
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
  
  // Calcular métricas para cada producto
  const dashboardProducts: DashboardProduct[] = []
  
  Array.from(productMap.values()).forEach((product: ProductAgg) => {
    const productInfo = products?.find((p: Product) => p.name === product.producto)
    
    // Si es todas las compañías, usar el primer override disponible
    const countryCode = isAllCompanies 
      ? null 
      : (companyToCountry[company] || 'UY')
    
    const matchesChannel = (o: ProductCountryOverride) => {
      if (!channel || channel === 'Todos los canales') return true
      return (o.channel || 'Paciente') === channel
    }

    const productOverride = isAllCompanies
      ? overrides?.find((o: ProductCountryOverride) => o.product_id === productInfo?.id && matchesChannel(o))
      : overrides?.find((o: ProductCountryOverride) => o.product_id === productInfo?.id && o.country_code === countryCode && matchesChannel(o))
    
    const overrideData = productOverride?.overrides || {}
    const grossSalesUSD = overrideData.grossSalesUSD || 0
    
    // Filtrar productos con grossSalesUSD inválido (0 o 10 USD)
    if (grossSalesUSD === 0 || grossSalesUSD === 10) {
      return // Saltar este producto
    }
    
    // Calcular grossProfitUSD (no está almacenado, se calcula)
    const commercialDiscountUSD = overrideData.commercialDiscountUSD || 0
    const salesRevenueUSD = grossSalesUSD - commercialDiscountUSD
    
    const totalCostOfSalesUSD =
      (overrideData.productCostUSD || 0) +
      (overrideData.kitCostUSD || 0) +
      (overrideData.paymentFeeUSD || 0) +
      (overrideData.bloodDrawSampleUSD || 0) +
      (overrideData.sanitaryPermitsUSD || 0) +
      (overrideData.externalCourierUSD || 0) +
      (overrideData.internalCourierUSD || 0) +
      (overrideData.physiciansFeesUSD || 0) +
      (overrideData.salesCommissionUSD || 0)
    
    const grossProfitUSD = salesRevenueUSD - totalCostOfSalesUSD
    
    const grossSale = grossSalesUSD * product.cantidad_ventas
    const grossProfit = grossProfitUSD * product.cantidad_ventas
    const grossMarginPercent = grossSalesUSD > 0 
      ? (grossProfitUSD / grossSalesUSD) * 100 
      : 0
    
    dashboardProducts.push({
      producto: product.producto,
      product_id: productInfo?.id,
      category: productInfo?.category || null,
      tipo: productInfo?.tipo || null,
      cantidad_ventas: product.cantidad_ventas,
      monto_total: product.monto_total,
      gross_sale: grossSale,
      gross_profit: grossProfit,
      gross_margin_percent: grossMarginPercent,
      overrides: overrideData,
    })
  })
  
  return dashboardProducts
}

/**
 * Obtiene los productos más vendidos para el dashboard
 */
export async function getTopSellingProducts(
  company: string,
  year?: string,
  month?: string,
  productName?: string | string[],
  channel?: string,
  limit: number = 10
): Promise<DashboardProduct[]> {
  const products = await getProductsWithMetrics(company, year, month, productName, channel)
  
  // Ordenar por cantidad de ventas y limitar
  return products
    .sort((a, b) => b.cantidad_ventas - a.cantidad_ventas)
    .slice(0, limit)
}

/**
 * Obtiene los productos con mayor margen de ganancia para el dashboard
 */
export async function getTopMarginProducts(
  company: string,
  year?: string,
  month?: string,
  productName?: string | string[],
  channel?: string,
  limit: number = 10
): Promise<DashboardProduct[]> {
  const products = await getProductsWithMetrics(company, year, month, productName, channel)
  
  // Filtrar productos con margen válido (> 0) y ordenar por margen descendente
  return products
    .filter(p => p.gross_margin_percent > 0)
    .sort((a, b) => b.gross_margin_percent - a.gross_margin_percent)
    .slice(0, limit)
}

/**
 * Obtiene los productos con menor margen de ganancia para el dashboard
 */
export async function getBottomMarginProducts(
  company: string,
  year?: string,
  month?: string,
  productName?: string | string[],
  channel?: string,
  limit: number = 10
): Promise<DashboardProduct[]> {
  const products = await getProductsWithMetrics(company, year, month, productName, channel)
  
  // Filtrar productos con margen válido (> 0) y ordenar por margen ascendente
  return products
    .filter(p => p.gross_margin_percent > 0)
    .sort((a, b) => a.gross_margin_percent - b.gross_margin_percent)
    .slice(0, limit)
}

/**
 * Obtiene los productos más caros (mayor grossSalesUSD) para el dashboard
 */
export async function getMostExpensiveProducts(
  company: string,
  year?: string,
  month?: string,
  productName?: string | string[],
  channel?: string,
  limit: number = 10
): Promise<DashboardProduct[]> {
  const products = await getProductsWithMetrics(company, year, month, productName, channel)
  
  // Ordenar por grossSalesUSD (precio unitario) descendente
  return products
    .sort((a, b) => {
      const priceA = a.overrides?.grossSalesUSD || 0
      const priceB = b.overrides?.grossSalesUSD || 0
      return priceB - priceA
    })
    .slice(0, limit)
}
