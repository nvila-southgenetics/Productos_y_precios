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
      let realQuery = supabase
        .from('ventas_mensuales_view')
        .select('*')
        .eq('año', 2025);

      const { data: realData, error: realError } = await realQuery;
      if (realError) {
        console.error('❌ Error fetching real data:', realError);
        throw realError;
      }
      
      if (!realData) {
        console.warn('⚠️ No se obtuvieron datos de ventas');
        setData([]);
        setLoading(false);
        return;
      }

      console.log('📊 Budget Data:', budgetData?.length, 'registros');
      console.log('📈 Real Data (2025):', realData?.length, 'registros');
      if (realData && realData.length > 0) {
        console.log('🔍 Muestra de datos reales:', {
          primerRegistro: realData[0],
          compañías: [...new Set(realData.map((r: any) => r.compañia))].slice(0, 5),
          productos: [...new Set(realData.map((r: any) => r.producto))].slice(0, 5),
        });
      }

      // 3. Agrupar datos reales por producto y país
      const realGrouped: Record<string, number> = {};
      
      const isMonthFiltered = month !== 'all';

      realData?.forEach((row: any) => {
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
          realGrouped[key] = (realGrouped[key] || 0) + cantidad;
          
          if (cantidad > 0) {
            console.log(`✅ Match: ${row.producto} (${countryCodeFromCompany}) = ${cantidad} (key: ${key}, total: ${realGrouped[key]})`);
          }
        }
      });

      console.log('📦 Datos agrupados:', Object.keys(realGrouped).length, 'grupos');
      if (Object.keys(realGrouped).length > 0) {
        console.log('🔍 Primeros 10 grupos con ventas:', Object.entries(realGrouped).slice(0, 10));
      }

      // 4. Combinar datos de budget con reales
      const monthKey = isMonthFiltered ? MONTH_KEYS[parseInt(month) - 1] : null;

      const comparisonData: ComparisonRow[] = budgetData?.map((budgetRow: any) => {
        // Calcular budget correctamente
        const budget = isMonthFiltered && monthKey
          ? (budgetRow[monthKey] || 0)
          : (budgetRow.total_units || 0);

        // Buscar en realGrouped usando match flexible
        // Buscar todas las keys del mismo país y hacer match flexible con el nombre del producto
        const matchingKeys = Object.keys(realGrouped).filter(k => {
          const [countryCode, normalizedProductFromKey] = k.split('-');
          
          // Primero verificar que el país coincida
          if (countryCode !== budgetRow.country_code) return false;
          
          // Luego hacer match flexible del nombre del producto
          // Necesitamos comparar el nombre normalizado de budget con el nombre normalizado de la key
          const normalizedBudgetName = normalizeProductName(budgetRow.product_name);
          
          // Match exacto
          if (normalizedBudgetName === normalizedProductFromKey) return true;
          
          // Match parcial: si uno contiene al otro
          if (normalizedBudgetName.length >= 5 && normalizedProductFromKey.includes(normalizedBudgetName)) return true;
          if (normalizedProductFromKey.length >= 5 && normalizedBudgetName.includes(normalizedProductFromKey)) return true;
          
          return false;
        });
        
        // Sumar todas las ventas que coincidan
        let real = matchingKeys.reduce((sum, k) => sum + (realGrouped[k] || 0), 0);
        
        if (real > 0 && matchingKeys.length > 0) {
          console.log(`🔍 Match encontrado para "${budgetRow.product_name}" (${budgetRow.country_code}):`, {
            matchingKeys,
            real,
            normalizedBudget: normalizeProductName(budgetRow.product_name),
          });
        } else if (budgetRow.total_units > 0 && Object.keys(realGrouped).length > 0) {
          console.log(`⚠️ No se encontró match para "${budgetRow.product_name}" (${budgetRow.country_code})`, {
            normalizedBudget: normalizeProductName(budgetRow.product_name),
            keysDisponibles: Object.keys(realGrouped).filter(k => k.startsWith(`${budgetRow.country_code}-`)).slice(0, 5),
          });
        }
        
        const difference = budget - real;
        const growthPercent = real > 0 ? (difference / real) * 100 : 0;

        // Log para debugging
        if (process.env.NODE_ENV === 'development' && budget > 0) {
          const normalizedBudgetName = normalizeProductName(budgetRow.product_name);
          console.log(`📊 ${budgetRow.product_name} (${budgetRow.country_code}):`, {
            normalized: normalizedBudgetName,
            matchingKeys,
            budget,
            real,
            difference,
            keysDisponibles: Object.keys(realGrouped).filter(k => k.startsWith(`${budgetRow.country_code}-`)),
          });
        }

        return {
          country: budgetRow.country,
          country_code: budgetRow.country_code,
          product_name: budgetRow.product_name,
          product_id: budgetRow.product_id,
          budget2026: budget,
          real2025: real,
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
      <div className="text-center py-12 text-muted-foreground text-sm">
        Cargando comparación...
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden bg-white">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 border-b">
          <tr>
            <th className="text-left px-4 py-3 font-medium text-xs">País</th>
            <th className="text-left px-4 py-3 font-medium text-xs">Producto</th>
            <th className="text-right px-4 py-3 font-medium text-xs">Budget 2026</th>
            <th className="text-right px-4 py-3 font-medium text-xs">Real 2025</th>
            <th 
              className="text-right px-4 py-3 font-medium text-xs cursor-pointer hover:bg-muted/70 transition-colors"
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
              className="text-right px-4 py-3 font-medium text-xs cursor-pointer hover:bg-muted/70 transition-colors"
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
        <tbody className="divide-y">
          {data.map((row, idx) => {
            const isGrowth = row.difference > 0;
            const isDecline = row.difference < 0;

            return (
              <tr key={idx} className="hover:bg-muted/50 transition-colors">
                <td className="px-4 py-3 text-sm">{row.country}</td>
                <td className="px-4 py-3">
                  {row.product_id ? (
                    <Link
                      href={`/productos/${row.product_id}`}
                      className="text-primary hover:underline text-sm font-medium"
                    >
                      {row.product_name}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground text-sm">{row.product_name}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-medium text-sm text-blue-600">
                  {row.budget2026.toLocaleString('es-UY')}
                </td>
                <td className="px-4 py-3 text-right font-medium text-sm text-purple-600">
                  {row.real2025.toLocaleString('es-UY')}
                </td>
                <td className={`px-4 py-3 text-right font-medium text-sm ${
                  isGrowth ? 'text-green-600' : 
                  isDecline ? 'text-red-600' : 
                  'text-gray-600'
                }`}>
                  <div className="flex items-center justify-end gap-1">
                    {isGrowth && <ArrowUp className="w-4 h-4" />}
                    {isDecline && <ArrowDown className="w-4 h-4" />}
                    {!isGrowth && !isDecline && <Minus className="w-4 h-4" />}
                    {isGrowth ? '+' : ''}{row.difference.toLocaleString('es-UY')}
                  </div>
                </td>
                <td className={`px-4 py-3 text-right font-medium text-sm ${
                  isGrowth ? 'text-green-600' : 
                  isDecline ? 'text-red-600' : 
                  'text-gray-600'
                }`}>
                  {isGrowth ? '+' : ''}{row.growthPercent.toFixed(1)}%
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {data.length === 0 && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          No hay datos para comparar con los filtros seleccionados
        </div>
      )}
    </div>
  );
}

