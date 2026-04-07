import { NextResponse } from 'next/server'
import { createClient as createServerSupabaseClient } from '@/lib/supabase/server'

function safeSlugAlias(input: string) {
  const base = (input || '').trim()
  const slug = base
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toUpperCase()
  return slug || `ALIAS-${Date.now()}`
}

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    const body = await request.json()
    const {
      productIds,
      name,
      category,
      tipo,
      costBaseProductId,
    }: {
      productIds: string[]
      name: string
      category?: string | null
      tipo?: string | null
      costBaseProductId?: string
    } = body

    if (!productIds || productIds.length < 2) {
      return NextResponse.json(
        { error: 'Se requieren al menos 2 productos para fusionar.' },
        { status: 400 }
      )
    }

    const trimmedName = (name || '').trim()
    if (!trimmedName) {
      return NextResponse.json(
        { error: 'El nombre del producto fusionado es obligatorio.' },
        { status: 400 }
      )
    }

    // Debe existir usuario autenticado (RLS)
    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError) {
      console.error('Error obteniendo usuario para fusión:', authError)
      return NextResponse.json({ error: 'No se pudo validar la sesión del usuario.' }, { status: 401 })
    }
    if (!authData.user) {
      return NextResponse.json({ error: 'Usuario no autenticado.' }, { status: 401 })
    }

    // Para cumplir NOT NULL en products (ej: base_price, currency), copiamos del producto base.
    const baseIdForRequiredFields = costBaseProductId || productIds[0]
    const { data: baseProductRow, error: baseProductError } = await supabase
      .from('products')
      .select('base_price, currency, description')
      .eq('id', baseIdForRequiredFields)
      .single()

    if (baseProductError || !baseProductRow) {
      console.error('Error leyendo producto base para fusionar:', baseProductError)
      return NextResponse.json(
        { error: 'No se pudo leer el producto base para crear el producto fusionado.' },
        { status: 500 }
      )
    }

    // Asegurar que base_price exista; si viene undefined, supabase-js omite el campo y termina en NULL.
    if (baseProductRow.base_price === null || baseProductRow.base_price === undefined) {
      return NextResponse.json(
        { error: 'El producto base no tiene base_price válido; no se puede crear el producto fusionado.' },
        { status: 400 }
      )
    }

    const initialAlias = `${safeSlugAlias(trimmedName)}-${Date.now().toString().slice(-6)}`

    // 1) Crear el nuevo producto base
    const insertPayload = (aliasToUse: string) => ({
      name: trimmedName,
      alias: aliasToUse,
      category: category ?? null,
      tipo: tipo ?? null,
      // Campos requeridos por schema
      currency: baseProductRow.currency,
      base_price: baseProductRow.base_price,
      // Mantener una descripción por defecto (puede cambiarse luego)
      description: baseProductRow.description ?? null,
    })

    let newProduct: any | null = null
    let createError: any | null = null

    // Intento 1 con SKU inicial
    {
      const res = await supabase.from('products').insert(insertPayload(initialAlias)).select('*').single()
      newProduct = res.data
      createError = res.error
    }

    // Si el SKU ya existe, reintentar una vez con sufijo nuevo
    if (createError?.code === '23505') {
      const retryAlias = `${initialAlias}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
      const res2 = await supabase.from('products').insert(insertPayload(retryAlias)).select('*').single()
      newProduct = res2.data
      createError = res2.error
    }

    if (createError || !newProduct) {
      console.error('Error creando producto fusionado:', createError)
      const msg =
        createError?.code === '23505'
          ? 'No se pudo crear el producto fusionado porque el alias ya existe (incluso tras reintentar).'
          : 'No se pudo crear el producto fusionado.'
      return NextResponse.json({ error: msg }, { status: 500 })
    }

    const newProductId = newProduct.id

    // 2) Reasignar ventas (tabla ventas.id_producto) y normalizar el nombre textual (ventas.test)
    // Nota: ventas_mensuales_view agrupa por `test`, por eso es importante mantenerlo consistente.
    const { data: updatedVentas, error: ventasError } = await supabase
      .from('ventas')
      .update({ id_producto: newProductId, test: trimmedName })
      .in('id_producto', productIds)
      .select('id')

    if (ventasError) {
      console.error('Error al reasignar ventas en fusión de productos:', ventasError)
      return NextResponse.json(
        { error: 'No se pudieron reasignar las ventas.' },
        { status: 500 }
      )
    }

    const ventasReasignadas = updatedVentas?.length ?? 0

    // 3) Reasignar budgets (tabla budget.product_id, y opcionalmente product_name)
    const { data: updatedBudget, error: budgetError } = await supabase
      .from('budget')
      .update({ product_id: newProductId, product_name: trimmedName })
      .in('product_id', productIds)
      .select('id')

    if (budgetError) {
      console.error('Error al reasignar budgets en fusión de productos:', budgetError)
      return NextResponse.json(
        { error: 'No se pudieron reasignar los budgets.' },
        { status: 500 }
      )
    }

    const budgetsReasignados = updatedBudget?.length ?? 0

    // 4) Reasignar TODOS los overrides al nuevo producto.
    // Nota: la tabla tiene unicidad por (product_id, country_code, channel) (y además config types),
    // así que si hay más de un producto con overrides para el mismo country+channel,
    // debemos elegir un "ganador" y eliminar el resto antes de finalizar.
    const overridesKey = (o: {
      country_code: string | null
      channel: string | null
      mx_config_type?: string | null
      cl_config_type?: string | null
      col_config_type?: string | null
    }) =>
      [
        String(o.country_code || ''),
        String(o.channel || 'Paciente'),
        String(o.mx_config_type || ''),
        String(o.cl_config_type || ''),
        String(o.col_config_type || ''),
      ].join('|')

    const { data: allOverrides, error: overridesFetchError } = await supabase
      .from('product_country_overrides')
      .select('id, product_id, country_code, channel, mx_config_type, cl_config_type, col_config_type')
      .in('product_id', productIds)

    if (overridesFetchError) {
      console.error('Error leyendo product_country_overrides en fusión:', overridesFetchError)
      return NextResponse.json(
        { error: 'El nuevo producto fue creado, pero hubo un error al leer los overrides de costos.' },
        { status: 500 }
      )
    }

    const overrides = (allOverrides || []) as any[]
    const baseForConflicts = costBaseProductId || baseIdForRequiredFields

    const winnersByKey = new Map<string, any>()
    const losers: any[] = []

    // Elegir ganadores: preferir el costBaseProductId cuando hay conflicto.
    // Si no hay base, elegir el primero que aparezca (estable).
    for (const o of overrides) {
      const key = overridesKey(o)
      const existing = winnersByKey.get(key)
      if (!existing) {
        winnersByKey.set(key, o)
        continue
      }
      const existingIsBase = existing.product_id === baseForConflicts
      const candidateIsBase = o.product_id === baseForConflicts
      if (!existingIsBase && candidateIsBase) {
        losers.push(existing)
        winnersByKey.set(key, o)
      } else {
        losers.push(o)
      }
    }

    const winnerIds = Array.from(winnersByKey.values()).map((o) => o.id)
    const loserIds = losers.map((o) => o.id)

    // Mover ganadores al nuevo product_id (normalizando channel null -> 'Paciente' para consistencia).
    // Hacemos updates por id para no tocar otras filas.
    let overridesReasignados = 0
    for (const o of winnersByKey.values()) {
      const { data: moved, error: moveError } = await supabase
        .from('product_country_overrides')
        .update({ product_id: newProductId, channel: o.channel ?? 'Paciente' })
        .eq('id', o.id)
        .select('id')

      if (moveError) {
        console.error('Error reasignando override en fusión:', moveError)
        return NextResponse.json(
          { error: 'El nuevo producto fue creado, pero hubo un error al reasignar los overrides de costos.' },
          { status: 500 }
        )
      }
      overridesReasignados += moved?.length ?? 0
    }

    // Eliminar overrides en conflicto (perdedores).
    let overridesEliminadosPorConflicto = 0
    if (loserIds.length) {
      const { data: deletedLosers, error: delLosersError } = await supabase
        .from('product_country_overrides')
        .delete()
        .in('id', loserIds)
        .select('id')

      if (delLosersError) {
        console.error('Error eliminando overrides en conflicto:', delLosersError)
        return NextResponse.json(
          { error: 'El nuevo producto fue creado, pero hubo un error al eliminar overrides en conflicto.' },
          { status: 500 }
        )
      }
      overridesEliminadosPorConflicto = deletedLosers?.length ?? 0
    }

    // 5) Eliminar productos originales y cualquier override remanente (ya reasignamos ventas/budgets y movimos costos).
    const idsToRemove = productIds.filter((id) => id !== newProductId)
    if (idsToRemove.length > 0) {
      const { error: delOverridesError } = await supabase
        .from('product_country_overrides')
        .delete()
        .in('product_id', idsToRemove)

      if (delOverridesError) {
        console.error('Error eliminando overrides de productos fusionados:', delOverridesError)
        return NextResponse.json(
          { error: 'El nuevo producto fue creado, pero hubo un error al limpiar los overrides de los productos fusionados.' },
          { status: 500 }
        )
      }

      const { error: delProductsError } = await supabase
        .from('products')
        .delete()
        .in('id', idsToRemove)

      if (delProductsError) {
        console.error('Error eliminando productos fusionados originales:', delProductsError)
        return NextResponse.json(
          { error: 'El nuevo producto fue creado, pero hubo un error al eliminar los productos fusionados originales.' },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({
      newProductId,
      mergedProduct: {
        name: trimmedName,
        alias: newProduct.alias,
        category: newProduct.category,
        tipo: newProduct.tipo,
      },
      stats: {
        ventasReasignadas,
        budgetsReasignados,
        overridesReasignados,
        overridesEliminadosPorConflicto,
        overrideKeysReasignadas: winnersByKey.size,
        overrideConflictos: loserIds.length,
      },
    })
  } catch (error) {
    console.error('Error en POST /api/products/merge:', error)
    return NextResponse.json(
      { error: 'Error interno al fusionar productos.' },
      { status: 500 }
    )
  }
}

