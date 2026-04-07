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

    // 4) Copiar cálculo de costos completo desde el producto base seleccionado
    if (costBaseProductId) {
      const { data: baseOverrides, error: baseOverridesError } = await supabase
        .from('product_country_overrides')
        .select('country_code, channel, overrides')
        .eq('product_id', costBaseProductId)

      if (baseOverridesError) {
        console.error('Error leyendo overrides base en fusión de productos:', baseOverridesError)
        return NextResponse.json(
          { error: 'El nuevo producto fue creado, pero hubo un error al leer el cálculo de costos base.' },
          { status: 500 }
        )
      }

      if (baseOverrides && baseOverrides.length > 0) {
        const overridesToInsert = baseOverrides.map((o: any) => ({
          product_id: newProductId,
          country_code: o.country_code,
          channel: o.channel ?? 'Paciente',
          overrides: o.overrides,
        }))

        const { error: overridesError } = await supabase
          .from('product_country_overrides')
          .insert(overridesToInsert)

        if (overridesError) {
          console.error('Error al copiar overrides de costos en fusión de productos:', overridesError)
          return NextResponse.json(
            { error: 'El nuevo producto fue creado, pero hubo un error al copiar el cálculo de costos.' },
            { status: 500 }
          )
        }
      }
    }

    // 5) Eliminar productos originales y sus overrides (ya reasignamos ventas/budgets y copiamos costos).
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

