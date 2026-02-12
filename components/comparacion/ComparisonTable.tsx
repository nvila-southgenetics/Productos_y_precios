'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';

interface ComparisonRow {
  country: string;
  country_code: string;
  product_name: string;
  product_id: string | null;
  budget2026: number;
  real2025: number;
  real2026: number;
  difference: number;
  growthPercent: number;
}

interface ComparisonTableProps {
  month: string;
  country: string;
  product: string;
}

const MONTH_KEYS = [
  'jan', 'feb', 'mar', 'apr', 'may', 'jun',
  'jul', 'aug', 'sep', 'oct', 'nov', 'dec'
];

// Mapeo de compañías a códigos de país
const companyToCountry: Record<string, string> = {
  'SouthGenetics LLC': 'UY',
  'SouthGenetics LLC Uruguay': 'UY',
  'SouthGenetics LLC Argentina': 'AR',
  'SouthGenetics LLC Arge': 'AR',
  'SouthGenetics LLC Chile': 'CL',
  'Southgenetics LLC Chile': 'CL',
  'SouthGenetics LLC Colombia': 'CO',
  'SouthGenetics LLC México': 'MX',
  'SouthGenetics LLC Venezuela': 'VE',
};

// Mapeo inverso: código de país a nombres de compañías
const countryToCompanies = (countryCode: string): string[] => {
  const mapping: Record<string, string[]> = {
    'CL': ['SouthGenetics LLC Chile', 'Southgenetics LLC Chile'],
    'UY': ['SouthGenetics LLC', 'SouthGenetics LLC Uruguay'],
    'AR': ['SouthGenetics LLC Argentina', 'SouthGenetics LLC Arge'],
    'MX': ['SouthGenetics LLC México'],
    'CO': ['SouthGenetics LLC Colombia'],
    'VE': ['SouthGenetics LLC Venezuela'],
  };
  return mapping[countryCode] || [];
};

// Extraer código de país de nombre de compañía (versión mejorada)
const extractCountryCode = (companyName: string): string => {
  if (!companyName) return 'XX';
  
  const upperName = companyName.toUpperCase();
  
  // Mapeo exhaustivo de todos los países
  const countryMappings: Record<string, string> = {
    'CHILE': 'CL',
    'URUGUAY': 'UY',
    'ARGENTINA': 'AR',
    'ARGE': 'AR', // Posible abreviación
    'MÉXICO': 'MX',
    'MEXICO': 'MX',
    'COLOMBIA': 'CO',
    'VENEZUELA': 'VE',
    'DOMINICANA': 'DO',
    'REPÚBLICA DOMINICANA': 'DO',
    'ECUADOR': 'EC',
    'PARAGUAY': 'PY',
    'JAMAICA': 'JM',
    'BOLIVIA': 'BO',
    'TRINIDAD': 'TT',
    'TOBAGO': 'TT',
    'BAHAMAS': 'BS',
    'BARBADOS': 'BB',
    'BERMUDA': 'BM',
    'CAYMAN': 'KY',
    'PERÚ': 'PE',
    'PERU': 'PE',
  };

  // Buscar coincidencia
  for (const [key, code] of Object.entries(countryMappings)) {
    if (upperName.includes(key)) {
      return code;
    }
  }

  // Fallback al mapeo original
  for (const [company, code] of Object.entries(companyToCountry)) {
    if (upperName.includes(company.toUpperCase())) {
      return code;
    }
  }

  if (process.env.NODE_ENV === 'development') {
    console.warn(`⚠️ No se pudo mapear país para: "${companyName}"`);
  }
  return 'XX';
};

// Normalizar nombre del producto para comparación (versión mejorada)
const normalizeProductName = (productName: string): string => {
  if (!productName) return '';
  
  // Normalizar: eliminar corchetes, espacios, caracteres especiales, convertir a mayúsculas
  let normalized = productName
    .trim()
    .toUpperCase()
    .replace(/\[.*?\]/g, '') // Eliminar corchetes y su contenido
    .replace(/[^\w]/g, '') // Eliminar todos los caracteres no alfanuméricos
    .replace(/\s+/g, ''); // Eliminar todos los espacios
  
  return normalized;
};

// Función para verificar si dos nombres de productos coinciden (match flexible)
const productNamesMatch = (name1: string, name2: string): boolean => {
  const norm1 = normalizeProductName(name1);
  const norm2 = normalizeProductName(name2);
  
  // Match exacto después de normalización
  if (norm1 === norm2) return true;
  
  // Match parcial: si uno contiene al otro (para casos como "Genomind" vs "Genomind Professional PGx")
  if (norm1.length > 0 && norm2.length > 0) {
    // Si el nombre más corto está contenido en el más largo
    const shorter = norm1.length < norm2.length ? norm1 : norm2;
    const longer = norm1.length >= norm2.length ? norm1 : norm2;
    
    // Solo hacer match parcial si el nombre corto tiene al menos 5 caracteres
    if (shorter.length >= 5 && longer.includes(shorter)) {
      return true;
    }
  }
  
  return false;
};

export function ComparisonTable({ month, country, product }: ComparisonTableProps) {
  const [data, setData] = useState<ComparisonRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'difference' | 'growthPercent'>('difference');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    fetchComparisonData();
  }, [month, country, product]);

  const fetchComparisonData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Budget 2026
      let budgetQuery = supabase
        .from('budget')
        .select('*')
        .eq('year', 2026);

      if (country !== 'all') {
        budgetQuery = budgetQuery.eq('country_code', country);
      }

      if (product !== 'all') {
        budgetQuery = budgetQuery.eq('product_name', product);
      }

      const { data: budgetData, error: budgetError } = await budgetQuery;
      if (budgetError) {
        console.error('❌ Error fetching budget data:', budgetError);
        throw budgetError;
      }
      
      if (!budgetData || budgetData.length === 0) {
        console.warn('⚠️ No hay datos de budget para los filtros seleccionados');
        setData([]);
        setLoading(false);
        return;
      }

      // 2. Fetch Real 2025 - SIN FILTROS EN QUERY (aplicar después para mejor control)
      let real2025Query = supabase
        .from('ventas_mensuales_view')
        .select('*')
        .eq('año', 2025);

      const { data: real2025Data, error: real2025Error } = await real2025Query;
      if (real2025Error) {
        console.error('❌ Error fetching real 2025 data:', real2025Error);
        // No lanzar error, continuar con array vacío
      }

      // 3. Fetch Real 2026 - SIN FILTROS EN QUERY (aplicar después para mejor control)
      let real2026Query = supabase
        .from('ventas_mensuales_view')
        .select('*')
        .eq('año', 2026);

      const { data: real2026Data, error: real2026Error } = await real2026Query;
      if (real2026Error) {
        console.error('❌ Error fetching real 2026 data:', real2026Error);
        // No lanzar error, simplemente continuar sin datos de 2026
      }
      
      // No requerir datos de ventas para continuar, pueden ser 0 o null
      const safeReal2025Data = real2025Data || [];
      const safeReal2026Data = real2026Data || [];

      console.log('📊 Budget Data:', budgetData?.length, 'registros');
      console.log('📈 Real Data (2025):', safeReal2025Data?.length, 'registros');
      console.log('📈 Real Data (2026):', safeReal2026Data?.length, 'registros');
      if (safeReal2025Data && safeReal2025Data.length > 0) {
        console.log('🔍 Muestra de datos reales 2025:', {
          primerRegistro: safeReal2025Data[0],
          compañías: [...new Set(safeReal2025Data.map((r: any) => r.compañia))].slice(0, 5),
          productos: [...new Set(safeReal2025Data.map((r: any) => r.producto))].slice(0, 5),
        });
      }
      if (safeReal2026Data && safeReal2026Data.length > 0) {
        console.log('🔍 Muestra de datos reales 2026:', {
          primerRegistro: safeReal2026Data[0],
          compañías: [...new Set(safeReal2026Data.map((r: any) => r.compañia))].slice(0, 5),
          productos: [...new Set(safeReal2026Data.map((r: any) => r.producto))].slice(0, 5),
        });
      }

      // 4. Agrupar datos reales 2025 por producto y país
      const real2025Grouped: Record<string, number> = {};
      
      const isMonthFiltered = month !== 'all';

      safeReal2025Data?.forEach((row: any) => {
        // Extraer código de país de la compañía
        const countryCodeFromCompany = extractCountryCode(row.compañia);
        
        // Normalizar nombre de producto
        const normalizedProduct = normalizeProductName(row.producto);
        
        // Crear key única usando el nombre normalizado
        const key = `${countryCodeFromCompany}-${normalizedProduct}`;

        // Aplicar filtros
        const matchesCountry = country === 'all' || countryCodeFromCompany === country;
        const matchesProduct = product === 'all' || 
                             productNamesMatch(product, row.producto);
        const matchesMonth = !isMonthFiltered || row.mes === parseInt(month);

        if (matchesCountry && matchesProduct && matchesMonth) {
          const cantidad = parseInt(row.cantidad_ventas) || 0;
          real2025Grouped[key] = (real2025Grouped[key] || 0) + cantidad;
          
          if (cantidad > 0) {
            console.log(`✅ Match 2025: ${row.producto} (${countryCodeFromCompany}) = ${cantidad} (key: ${key}, total: ${real2025Grouped[key]})`);
          }
        }
      });

      // 5. Agrupar datos reales 2026 por producto y país
      const real2026Grouped: Record<string, number> = {};

      safeReal2026Data?.forEach((row: any) => {
        // Extraer código de país de la compañía
        const countryCodeFromCompany = extractCountryCode(row.compañia);
        
        // Normalizar nombre de producto
        const normalizedProduct = normalizeProductName(row.producto);
        
        // Crear key única usando el nombre normalizado
        const key = `${countryCodeFromCompany}-${normalizedProduct}`;

        // Aplicar filtros
        const matchesCountry = country === 'all' || countryCodeFromCompany === country;
        const matchesProduct = product === 'all' || 
                             productNamesMatch(product, row.producto);
        const matchesMonth = !isMonthFiltered || row.mes === parseInt(month);

        if (matchesCountry && matchesProduct && matchesMonth) {
          const cantidad = parseInt(row.cantidad_ventas) || 0;
          real2026Grouped[key] = (real2026Grouped[key] || 0) + cantidad;
          
          if (cantidad > 0) {
            console.log(`✅ Match 2026: ${row.producto} (${countryCodeFromCompany}) = ${cantidad} (key: ${key}, total: ${real2026Grouped[key]})`);
          }
        }
      });

      console.log('📦 Datos agrupados 2025:', Object.keys(real2025Grouped).length, 'grupos');
      console.log('📦 Datos agrupados 2026:', Object.keys(real2026Grouped).length, 'grupos');
      if (Object.keys(real2025Grouped).length > 0) {
        console.log('🔍 Primeros 10 grupos con ventas 2025:', Object.entries(real2025Grouped).slice(0, 10));
      }
      if (Object.keys(real2026Grouped).length > 0) {
        console.log('🔍 Primeros 10 grupos con ventas 2026:', Object.entries(real2026Grouped).slice(0, 10));
      }

      // 6. Combinar datos de budget con reales
      const monthKey = isMonthFiltered ? MONTH_KEYS[parseInt(month) - 1] : null;

      // Verificar que hay datos de budget
      if (!budgetData || budgetData.length === 0) {
        console.warn('⚠️ No hay datos de budget para mostrar');
        setData([]);
        setLoading(false);
        return;
      }

      console.log('📋 Procesando', budgetData.length, 'registros de budget');

      const comparisonData: ComparisonRow[] = budgetData.map((budgetRow: any) => {
        // Calcular budget correctamente
        const budget = isMonthFiltered && monthKey
          ? (budgetRow[monthKey] || 0)
          : (budgetRow.total_units || 0);

        // Buscar en real2025Grouped usando match flexible
        const matchingKeys2025 = Object.keys(real2025Grouped).filter(k => {
          const [countryCode, normalizedProductFromKey] = k.split('-');
          
          if (countryCode !== budgetRow.country_code) return false;
          
          const normalizedBudgetName = normalizeProductName(budgetRow.product_name);
          
          if (normalizedBudgetName === normalizedProductFromKey) return true;
          
          if (normalizedBudgetName.length >= 5 && normalizedProductFromKey.includes(normalizedBudgetName)) return true;
          if (normalizedProductFromKey.length >= 5 && normalizedBudgetName.includes(normalizedProductFromKey)) return true;
          
          return false;
        });
        
        // Buscar en real2026Grouped usando match flexible
        const matchingKeys2026 = Object.keys(real2026Grouped).filter(k => {
          const [countryCode, normalizedProductFromKey] = k.split('-');
          
          if (countryCode !== budgetRow.country_code) return false;
          
          const normalizedBudgetName = normalizeProductName(budgetRow.product_name);
          
          if (normalizedBudgetName === normalizedProductFromKey) return true;
          
          if (normalizedBudgetName.length >= 5 && normalizedProductFromKey.includes(normalizedBudgetName)) return true;
          if (normalizedProductFromKey.length >= 5 && normalizedBudgetName.includes(normalizedProductFromKey)) return true;
          
          return false;
        });
        
        // Sumar todas las ventas que coincidan
        let real2025 = matchingKeys2025.reduce((sum, k) => sum + (real2025Grouped[k] || 0), 0);
        let real2026 = matchingKeys2026.reduce((sum, k) => sum + (real2026Grouped[k] || 0), 0);
        
        if (real2025 > 0 && matchingKeys2025.length > 0) {
          console.log(`🔍 Match 2025 encontrado para "${budgetRow.product_name}" (${budgetRow.country_code}):`, {
            matchingKeys: matchingKeys2025,
            real: real2025,
            normalizedBudget: normalizeProductName(budgetRow.product_name),
          });
        }
        
        if (real2026 > 0 && matchingKeys2026.length > 0) {
          console.log(`🔍 Match 2026 encontrado para "${budgetRow.product_name}" (${budgetRow.country_code}):`, {
            matchingKeys: matchingKeys2026,
            real: real2026,
            normalizedBudget: normalizeProductName(budgetRow.product_name),
          });
        }
        
        const difference = budget - real2025;
        const growthPercent = real2025 > 0 ? (difference / real2025) * 100 : 0;

        // Log para debugging
        if (process.env.NODE_ENV === 'development' && budget > 0) {
          const normalizedBudgetName = normalizeProductName(budgetRow.product_name);
          console.log(`📊 ${budgetRow.product_name} (${budgetRow.country_code}):`, {
            normalized: normalizedBudgetName,
            matchingKeys2025,
            matchingKeys2026,
            budget,
            real2025,
            real2026,
            difference,
            keysDisponibles2025: Object.keys(real2025Grouped).filter(k => k.startsWith(`${budgetRow.country_code}-`)),
            keysDisponibles2026: Object.keys(real2026Grouped).filter(k => k.startsWith(`${budgetRow.country_code}-`)),
          });
        }

        return {
          country: budgetRow.country,
          country_code: budgetRow.country_code,
          product_name: budgetRow.product_name,
          product_id: budgetRow.product_id,
          budget2026: budget,
          real2025: real2025,
          real2026: real2026,
          difference,
          growthPercent,
        };
      }) || [];

      // 5. Ordenar
      const sorted = comparisonData.sort((a, b) => {
        const aVal = a[sortBy];
        const bVal = b[sortBy];
        return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
      });

      setData(sorted);
      
      console.log('✅ Datos finales procesados:', sorted.length, 'registros');
      if (sorted.length > 0) {
        console.log('📊 Primeros 3 registros:', sorted.slice(0, 3));
      } else {
        console.warn('⚠️ No se generaron datos de comparación. Verificar logs anteriores.');
      }
    } catch (error) {
      console.error('❌ Error en fetchComparisonData:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (column: 'difference' | 'growthPercent') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12 text-white/80 text-sm">
        Cargando comparación...
      </div>
    );
  }

  return (
    <div className="border border-white/20 rounded-lg overflow-hidden bg-white/10 backdrop-blur-sm shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-white/10 border-b border-white/20">
          <tr>
            <th className="text-left px-4 py-3 font-medium text-xs text-white">País</th>
            <th className="text-left px-4 py-3 font-medium text-xs text-white">Producto</th>
            <th className="text-right px-4 py-3 font-medium text-xs text-white">Budget 2026</th>
            <th className="text-right px-4 py-3 font-medium text-xs text-white">Real 2025</th>
            <th className="text-right px-4 py-3 font-medium text-xs text-white">Real 2026</th>
            <th 
              className="text-right px-4 py-3 font-medium text-xs text-white cursor-pointer hover:bg-white/10 transition-colors"
              onClick={() => handleSort('difference')}
            >
              <div className="flex items-center justify-end gap-1">
                Diferencia
                {sortBy === 'difference' && (
                  sortOrder === 'desc' ? <ArrowDown className="w-4 h-4" /> : <ArrowUp className="w-4 h-4" />
                )}
              </div>
            </th>
            <th 
              className="text-right px-4 py-3 font-medium text-xs text-white cursor-pointer hover:bg-white/10 transition-colors"
              onClick={() => handleSort('growthPercent')}
            >
              <div className="flex items-center justify-end gap-1">
                Crecimiento %
                {sortBy === 'growthPercent' && (
                  sortOrder === 'desc' ? <ArrowDown className="w-4 h-4" /> : <ArrowUp className="w-4 h-4" />
                )}
              </div>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10">
          {data.map((row, idx) => {
            const isGrowth = row.difference > 0;
            const isDecline = row.difference < 0;

            return (
              <tr key={idx} className="hover:bg-white/5 transition-colors">
                <td className="px-4 py-3 text-sm text-white/90">{row.country}</td>
                <td className="px-4 py-3">
                  {row.product_id ? (
                    <Link
                      href={`/productos/${row.product_id}`}
                      className="text-blue-300 hover:text-blue-200 hover:underline text-sm font-medium"
                    >
                      {row.product_name}
                    </Link>
                  ) : (
                    <span className="text-white/70 text-sm">{row.product_name}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-medium text-sm text-blue-300">
                  {row.budget2026.toLocaleString('es-UY')}
                </td>
                <td className="px-4 py-3 text-right font-medium text-sm text-purple-300">
                  {row.real2025.toLocaleString('es-UY')}
                </td>
                <td className="px-4 py-3 text-right font-medium text-sm text-emerald-300">
                  {row.real2026.toLocaleString('es-UY')}
                </td>
                <td className={`px-4 py-3 text-right font-medium text-sm ${
                  isGrowth ? 'text-emerald-300' : 
                  isDecline ? 'text-red-300' : 
                  'text-white/60'
                }`}>
                  <div className="flex items-center justify-end gap-1">
                    {isGrowth && <ArrowUp className="w-4 h-4" />}
                    {isDecline && <ArrowDown className="w-4 h-4" />}
                    {!isGrowth && !isDecline && <Minus className="w-4 h-4" />}
                    {isGrowth ? '+' : ''}{row.difference.toLocaleString('es-UY')}
                  </div>
                </td>
                <td className={`px-4 py-3 text-right font-medium text-sm ${
                  isGrowth ? 'text-emerald-300' : 
                  isDecline ? 'text-red-300' : 
                  'text-white/60'
                }`}>
                  {isGrowth ? '+' : ''}{row.growthPercent.toFixed(1)}%
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {data.length === 0 && (
        <div className="text-center py-8 text-white/60 text-sm">
          No hay datos para comparar con los filtros seleccionados
        </div>
      )}
    </div>
  );
}

