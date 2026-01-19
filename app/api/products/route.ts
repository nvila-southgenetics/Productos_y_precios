import { NextResponse } from 'next/server'
import { mcp_supabase_del_work_execute_sql } from '@/types/mcp'

const PROJECT_ID = 'cdrmxjcdgxjyakrcpxnp'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const countryCode = searchParams.get('country') || null

    let query = `
      SELECT 
        p.id,
        p.name,
        p.sku,
        p.description,
        p.category,
        p.tipo,
        p.created_at,
        p.user_id,
        COALESCE(
          json_agg(
            json_build_object(
              'id', pco.id,
              'product_id', pco.product_id,
              'country_code', pco.country_code,
              'overrides', pco.overrides,
              'created_at', pco.created_at,
              'updated_at', pco.updated_at
            )
          ) FILTER (WHERE pco.id IS NOT NULL),
          '[]'::json
        ) as country_overrides
      FROM products p
      LEFT JOIN product_country_overrides pco ON p.id = pco.product_id
      ${countryCode ? `WHERE pco.country_code = '${countryCode}'` : ''}
      GROUP BY p.id, p.name, p.sku, p.description, p.category, p.tipo, p.created_at, p.user_id
      ORDER BY p.created_at DESC
    `

    // Nota: En producción, esto debería usar el cliente de Supabase normal
    // El MCP solo está disponible en el contexto del asistente
    // Por ahora, retornamos un error indicando que se debe usar el cliente de Supabase
    return NextResponse.json(
      { error: 'Use Supabase client directly in production' },
      { status: 501 }
    )
  } catch (error) {
    console.error('Error fetching products:', error)
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    )
  }
}



