'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { TrendingUp, TrendingDown, Equal } from 'lucide-react';

interface ComparisonSummaryProps {
  month: string;
  country: string;
  product: string;
}

interface SummaryData {
  budget2026: number;
  real2025: number;
  real2026: number;
  difference: number;
  growthPercent: number;
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

// Extraer código de país de nombre de compañía (versión mejorada)
const extractCountryCodeFromCompany = (companyName: string): string => {
  if (!companyName) return 'XX';
  
  const upperName = companyName.toUpperCase();
  
  // Mapeo exhaustivo de todos los países
  const countryMappings: Record<string, string> = {
    'CHILE': 'CL',
    'URUGUAY': 'UY',
    'ARGENTINA': 'AR',
    'ARGE': 'AR',
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

  return 'XX';
};

// Normalizar nombre del producto para comparación (versión mejorada)
const normalizeProductName = (productName: string): string => {
  if (!productName) return '';
  
  return productName
    .trim()
    .toUpperCase()
    .replace(/\[.*?\]/g, '') // Eliminar corchetes y su contenido
    .replace(/[^\w]/g, '') // Eliminar todos los caracteres no alfanuméricos
    .replace(/\s+/g, ''); // Eliminar todos los espacios
};

// Función para verificar si dos nombres de productos coinciden (match flexible)
const productNamesMatch = (name1: string, name2: string): boolean => {
  const norm1 = normalizeProductName(name1);
  const norm2 = normalizeProductName(name2);
  
  // Match exacto después de normalización
  if (norm1 === norm2) return true;
  
  // Match parcial: si uno contiene al otro (para casos como "Genomind" vs "Genomind Professional PGx")
  if (norm1.length > 0 && norm2.length > 0) {
    const shorter = norm1.length < norm2.length ? norm1 : norm2;
    const longer = norm1.length >= norm2.length ? norm1 : norm2;
    
    // Solo hacer match parcial si el nombre corto tiene al menos 5 caracteres
    if (shorter.length >= 5 && longer.includes(shorter)) {
      return true;
    }
  }
  
  return false;
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

export function ComparisonSummary({ month, country, product }: ComparisonSummaryProps) {
  const [summary, setSummary] = useState<SummaryData>({
    budget2026: 0,
    real2025: 0,
    real2026: 0,
    difference: 0,
    growthPercent: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSummary();
  }, [month, country, product]);

  const fetchSummary = async () => {
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

      // 2. Fetch Real 2025 - SIN FILTROS PREVIOS (aplicar después)
      let real2025Query = supabase
        .from('ventas_mensuales_view')
        .select('*')
        .eq('año', 2025);

      const { data: real2025Data, error: real2025Error } = await real2025Query;
      if (real2025Error) {
        console.error('❌ Error fetching real 2025 data:', real2025Error);
        // No lanzar error, continuar con array vacío
      }

      // 3. Fetch Real 2026 - SIN FILTROS PREVIOS (aplicar después)
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

      if (process.env.NODE_ENV === 'development') {
        console.log('📊 Summary - Real Data 2025:', safeReal2025Data?.length, 'registros');
        console.log('📊 Summary - Real Data 2026:', safeReal2026Data?.length, 'registros');
      }

      // 4. Calcular totales
      let budget2026 = 0;
      let real2025 = 0;
      let real2026 = 0;

      const isMonthFiltered = month !== 'all';
      const monthKey = isMonthFiltered ? MONTH_KEYS[parseInt(month) - 1] : null;

      // Sumar Budget
      budgetData?.forEach((row: any) => {
        if (isMonthFiltered && monthKey) {
          budget2026 += row[monthKey] || 0;
        } else {
          budget2026 += row.total_units || 0;
        }
      });

      // Sumar Real 2025 - CON FILTROS APLICADOS MANUALMENTE
      safeReal2025Data?.forEach((row: any) => {
        const countryCodeFromCompany = extractCountryCodeFromCompany(row.compañia);

        // Aplicar filtros
        const matchesCountry = country === 'all' || countryCodeFromCompany === country;
        const matchesProduct = product === 'all' || 
                             productNamesMatch(product, row.producto);
        const matchesMonth = !isMonthFiltered || row.mes === parseInt(month);

        if (matchesCountry && matchesProduct && matchesMonth) {
          const cantidad = parseInt(row.cantidad_ventas) || 0;
          real2025 += cantidad;
          
          if (process.env.NODE_ENV === 'development' && cantidad > 0) {
            console.log(`✅ Summary Match 2025: ${row.producto} (${countryCodeFromCompany}) = ${cantidad}`);
          }
        }
      });

      // Sumar Real 2026 - CON FILTROS APLICADOS MANUALMENTE
      safeReal2026Data?.forEach((row: any) => {
        const countryCodeFromCompany = extractCountryCodeFromCompany(row.compañia);

        // Aplicar filtros
        const matchesCountry = country === 'all' || countryCodeFromCompany === country;
        const matchesProduct = product === 'all' || 
                             productNamesMatch(product, row.producto);
        const matchesMonth = !isMonthFiltered || row.mes === parseInt(month);

        if (matchesCountry && matchesProduct && matchesMonth) {
          const cantidad = parseInt(row.cantidad_ventas) || 0;
          real2026 += cantidad;
          
          if (process.env.NODE_ENV === 'development' && cantidad > 0) {
            console.log(`✅ Summary Match 2026: ${row.producto} (${countryCodeFromCompany}) = ${cantidad}`);
          }
        }
      });

      if (process.env.NODE_ENV === 'development') {
        console.log('📊 Summary Totals:', { budget2026, real2025, real2026 });
      }

      // 4. Calcular diferencia y crecimiento
      const difference = budget2026 - real2025;
      const growthPercent = real2025 > 0 ? (difference / real2025) * 100 : 0;

      setSummary({
        budget2026,
        real2025,
        real2026,
        difference,
        growthPercent,
      });
    } catch (error) {
      console.error('Error fetching comparison summary:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8 text-white/80 text-sm">
        Cargando resumen...
      </div>
    );
  }

  const isGrowth = summary.difference > 0;
  const isDecline = summary.difference < 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
      {/* Budget 2026 */}
      <div className="bg-white/10 backdrop-blur-sm p-4 rounded-lg border border-white/20 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-white/70">Budget 2026</p>
            <p className="text-2xl font-bold mt-1 text-blue-300">
              {summary.budget2026.toLocaleString('es-UY')}
            </p>
            <p className="text-xs text-white/60 mt-1">unidades proyectadas</p>
          </div>
        </div>
      </div>

      {/* Real 2025 */}
      <div className="bg-white/10 backdrop-blur-sm p-4 rounded-lg border border-white/20 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-white/70">Real 2025</p>
            <p className="text-2xl font-bold mt-1 text-purple-300">
              {summary.real2025.toLocaleString('es-UY')}
            </p>
            <p className="text-xs text-white/60 mt-1">unidades vendidas</p>
          </div>
        </div>
      </div>

      {/* Real 2026 */}
      <div className="bg-white/10 backdrop-blur-sm p-4 rounded-lg border border-white/20 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-white/70">Real 2026</p>
            <p className="text-2xl font-bold mt-1 text-emerald-300">
              {summary.real2026.toLocaleString('es-UY')}
            </p>
            <p className="text-xs text-white/60 mt-1">unidades vendidas</p>
          </div>
        </div>
      </div>

      {/* Diferencia */}
      <div className="bg-white/10 backdrop-blur-sm p-4 rounded-lg border border-white/20 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-white/70">Diferencia</p>
            <p className={`text-2xl font-bold mt-1 ${
              isGrowth ? 'text-emerald-300' : 
              isDecline ? 'text-red-300' : 
              'text-white/60'
            }`}>
              {isGrowth ? '+' : ''}{summary.difference.toLocaleString('es-UY')}
            </p>
            <p className="text-xs text-white/60 mt-1">unidades</p>
          </div>
          {isGrowth && <TrendingUp className="w-8 h-8 text-emerald-300" />}
          {isDecline && <TrendingDown className="w-8 h-8 text-red-300" />}
          {!isGrowth && !isDecline && <Equal className="w-8 h-8 text-white/40" />}
        </div>
      </div>

      {/* Crecimiento % */}
      <div className="bg-white/10 backdrop-blur-sm p-4 rounded-lg border border-white/20 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-white/70">Crecimiento</p>
            <p className={`text-2xl font-bold mt-1 ${
              isGrowth ? 'text-emerald-300' : 
              isDecline ? 'text-red-300' : 
              'text-white/60'
            }`}>
              {isGrowth ? '+' : ''}{summary.growthPercent.toFixed(1)}%
            </p>
            <p className="text-xs text-white/60 mt-1">
              {isGrowth ? 'crecimiento proyectado' : 
               isDecline ? 'decrecimiento proyectado' : 
               'sin cambio'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

