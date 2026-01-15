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

// Normalizar nombre del producto para comparación
const normalizeProductName = (productName: string): string => {
  if (!productName) return '';
  
  return productName
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ') // Múltiples espacios → un espacio
    .replace(/\[.*?\]/g, '') // Eliminar corchetes y su contenido
    .replace(/[^\w\s]/g, '') // Eliminar caracteres especiales excepto espacios
    .replace(/\s/g, ''); // Eliminar todos los espacios para comparación estricta
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
      if (budgetError) throw budgetError;

      // 2. Fetch Real 2025
      let realQuery = supabase
        .from('ventas_mensuales_view')
        .select('*')
        .eq('año', 2025);

      if (country !== 'all') {
        const companies = countryToCompanies(country);
        realQuery = realQuery.in('compañia', companies);
      }

      if (product !== 'all') {
        realQuery = realQuery.eq('producto', product);
      }

      const { data: realData, error: realError } = await realQuery;
      if (realError) {
        console.error('❌ Error fetching real data:', realError);
        throw realError;
      }

      if (process.env.NODE_ENV === 'development') {
        console.log('📊 Budget Data:', budgetData?.length, 'registros');
        console.log('📈 Real Data (2025):', realData?.length, 'registros');
        if (realData && realData.length > 0) {
          console.log('🔍 Muestra de datos reales:', {
            primerRegistro: realData[0],
            compañías: [...new Set(realData.map((r: any) => r.compañia))].slice(0, 5),
            productos: [...new Set(realData.map((r: any) => r.producto))].slice(0, 5),
          });
        }
      }

      // 3. Agrupar datos reales por producto y país
      const realGrouped: Record<string, number> = {};
      
      const isMonthFiltered = month !== 'all';

      realData?.forEach((row: any) => {
        // Extraer código de país de la compañía
        const countryCodeFromCompany = extractCountryCode(row.compañia);
        
        // Normalizar nombre de producto
        const normalizedProduct = normalizeProductName(row.producto);
        
        // Crear key única
        const key = `${countryCodeFromCompany}-${normalizedProduct}`;

        // Aplicar filtros
        const matchesCountry = country === 'all' || countryCodeFromCompany === country;
        const matchesProduct = product === 'all' || 
                             normalizeProductName(product) === normalizedProduct;
        const matchesMonth = !isMonthFiltered || row.mes === parseInt(month);

        if (matchesCountry && matchesProduct && matchesMonth) {
          const cantidad = parseInt(row.cantidad_ventas) || 0;
          realGrouped[key] = (realGrouped[key] || 0) + cantidad;
          
          if (process.env.NODE_ENV === 'development' && cantidad > 0) {
            console.log(`✅ Match: ${key} = ${cantidad} (total: ${realGrouped[key]})`);
          }
        }
      });

      if (process.env.NODE_ENV === 'development') {
        console.log('📦 Datos agrupados:', Object.keys(realGrouped).length, 'grupos');
        console.log('🔍 Grupos con ventas:', realGrouped);
      }

      // 4. Combinar datos de budget con reales
      const monthKey = isMonthFiltered ? MONTH_KEYS[parseInt(month) - 1] : null;

      const comparisonData: ComparisonRow[] = budgetData?.map((budgetRow: any) => {
        // Calcular budget correctamente
        const budget = isMonthFiltered && monthKey
          ? (budgetRow[monthKey] || 0)
          : (budgetRow.total_units || 0);

        // Crear key normalizada para buscar en realGrouped
        const normalizedProductName = normalizeProductName(budgetRow.product_name);
        const key = `${budgetRow.country_code}-${normalizedProductName}`;
        
        const real = realGrouped[key] || 0;
        const difference = budget - real;
        const growthPercent = real > 0 ? (difference / real) * 100 : 0;

        // Log para debugging
        if (process.env.NODE_ENV === 'development' && budget > 0) {
          console.log(`📊 ${budgetRow.product_name} (${budgetRow.country_code}):`, {
            key,
            budget,
            real,
            difference,
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
      
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ Datos finales:', sorted.length, 'registros');
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

