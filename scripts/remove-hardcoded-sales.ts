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

async function removeHardcodedSales() {
  console.log('🗑️  Eliminando ventas hardcodeadas de Noviembre 2025 en Argentina...')

  try {
    // Eliminar ventas de noviembre 2025 en Argentina
    const { data, error } = await supabase
      .from('sales')
      .delete()
      .eq('country_code', 'AR')
      .eq('year', 2025)
      .eq('month', 11)

    if (error) {
      throw error
    }

    console.log('✅ Ventas de Noviembre 2025 en Argentina eliminadas exitosamente')
    // Nota: El método delete() de Supabase no retorna los registros eliminados en data
    // Por lo tanto, no podemos mostrar la cantidad exacta de registros eliminados

  } catch (error) {
    console.error('❌ Error eliminando ventas:', error)
    process.exit(1)
  }
}

removeHardcodedSales()

