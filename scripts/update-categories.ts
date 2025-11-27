import { createClient } from '@supabase/supabase-js'
import { Database } from '../src/types/database'
import { getCategoryFromProductName, PRODUCT_CATEGORIES } from '../src/lib/categories'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Faltan variables de entorno de Supabase')
  console.error('Requeridas: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function updateProductCategories() {
  console.log('🔄 Iniciando actualización de categorías de productos...\n')

  try {
    // Obtener todos los productos
    console.log('📦 Obteniendo todos los productos...')
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, name, category')

    if (productsError) {
      throw productsError
    }

    if (!products || products.length === 0) {
      console.log('⚠️  No se encontraron productos en la base de datos.')
      return
    }

    console.log(`✅ Se encontraron ${products.length} productos\n`)

    // Estadísticas
    let updatedCount = 0
    let unchangedCount = 0
    let errorsCount = 0
    const categoryStats: Record<string, number> = {}

    // Procesar cada producto
    for (const product of products) {
      try {
        // Determinar la categoría basándose en el nombre del producto
        const newCategory = getCategoryFromProductName(product.name)

        // Si la categoría es la misma, no actualizar
        if (product.category === newCategory) {
          unchangedCount++
          if (newCategory) {
            categoryStats[newCategory] = (categoryStats[newCategory] || 0) + 1
          }
          continue
        }

        // Actualizar el producto
        const { error: updateError } = await supabase
          .from('products')
          .update({ category: newCategory })
          .eq('id', product.id)

        if (updateError) {
          console.error(`❌ Error actualizando producto "${product.name}":`, updateError.message)
          errorsCount++
          continue
        }

        updatedCount++
        if (newCategory) {
          categoryStats[newCategory] = (categoryStats[newCategory] || 0) + 1
        }

        console.log(`✅ Actualizado: "${product.name}" → ${newCategory || 'Sin categoría'}`)
      } catch (error: any) {
        console.error(`❌ Error procesando producto "${product.name}":`, error.message)
        errorsCount++
      }
    }

    // Mostrar resumen
    console.log('\n' + '='.repeat(50))
    console.log('📊 RESUMEN DE ACTUALIZACIÓN')
    console.log('='.repeat(50))
    console.log(`✅ Productos actualizados: ${updatedCount}`)
    console.log(`⏭️  Productos sin cambios: ${unchangedCount}`)
    console.log(`❌ Errores: ${errorsCount}`)
    console.log(`📦 Total procesado: ${products.length}`)
    
    console.log('\n📋 DISTRIBUCIÓN POR CATEGORÍA:')
    const sortedCategories = Object.entries(categoryStats)
      .sort((a, b) => b[1] - a[1])
    
    for (const [category, count] of sortedCategories) {
      console.log(`  ${category}: ${count}`)
    }

    // Mostrar productos sin categoría
    const { data: uncategorized } = await supabase
      .from('products')
      .select('name')
      .is('category', null)

    if (uncategorized && uncategorized.length > 0) {
      console.log(`\n⚠️  Productos sin categoría (${uncategorized.length}):`)
      uncategorized.forEach(p => console.log(`  - ${p.name}`))
    }

    console.log('\n🎉 Actualización completada!')

  } catch (error) {
    console.error('❌ Error durante la actualización:', error)
    process.exit(1)
  }
}

updateProductCategories()

