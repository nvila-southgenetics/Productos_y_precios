import { createClient } from '@supabase/supabase-js'
import { Database } from '../src/types/database'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables')
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function seedDatabase() {
  console.log('🌱 Iniciando seed de la base de datos...')

  try {
    // Obtener el primer usuario de la base de datos
    console.log('👤 Obteniendo usuario...')
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers()

    if (usersError) {
      throw usersError
    }

    if (!users || users.users.length === 0) {
      console.error('❌ No hay usuarios en la base de datos.')
      console.error('Por favor, crea un usuario primero registrándote en la aplicación.')
      console.error('Luego ejecuta el seed nuevamente.')
      process.exit(1)
    }

    const userId = users.users[0].id
    console.log(`✅ Usuario encontrado: ${users.users[0].email}`)

    // Crear productos de ejemplo
    console.log('📦 Creando productos de ejemplo...')
    
    const products = [
      {
        name: 'Onco Básico',
        sku: 'ONCO-001',
        description: 'Panel básico de oncología con análisis genético fundamental',
        base_price: 4000,
        currency: 'USD',
        user_id: userId
      },
      {
        name: 'Onco Plus',
        sku: 'ONCO-002',
        description: 'Panel avanzado de oncología con análisis completo y seguimiento',
        base_price: 6000,
        currency: 'USD',
        user_id: userId
      },
      {
        name: 'NIPT',
        sku: 'NIPT-001',
        description: 'Prueba prenatal no invasiva para detección de anomalías cromosómicas',
        base_price: 300,
        currency: 'USD',
        user_id: userId
      }
    ]

    const { data: insertedProducts, error: productsError } = await supabase
      .from('products')
      .insert(products)
      .select()

    if (productsError) {
      throw productsError
    }

    console.log(`✅ ${insertedProducts.length} productos creados`)

    // Crear overrides de ejemplo para México
    console.log('🇲🇽 Creando overrides para México...')
    
    const mexicoOverrides = [
      {
        product_id: insertedProducts[0].id, // Onco Básico
        country_code: 'MX',
        overrides: {
          salesCommissionPct: 0.07, // 7% de comisión
          externalCourierUSD: 25,   // $25 USD courrier internacional
          kitCostUSD: 15            // $15 USD costo del kit
        }
      },
      {
        product_id: insertedProducts[1].id, // Onco Plus
        country_code: 'MX',
        overrides: {
          salesCommissionPct: 0.06, // 6% de comisión
          externalCourierUSD: 30,   // $30 USD courrier internacional
          kitCostUSD: 20            // $20 USD costo del kit
        }
      },
      {
        product_id: insertedProducts[2].id, // NIPT
        country_code: 'MX',
        overrides: {
          salesCommissionPct: 0.05, // 5% de comisión
          externalCourierUSD: 15,   // $15 USD courrier internacional
          kitCostUSD: 8             // $8 USD costo del kit
        }
      }
    ]

    const { error: overridesError } = await supabase
      .from('product_country_overrides')
      .insert(mexicoOverrides)

    if (overridesError) {
      throw overridesError
    }

    console.log('✅ Overrides para México creados')

    // Crear overrides de ejemplo para Argentina
    console.log('🇦🇷 Creando overrides para Argentina...')
    
    const argentinaOverrides = [
      {
        product_id: insertedProducts[0].id, // Onco Básico
        country_code: 'AR',
        overrides: {
          salesCommissionPct: 0.05, // 5% de comisión
          externalCourierUSD: 20,   // $20 USD courrier internacional
          kitCostUSD: 12            // $12 USD costo del kit
        }
      },
      {
        product_id: insertedProducts[1].id, // Onco Plus
        country_code: 'AR',
        overrides: {
          salesCommissionPct: 0.04, // 4% de comisión
          externalCourierUSD: 25,   // $25 USD courrier internacional
          kitCostUSD: 18            // $18 USD costo del kit
        }
      }
    ]

    const { error: arOverridesError } = await supabase
      .from('product_country_overrides')
      .insert(argentinaOverrides)

    if (arOverridesError) {
      throw arOverridesError
    }

    console.log('✅ Overrides para Argentina creados')

    console.log('🎉 Seed completado exitosamente!')
    console.log('\n📋 Resumen:')
    console.log(`- ${insertedProducts.length} productos creados`)
    console.log('- Overrides configurados para México y Argentina')
    console.log('\n🚀 Puedes iniciar la aplicación con: pnpm dev')

  } catch (error) {
    console.error('❌ Error durante el seed:', error)
    process.exit(1)
  }
}

seedDatabase()
