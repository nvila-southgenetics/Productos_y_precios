/**
 * Funciones para interactuar con Supabase
 * Usa el cliente de Supabase normal para producción
 */

import { supabase } from './supabase'

export interface Product {
  id: string
  name: string
  alias: string
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
  alias?: string | null
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

/** Normaliza nombre de producto para emparejar filas de ventas con `products.name` (corchetes, espacios, etc.). */
function normalizeProductNameForMatch(name: string): string {
  return (name || "")
    .trim()
    .toUpperCase()
    .replace(/\[.*?\]/g, "")
    .replace(/[^\w]/g, "")
    .replace(/\s+/g, "")
}

/**
 * Resuelve el producto del catálogo a partir del texto en `ventas_mensuales_view`
 * (p. ej. "[Genomind Professional PGx] Genomind Professional PGx" vs nombre en catálogo).
 */
export function findProductBySaleName(products: Product[] | null | undefined, saleProducto: string): Product | undefined {
  if (!products?.length || !saleProducto) return undefined
  const exact = products.find((p) => p.name === saleProducto)
  if (exact) return exact
  const saleNorm = normalizeProductNameForMatch(saleProducto)
  if (!saleNorm) return undefined
  const byNorm = products.find((p) => normalizeProductNameForMatch(p.name) === saleNorm)
  if (byNorm) return byNorm
  for (const p of products) {
    const pn = normalizeProductNameForMatch(p.name)
    if (saleNorm.length >= 5 && pn.length >= 5 && (saleNorm.includes(pn) || pn.includes(saleNorm))) {
      return p
    }
  }
  return undefined
}

const DEFAULT_OVERRIDE_CHANNEL = "Paciente"

/** Entre varios overrides por producto+país (distintos canales), preferir Paciente — alineado con datos reales/P&L. */
function pickOverrideForCountry(
  rows: ProductCountryOverride[] | null | undefined,
  productId: string,
  countryCode: string
): ProductCountryOverride | undefined {
  if (!rows?.length) return undefined
  const candidates = rows.filter((o) => o.product_id === productId && o.country_code === countryCode)
  if (candidates.length === 0) return undefined
  const paciente = candidates.find((o) => (o.channel || DEFAULT_OVERRIDE_CHANNEL) === DEFAULT_OVERRIDE_CHANNEL)
  return paciente ?? candidates[0]
}

/** Vista "todas las compañías": primer override Paciente del producto (evita tomar un canal arbitrario). */
function pickOverrideAllCompaniesFirst(
  rows: ProductCountryOverride[] | null | undefined,
  productId: string
): ProductCountryOverride | undefined {
  if (!rows?.length) return undefined
  const forProduct = rows.filter((o) => o.product_id === productId)
  if (forProduct.length === 0) return undefined
  const paciente = forProduct.filter((o) => (o.channel || DEFAULT_OVERRIDE_CHANNEL) === DEFAULT_OVERRIDE_CHANNEL)
  const pool = paciente.length ? paciente : forProduct
  return pool[0]
}

type VentasIdRow = { test: string | null; id_producto: string | null }

/** Por cada texto `test` (igual a `producto` en la vista), el id de producto más frecuente en filas de `ventas`. */
function tallyProductIdByTest(rows: VentasIdRow[]): Map<string, string> {
  const counts = new Map<string, Map<string, number>>()
  for (const row of rows) {
    const t = row.test?.trim()
    const id = row.id_producto
    if (!t || !id) continue
    if (!counts.has(t)) counts.set(t, new Map())
    const m = counts.get(t)!
    m.set(id, (m.get(id) || 0) + 1)
  }
  const out = new Map<string, string>()
  for (const [test, idMap] of counts) {
    let bestId = ""
    let bestN = 0
    for (const [id, n] of idMap) {
      if (n > bestN) {
        bestN = n
        bestId = id
      }
    }
    if (bestId) out.set(test, bestId)
  }
  return out
}

/**
 * Obtiene `product_id` desde la tabla `ventas` donde `test` coincide con el nombre en `ventas_mensuales_view.producto`.
 * Es la fuente de verdad para el mismo enlace que usa `/productos/[id]`.
 */
async function fetchProductIdMapFromVentasTable(productNames: string[]): Promise<Map<string, string>> {
  const merged = new Map<string, string>()
  const unique = [...new Set(productNames.filter((n) => typeof n === "string" && n.trim().length > 0))]
  if (unique.length === 0) return merged

  const chunkSize = 100
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize)
    const { data, error } = await supabase
      .from("ventas")
      .select("test, id_producto")
      .in("test", chunk)
      .not("id_producto", "is", null)

    if (error) {
      console.warn("fetchProductIdMapFromVentasTable:", error)
      continue
    }
    tallyProductIdByTest(data || []).forEach((id, test) => merged.set(test, id))
  }
  return merged
}

/** Prioriza `product_id` enlazado en `ventas`; si no hay match por id, usa el nombre del catálogo. */
function resolveProductForSale(
  products: Product[],
  saleProducto: string,
  ventasTestToProductId: Map<string, string>
): Product | undefined {
  const idFromVentas = ventasTestToProductId.get(saleProducto)
  if (idFromVentas) {
    const byId = products.find((p) => p.id === idFromVentas)
    if (byId) return byId
  }
  return findProductBySaleName(products, saleProducto)
}

function collectProductIdsFromSaleRows(
  rows: Array<{ producto: string }>,
  products: Product[],
  ventasTestToProductId: Map<string, string>
): string[] {
  const ids = new Set<string>()
  for (const row of rows) {
    const p = resolveProductForSale(products, row.producto, ventasTestToProductId)
    if (p?.id) ids.add(p.id)
  }
  return [...ids]
}

/**
 * PostgREST/Supabase limita por defecto a 1000 filas; con ~1100+ overrides el `select('*')` trunca resultados.
 * Solo cargamos filas de los productos que aparecen en las ventas (o en el catálogo dado).
 */
async function fetchOverridesForProductIds(productIds: string[]): Promise<ProductCountryOverride[]> {
  const unique = [...new Set(productIds.filter(Boolean))]
  if (unique.length === 0) return []
  const chunkSize = 100
  const out: ProductCountryOverride[] = []
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize)
    const { data, error } = await supabase
      .from("product_country_overrides")
      .select("*")
      .in("product_id", chunk)
    if (error) {
      console.warn("fetchOverridesForProductIds:", error)
      continue
    }
    out.push(...(data || []))
  }
  return out
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

  const productIds = (products as Product[]).map((p) => p.id)
  let overrides = await fetchOverridesForProductIds(productIds)
  if (countryCode) {
    overrides = overrides.filter((o) => o.country_code === countryCode)
  }

  // Combinar productos con sus overrides
  const productsWithOverrides = products.map((product: Product) => ({
    ...product,
    country_overrides: overrides.filter((o: ProductCountryOverride) => o.product_id === product.id) || []
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
  const ALL_COUNTRIES = ["UY", "AR", "MX", "CL", "VE", "CO"] as const

  const baseName = input.name.trim()
  if (!baseName) {
    throw new Error('El nombre del producto es obligatorio')
  }

  // Alias requerido por DB: lo generamos a partir del nombre (sin necesidad de input del usuario).
  const generatedAlias = baseName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toUpperCase() || `ALIAS-${Date.now()}`

  // productos.user_id y productos.base_price son NOT NULL, así que deben setearse al insertar.
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    throw new Error('No hay usuario autenticado para crear el producto.')
  }

  const ensureOverridesForAllCountries = async (productId: string) => {
    // La UI muestra productos en cada país solo si existen overrides para ese país.
    // Creamos overrides “vacíos” (pero existentes) para asegurar visibilidad.
    const { data: existingRows, error: ensureError } = await supabase
      .from("product_country_overrides")
      .select("country_code")
      .eq("product_id", productId)
      .eq("channel", "Paciente")

    if (ensureError) throw ensureError

    const existingCountries = new Set((existingRows || []).map((r: any) => r.country_code))
    const missingCountries = ALL_COUNTRIES.filter((c) => !existingCountries.has(c))

    if (!missingCountries.length) return

    const insertRows = missingCountries.map((country_code) => ({
      product_id: productId,
      country_code,
      channel: "Paciente",
      overrides: {},
    }))

    const { error: insertError } = await supabase.from("product_country_overrides").insert(insertRows)
    if (insertError) throw insertError
  }

  // Evitar errores por duplicados: si ya existe el producto con el mismo nombre, lo devolvemos.
  const { data: existing, error: existingError } = await supabase
    .from('products')
    .select('*')
    .eq('name', baseName)
    .maybeSingle()

  if (existingError) throw existingError
  if (existing) {
    const productId = (existing as Product).id
    await ensureOverridesForAllCountries(productId)

    const productWithOverrides = await getProductById(productId)
    if (productWithOverrides) return productWithOverrides

    return {
      ...(existing as Product),
      country_overrides: [],
    }
  }

  const { data, error } = await supabase
    .from('products')
    .insert({
      name: baseName,
      alias: generatedAlias,
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

  const productId = (data as Product).id
  await ensureOverridesForAllCountries(productId)

  const productWithOverrides = await getProductById(productId)
  if (productWithOverrides) return productWithOverrides

  return {
    ...(data as Product),
    country_overrides: [],
  }
}

/**
 * Actualiza los metadatos principales del producto (category y tipo).
 * Estos campos impactan en filtros y en el etiquetado del frontend.
 */
export async function updateProductMeta(
  productId: string,
  input: {
    category?: string | null
    tipo?: string | null
  }
): Promise<ProductWithOverrides | null> {
  const { data, error } = await supabase
    .from("products")
    .update({
      category: input.category ?? null,
      tipo: input.tipo ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", productId)
    .select("*")
    .single()

  if (error) {
    console.error("Error updating product meta:", error)
    throw error
  }

  if (!data) return null
  return getProductById(productId)
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
  'Southgenetics LLC Chile': 'CL',
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
  company?: string | string[],
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

  const normalizedCompany = typeof company === 'string' ? company.trim() : undefined
  const companyList = Array.isArray(company)
    ? company.map((c) => c.trim()).filter(Boolean)
    : null
  const normalizedProduct =
    typeof productName === 'string' ? productName.trim() : undefined
  const normalizedProducts =
    Array.isArray(productName) ? productName.map((p) => p.trim()).filter(Boolean) : undefined

  const filtered = (data as any[]).filter((row) => {
    if (companyList && companyList.length > 0) {
      if (!companyList.includes(row.compañia)) return false
    } else if (normalizedCompany && !isAllCompaniesLabel(normalizedCompany) && row.compañia !== normalizedCompany) {
      return false
    }
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
  company: string | string[],
  periodo?: string,
  productName?: string | string[]
): Promise<MonthlySalesWithProduct[]> {
  let normalizedCompany = ""
  let aggregateMultiCompanies = false

  let query = supabase
    .from('ventas_mensuales_view')
    .select('*')
    .order('cantidad_ventas', { ascending: false })

  if (Array.isArray(company)) {
    const list = company.map((c) => c.trim()).filter(Boolean)
    if (list.length === 0) return []
    if (list.length === 1) {
      normalizedCompany = list[0]
      if (!isAllCompaniesLabel(normalizedCompany)) {
        query = query.eq('compañia', normalizedCompany)
      }
    } else {
      aggregateMultiCompanies = true
      query = query.in('compañia', list)
      normalizedCompany = list.join(", ")
    }
  } else {
    normalizedCompany = company.trim()
    if (!isAllCompaniesLabel(normalizedCompany)) {
      query = query.eq('compañia', normalizedCompany)
    }
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

  const saleProductNames = [...new Set((sales as { producto: string }[]).map((s) => s.producto).filter(Boolean))]
  const ventasTestToProductId = await fetchProductIdMapFromVentasTable(saleProductNames)
  
  // Debug: verificar resultados
  console.log(`📊 getMonthlySales: ${sales.length} ventas para ${normalizedCompany} - ${periodo || 'todos los períodos'}`)

  // Obtener productos para hacer join
  const { data: products } = await supabase
    .from('products')
    .select('id, name, alias, category, tipo')

  const productIdsForOverrides = collectProductIdsFromSaleRows(
    sales as { producto: string }[],
    products || [],
    ventasTestToProductId
  )
  const overrides = await fetchOverridesForProductIds(productIdsForOverrides)

  // Mapear compañía a país
  const companyToCountry: Record<string, 'UY' | 'AR' | 'MX' | 'CL' | 'VE' | 'CO'> = {
    'SouthGenetics LLC': 'UY',
    'SouthGenetics LLC Uruguay': 'UY',
    'SouthGenetics LLC Argentina': 'AR',
    'SouthGenetics LLC Arge': 'AR',
    'Southgenetics LLC Chile': 'CL',
    'SouthGenetics LLC Colombia': 'CO',
    'SouthGenetics LLC México': 'MX',
    'SouthGenetics LLC Venezuela': 'VE',
  }

  const isAllCompanies = !aggregateMultiCompanies && isAllCompaniesLabel(normalizedCompany)
  const shouldAggregateCompanies = isAllCompanies || aggregateMultiCompanies

  if (shouldAggregateCompanies) {
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
      const product = resolveProductForSale(products || [], sale.producto, ventasTestToProductId)
      const productOverrides = pickOverrideAllCompaniesFirst(overrides || [], product?.id || "")
      
      // Recalcular precio promedio
      if (sale.cantidad_ventas > 0 && sale.monto_total) {
        sale.precio_promedio = sale.monto_total / sale.cantidad_ventas
      }
      
      return {
        ...sale,
        product_id: product?.id,
        alias: (product as any)?.alias || null,
        category: product?.category || null,
        tipo: product?.tipo || null,
        overrides: productOverrides?.overrides,
      } as MonthlySalesWithProduct
    })
  }
  
  // Si no es "Todas las compañías", comportamiento normal
  return sales.map((sale: MonthlySales) => {
    const product = resolveProductForSale(products || [], sale.producto, ventasTestToProductId)
    const saleCompany = sale.compañia
    const saleCountryCode = companyToCountry[saleCompany] || 'UY'
    const productOverrides = product?.id
      ? pickOverrideForCountry(overrides || [], product.id, saleCountryCode)
      : undefined

    return {
      ...sale,
      product_id: product?.id,
      alias: (product as any)?.alias || null,
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
export async function getAvailablePeriods(company: string | string[]): Promise<string[]> {
  let query = supabase
    .from('ventas_mensuales_view')
    .select('periodo')
    .order('periodo', { ascending: true }) // ✅ Cambiado a true para orden ascendente

  let logLabel = ""
  if (Array.isArray(company)) {
    const list = company.map((c) => c.trim()).filter(Boolean)
    logLabel = list.join(", ")
    if (list.length === 0) return []
    if (list.length === 1) {
      const only = list[0]
      if (!isAllCompaniesLabel(only)) {
        query = query.eq('compañia', only)
      }
    } else {
      query = query.in('compañia', list)
    }
  } else {
    const normalizedCompany = company.trim()
    logLabel = normalizedCompany
    if (!isAllCompaniesLabel(normalizedCompany)) {
      query = query.eq('compañia', normalizedCompany)
    }
  }

  const { data, error } = await query

  if (error) {
    console.error('Error en getAvailablePeriods:', { error, company: logLabel })
    throw error
  }
  if (!data) {
    console.warn(`⚠️ No se encontraron períodos para: ${logLabel}`)
    return []
  }

  const uniquePeriods: string[] = Array.from(
    new Set(
      (data as any[])
        .map((item: any) => item?.periodo)
        .filter((p: any) => typeof p === "string" && p.trim().length > 0)
    )
  )

  console.log(`📅 Períodos encontrados para ${logLabel}:`, uniquePeriods)
  
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
  company: string | string[],
  productName?: string | string[]
): Promise<MonthlySalesWithProduct[]> {
  let normalizedCompany = ""
  let aggregateMultiCompanies = false

  let query = supabase
    .from('ventas_mensuales_view')
    .select('producto, compañia, cantidad_ventas, monto_total, año')

  if (Array.isArray(company)) {
    const list = company.map((c) => c.trim()).filter(Boolean)
    if (list.length === 0) return []
    if (list.length === 1) {
      normalizedCompany = list[0]
      if (!isAllCompaniesLabel(normalizedCompany)) {
        query = query.eq('compañia', normalizedCompany)
      }
    } else {
      aggregateMultiCompanies = true
      query = query.in('compañia', list)
      normalizedCompany = list.join(", ")
    }
  } else {
    normalizedCompany = company.trim()
    if (!isAllCompaniesLabel(normalizedCompany)) {
      query = query.eq('compañia', normalizedCompany)
    }
  }

  if (Array.isArray(productName) && productName.length > 0) {
    query = query.in('producto', productName)
  } else if (typeof productName === 'string' && productName !== 'Todos') {
    query = query.eq('producto', productName)
  }

  const { data: sales, error } = await query

  if (error) throw error
  if (!sales) return []

  const isAllCompanies = !aggregateMultiCompanies && isAllCompaniesLabel(normalizedCompany)
  const shouldAggregateCompanies = isAllCompanies || aggregateMultiCompanies
  type SaleRow = { producto: string; compañia: string; cantidad_ventas: number; monto_total: number | null; año: number }
  type CompanyBreakdownItem = { compañia: string; cantidad_ventas: number; monto_total: number | null }

  // Agregar por producto y año (para mostrar totales correctos por caja anual)
  const aggregated = sales.reduce((acc: MonthlySalesWithProduct[], sale: SaleRow) => {
    const existing = acc.find((item: MonthlySalesWithProduct) => item.producto === sale.producto && item.año === sale.año)
    if (existing) {
      existing.cantidad_ventas += sale.cantidad_ventas
      existing.monto_total = (existing.monto_total || 0) + (sale.monto_total || 0)
      
      if (shouldAggregateCompanies) {
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
        año: sale.año,
        periodo: `Total ${sale.año}`,
        precio_promedio: null,
        ...(shouldAggregateCompanies ? { companyBreakdown: [{ compañia: sale.compañia, cantidad_ventas: sale.cantidad_ventas, monto_total: sale.monto_total || 0 }] } : {}),
      }
      acc.push(newItem)
    }
    return acc
  }, [] as MonthlySalesWithProduct[])

  const annualProductNames = Array.from(
    new Set(
      (aggregated as MonthlySalesWithProduct[])
        .map((row: MonthlySalesWithProduct) => String(row.producto ?? "").trim())
        .filter((name: string) => name.length > 0)
    )
  )
  const ventasTestToProductId = await fetchProductIdMapFromVentasTable(annualProductNames)

  // Obtener productos para join
  const { data: products } = await supabase
    .from('products')
    .select('id, name, category, tipo')

  const productIdsForOverrides = collectProductIdsFromSaleRows(
    aggregated as { producto: string }[],
    products || [],
    ventasTestToProductId
  )
  const overrides = await fetchOverridesForProductIds(productIdsForOverrides)

  const companyToCountry: Record<string, 'UY' | 'AR' | 'MX' | 'CL' | 'VE' | 'CO'> = {
    'SouthGenetics LLC': 'UY',
    'SouthGenetics LLC Uruguay': 'UY',
    'SouthGenetics LLC Argentina': 'AR',
    'SouthGenetics LLC Arge': 'AR',
    'Southgenetics LLC Chile': 'CL',
    'SouthGenetics LLC Colombia': 'CO',
    'SouthGenetics LLC México': 'MX',
    'SouthGenetics LLC Venezuela': 'VE',
  }

  const countryCode = shouldAggregateCompanies ? null : (companyToCountry[normalizedCompany] || 'UY')

  // Combinar datos
  return aggregated.map((sale: MonthlySalesWithProduct) => {
    const product = resolveProductForSale(products || [], sale.producto, ventasTestToProductId)
    const productOverrides = shouldAggregateCompanies
      ? pickOverrideAllCompaniesFirst(overrides || [], product?.id || "")
      : product?.id && countryCode
        ? pickOverrideForCountry(overrides || [], product.id, countryCode)
        : undefined

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
  company: string | string[],
  year?: string,
  month?: string,
  productName?: string | string[],
  channel?: string,
  monthRange?: { from: number; to: number }
): Promise<DashboardProduct[]> {
  let normalizedSingle: string | null = null
  let multiIn: string[] | null = null
  let isAllCompanies = false

  let query = supabase
    .from('ventas_mensuales_view')
    .select('producto, compañia, cantidad_ventas, monto_total, mes, año, periodo')

  if (Array.isArray(company)) {
    const list = company.map((c) => c.trim()).filter(Boolean)
    if (list.length === 0) return []
    if (list.length === 1) {
      normalizedSingle = list[0]
      isAllCompanies = isAllCompaniesLabel(normalizedSingle)
      if (!isAllCompanies) {
        query = query.eq('compañia', normalizedSingle)
      }
    } else {
      multiIn = list
      query = query.in('compañia', list)
    }
  } else {
    normalizedSingle = company.trim()
    isAllCompanies = isAllCompaniesLabel(normalizedSingle)
    if (!isAllCompanies) {
      query = query.eq('compañia', normalizedSingle)
    }
  }

  if (year && year !== "Todos") {
    query = query.eq('año', parseInt(year))
  }

  if (monthRange && monthRange.from >= 1 && monthRange.to >= 1) {
    const a = Math.min(monthRange.from, monthRange.to)
    const b = Math.max(monthRange.from, monthRange.to)
    query = query.gte('mes', a).lte('mes', b)
  } else if (month && month !== "Todos") {
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

  const ventasTestToProductId = await fetchProductIdMapFromVentasTable([...productMap.keys()])
  
  // Obtener productos y overrides
  const { data: products } = await supabase
    .from('products')
    .select('id, name, category, tipo')

  const productIdsForOverrides = collectProductIdsFromSaleRows(
    Array.from(productMap.values()) as { producto: string }[],
    products || [],
    ventasTestToProductId
  )
  const overrides = await fetchOverridesForProductIds(productIdsForOverrides)
  
  const companyToCountry: Record<string, 'UY' | 'AR' | 'MX' | 'CL' | 'VE' | 'CO'> = {
    'SouthGenetics LLC': 'UY',
    'SouthGenetics LLC Uruguay': 'UY',
    'SouthGenetics LLC Argentina': 'AR',
    'SouthGenetics LLC Arge': 'AR',
    'Southgenetics LLC Chile': 'CL',
    'SouthGenetics LLC Colombia': 'CO',
    'SouthGenetics LLC México': 'MX',
    'SouthGenetics LLC Venezuela': 'VE',
  }
  
  // Calcular métricas para cada producto
  const dashboardProducts: DashboardProduct[] = []
  
  Array.from(productMap.values()).forEach((product: ProductAgg) => {
    const productInfo = resolveProductForSale(products || [], product.producto, ventasTestToProductId)

    const countryCode =
      isAllCompanies || multiIn
        ? null
        : (normalizedSingle ? companyToCountry[normalizedSingle] || 'UY' : null)

    const matchesChannel = (o: ProductCountryOverride) => {
      if (!channel || channel === 'Todos los canales') return true
      return (o.channel || 'Paciente') === channel
    }

    const productOverrideCandidates = (overrides || []).filter((o: ProductCountryOverride) => {
      if (o.product_id !== productInfo?.id) return false
      if (countryCode !== null && o.country_code !== countryCode) return false
      return matchesChannel(o)
    })
    const productOverride =
      productOverrideCandidates.find((o: ProductCountryOverride) => (o.channel || 'Paciente') === 'Paciente') ??
      productOverrideCandidates[0]
    
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
  company: string | string[],
  year?: string,
  month?: string,
  productName?: string | string[],
  channel?: string,
  limit: number = 10,
  monthRange?: { from: number; to: number }
): Promise<DashboardProduct[]> {
  const products = await getProductsWithMetrics(company, year, month, productName, channel, monthRange)
  
  // Ordenar por cantidad de ventas y limitar
  return products
    .sort((a, b) => b.cantidad_ventas - a.cantidad_ventas)
    .slice(0, limit)
}

/**
 * Obtiene los productos con mayor margen de ganancia para el dashboard
 */
export async function getTopMarginProducts(
  company: string | string[],
  year?: string,
  month?: string,
  productName?: string | string[],
  channel?: string,
  limit: number = 10,
  monthRange?: { from: number; to: number }
): Promise<DashboardProduct[]> {
  const products = await getProductsWithMetrics(company, year, month, productName, channel, monthRange)
  
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
  company: string | string[],
  year?: string,
  month?: string,
  productName?: string | string[],
  channel?: string,
  limit: number = 10,
  monthRange?: { from: number; to: number }
): Promise<DashboardProduct[]> {
  const products = await getProductsWithMetrics(company, year, month, productName, channel, monthRange)
  
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
  company: string | string[],
  year?: string,
  month?: string,
  productName?: string | string[],
  channel?: string,
  limit: number = 10,
  monthRange?: { from: number; to: number }
): Promise<DashboardProduct[]> {
  const products = await getProductsWithMetrics(company, year, month, productName, channel, monthRange)
  
  // Ordenar por grossSalesUSD (precio unitario) descendente
  return products
    .sort((a, b) => {
      const priceA = a.overrides?.grossSalesUSD || 0
      const priceB = b.overrides?.grossSalesUSD || 0
      return priceB - priceA
    })
    .slice(0, limit)
}
