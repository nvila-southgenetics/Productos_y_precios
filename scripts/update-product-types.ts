import { createClient } from '@supabase/supabase-js'
import { Database } from '../src/types/database'
import { getTypeFromProductName } from '../src/lib/categories'

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

async function updateProductTypes() {
  console.log('🔄 Obteniendo productos de la base de datos...')
  
  const { data: products, error: fetchError } = await supabase
    .from('products')
    .select('id, name, tipo')
  
  if (fetchError) {
    console.error('❌ Error obteniendo productos:', fetchError)
    process.exit(1)
  }
  
  if (!products || products.length === 0) {
    console.log('ℹ️ No hay productos para actualizar')
    return
  }
  
  console.log(`📦 Encontrados ${products.length} productos`)
  console.log('🔄 Actualizando tipos de muestra...\n')
  
  let updated = 0
  let skipped = 0
  let errors = 0
  
  for (const product of products) {
    try {
      const newType = getTypeFromProductName(product.name)
      
      // Solo actualizar si el tipo es diferente o si no tiene tipo
      if (newType !== product.tipo) {
        const { error: updateError } = await supabase
          .from('products')
          .update({ tipo: newType })
          .eq('id', product.id)
        
        if (updateError) {
          console.error(`❌ Error actualizando ${product.name}:`, updateError.message)
          errors++
        } else {
          console.log(`✅ ${product.name}: ${product.tipo || 'sin tipo'} → ${newType || 'sin tipo'}`)
          updated++
        }
      } else {
        console.log(`⏭️  ${product.name}: ya tiene el tipo correcto (${product.tipo || 'sin tipo'})`)
        skipped++
      }
    } catch (error) {
      console.error(`❌ Error procesando ${product.name}:`, error)
      errors++
    }
  }
  
  console.log('\n📊 Resumen:')
  console.log(`   ✅ Actualizados: ${updated}`)
  console.log(`   ⏭️  Omitidos: ${skipped}`)
  console.log(`   ❌ Errores: ${errors}`)
  console.log('\n✨ Proceso completado')
}

updateProductTypes()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error fatal:', error)
    process.exit(1)
  })
