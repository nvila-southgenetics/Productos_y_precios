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

  const uniqueCompanies = Array.from(
    new Set(data.map((item: any) => item.compañia))
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

  const uniqueProducts = Array.from(new Set(data.map((item: any) => item.producto)))
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
    .order('cantidad_ventas', { ascending: false })
  
  // Solo filtrar por compañía si no es "Todas las compañías"
  if (normalizedCompany !== "Todas las compañías") {
    query = query.eq('compañia', normalizedCompany) // ✅ Usar compañía normalizada
  }

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

  // Si es "Todas las compañías", agrupar por producto y crear desglose por compañía
  const isAllCompanies = normalizedCompany === "Todas las compañías"
  
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
    return Object.values(groupedByProduct).map((sale: any) => {
      const product = products?.find(p => p.name === sale.producto)
      // Buscar overrides de cualquier país (usar el primero disponible)
      const productOverrides = overrides?.find(o => o.product_id === product?.id)
      
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
  return sales.map((sale: any) => {
    const product = products?.find(p => p.name === sale.producto)
    const saleCompany = sale.compañia || sale.company
    const saleCountryCode = companyToCountry[saleCompany] || 'UY'
    const productOverrides = overrides?.find(
      o => o.product_id === product?.id && o.country_code === saleCountryCode
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
  if (normalizedCompany !== "Todas las compañías") {
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

  const uniquePeriods = Array.from(new Set(data.map(item => item.periodo)))
  
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
  productName?: string
): Promise<MonthlySalesWithProduct[]> {
  // Normalizar nombre de compañía
  const normalizedCompany = company.trim()
  
  let query = supabase
    .from('ventas_mensuales_view')
    .select('producto, compañia, cantidad_ventas, monto_total')
  
  // Solo filtrar por compañía si no es "Todas las compañías"
  if (normalizedCompany !== "Todas las compañías") {
    query = query.eq('compañia', normalizedCompany) // ✅ Usar compañía normalizada
  }

  if (productName && productName !== 'Todos') {
    query = query.eq('producto', productName)
  }

  const { data: sales, error } = await query

  if (error) throw error
  if (!sales) return []

  // Agregar por producto
  const aggregated = sales.reduce((acc, sale: any) => {
    const existing = acc.find((item: any) => item.producto === sale.producto)
    if (existing) {
      existing.cantidad_ventas += sale.cantidad_ventas
      existing.monto_total = (existing.monto_total || 0) + (sale.monto_total || 0)
      
      // Si es "Todas las compañías", mantener el desglose por compañía
      if (isAllCompanies) {
        if (!existing.companyBreakdown) {
          existing.companyBreakdown = []
        }
        const companyBreakdown = existing.companyBreakdown.find((cb: any) => cb.compañia === sale.compañia)
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
      const newItem: any = {
        ...sale,
        mes: 0,
        año: 0,
        periodo: 'Total',
        precio_promedio: null,
      }
      
      // Si es "Todas las compañías", agregar desglose por compañía
      if (isAllCompanies) {
        newItem.companyBreakdown = [{
          compañia: sale.compañia,
          cantidad_ventas: sale.cantidad_ventas,
          monto_total: sale.monto_total || 0
        }]
      }
      
      acc.push(newItem as MonthlySalesWithProduct)
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

  // Si es "Todas las compañías", no aplicar overrides específicos por país
  const isAllCompanies = normalizedCompany === "Todas las compañías"
  const countryCode = isAllCompanies ? null : (companyToCountry[company] || 'UY')

  // Combinar datos
  return aggregated.map(sale => {
    const product = products?.find(p => p.name === sale.producto)
    // Si es todas las compañías, buscar overrides de cualquier país o usar el primero disponible
    const productOverrides = isAllCompanies 
      ? overrides?.find(o => o.product_id === product?.id) // Cualquier override del producto
      : overrides?.find(o => o.product_id === product?.id && o.country_code === countryCode)

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
  productName?: string
): Promise<DashboardProduct[]> {
  const normalizedCompany = company.trim()
  const isAllCompanies = normalizedCompany === "Todas las compañías"
  
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
  
  if (productName && productName !== 'Todos') {
    query = query.eq('producto', productName)
  }
  
  const { data: sales, error } = await query
  
  if (error) throw error
  if (!sales) return []
  
  // Agrupar por producto
  const productMap = new Map<string, any>()
  
  sales.forEach((sale: any) => {
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
  return Array.from(productMap.values())
    .map((product: any) => {
      const productInfo = products?.find(p => p.name === product.producto)
      
      // Si es todas las compañías, usar el primer override disponible
      const countryCode = isAllCompanies 
        ? null 
        : (companyToCountry[company] || 'UY')
      
      const productOverride = isAllCompanies
        ? overrides?.find(o => o.product_id === productInfo?.id)
        : overrides?.find(o => o.product_id === productInfo?.id && o.country_code === countryCode)
      
      const overrideData = productOverride?.overrides || {}
      const grossSalesUSD = overrideData.grossSalesUSD || 0
      
      // Filtrar productos con grossSalesUSD inválido (0 o 10 USD)
      if (grossSalesUSD === 0 || grossSalesUSD === 10) {
        return null
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
      
      return {
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
      }
    })
    .filter((p): p is DashboardProduct => p !== null)
}

/**
 * Obtiene los productos más vendidos para el dashboard
 */
export async function getTopSellingProducts(
  company: string,
  year?: string,
  month?: string,
  productName?: string,
  limit: number = 10
): Promise<DashboardProduct[]> {
  const products = await getProductsWithMetrics(company, year, month, productName)
  
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
  productName?: string,
  limit: number = 10
): Promise<DashboardProduct[]> {
  const products = await getProductsWithMetrics(company, year, month, productName)
  
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
  productName?: string,
  limit: number = 10
): Promise<DashboardProduct[]> {
  const products = await getProductsWithMetrics(company, year, month, productName)
  
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
  productName?: string,
  limit: number = 10
): Promise<DashboardProduct[]> {
  const products = await getProductsWithMetrics(company, year, month, productName)
  
  // Ordenar por grossSalesUSD (precio unitario) descendente
  return products
    .sort((a, b) => {
      const priceA = a.overrides?.grossSalesUSD || 0
      const priceB = b.overrides?.grossSalesUSD || 0
      return priceB - priceA
    })
    .slice(0, limit)
}
