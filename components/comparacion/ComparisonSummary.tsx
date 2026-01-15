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
      if (realError) throw realError;

      // 3. Calcular totales
      let budget2026 = 0;
      let real2025 = 0;

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

      // Sumar Real
      realData?.forEach((row: any) => {
        if (isMonthFiltered) {
          // Si el mes del registro coincide con el filtro
          if (row.mes === parseInt(month)) {
            real2025 += row.cantidad_ventas || 0;
          }
        } else {
          // Sumar todas las ventas
          real2025 += row.cantidad_ventas || 0;
        }
      });

      // 4. Calcular diferencia y crecimiento
      const difference = budget2026 - real2025;
      const growthPercent = real2025 > 0 ? (difference / real2025) * 100 : 0;

      setSummary({
        budget2026,
        real2025,
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
      <div className="text-center py-8 text-muted-foreground text-sm">
        Cargando resumen...
      </div>
    );
  }

  const isGrowth = summary.difference > 0;
  const isDecline = summary.difference < 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {/* Budget 2026 */}
      <div className="bg-white p-4 rounded-lg border">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Budget 2026</p>
            <p className="text-2xl font-bold mt-1 text-blue-600">
              {summary.budget2026.toLocaleString('es-UY')}
            </p>
            <p className="text-xs text-muted-foreground mt-1">unidades proyectadas</p>
          </div>
        </div>
      </div>

      {/* Real 2025 */}
      <div className="bg-white p-4 rounded-lg border">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Real 2025</p>
            <p className="text-2xl font-bold mt-1 text-purple-600">
              {summary.real2025.toLocaleString('es-UY')}
            </p>
            <p className="text-xs text-muted-foreground mt-1">unidades vendidas</p>
          </div>
        </div>
      </div>

      {/* Diferencia */}
      <div className="bg-white p-4 rounded-lg border">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Diferencia</p>
            <p className={`text-2xl font-bold mt-1 ${
              isGrowth ? 'text-green-600' : 
              isDecline ? 'text-red-600' : 
              'text-gray-600'
            }`}>
              {isGrowth ? '+' : ''}{summary.difference.toLocaleString('es-UY')}
            </p>
            <p className="text-xs text-muted-foreground mt-1">unidades</p>
          </div>
          {isGrowth && <TrendingUp className="w-8 h-8 text-green-500" />}
          {isDecline && <TrendingDown className="w-8 h-8 text-red-500" />}
          {!isGrowth && !isDecline && <Equal className="w-8 h-8 text-gray-400" />}
        </div>
      </div>

      {/* Crecimiento % */}
      <div className="bg-white p-4 rounded-lg border">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Crecimiento</p>
            <p className={`text-2xl font-bold mt-1 ${
              isGrowth ? 'text-green-600' : 
              isDecline ? 'text-red-600' : 
              'text-gray-600'
            }`}>
              {isGrowth ? '+' : ''}{summary.growthPercent.toFixed(1)}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">
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

