'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProductMultiSearchFilter } from '@/components/dashboard/ProductMultiSearchFilter';

interface ComparisonFiltersProps {
  selectedMonths: string[];
  selectedCountries: string[];
  /** Array vacío = todos. */
  selectedProducts: string[];
  onMonthsChange: (months: string[]) => void;
  onCountriesChange: (countries: string[]) => void;
  onProductsChange: (products: string[]) => void;
  allowedCountries?: string[];
  showAllCountries?: boolean;
}

const MONTHS = [
  { value: '1', label: 'Enero' },
  { value: '2', label: 'Febrero' },
  { value: '3', label: 'Marzo' },
  { value: '4', label: 'Abril' },
  { value: '5', label: 'Mayo' },
  { value: '6', label: 'Junio' },
  { value: '7', label: 'Julio' },
  { value: '8', label: 'Agosto' },
  { value: '9', label: 'Septiembre' },
  { value: '10', label: 'Octubre' },
  { value: '11', label: 'Noviembre' },
  { value: '12', label: 'Diciembre' },
];

const COUNTRIES = [
  { value: 'CL', label: 'Chile' },
  { value: 'UY', label: 'Uruguay' },
  { value: 'AR', label: 'Argentina' },
  { value: 'MX', label: 'México' },
  { value: 'CO', label: 'Colombia' },
  { value: 'VE', label: 'Venezuela' },
  { value: 'DO', label: 'República Dominicana' },
  { value: 'EC', label: 'Ecuador' },
  { value: 'PY', label: 'Paraguay' },
  { value: 'JM', label: 'Jamaica' },
  { value: 'BO', label: 'Bolivia' },
  { value: 'TT', label: 'Trinidad y Tobago' },
  { value: 'BS', label: 'Bahamas' },
  { value: 'BB', label: 'Barbados' },
  { value: 'BM', label: 'Bermuda' },
  { value: 'KY', label: 'Cayman Islands' },
];

export function ComparisonFilters({
  selectedMonths,
  selectedCountries,
  selectedProducts,
  onMonthsChange,
  onCountriesChange,
  onProductsChange,
  allowedCountries,
  showAllCountries = true,
}: ComparisonFiltersProps) {
  const [products, setProducts] = useState<string[]>([]);
  const [monthsOpen, setMonthsOpen] = useState(false);
  const [countriesOpen, setCountriesOpen] = useState(false);
  const monthsRef = useRef<HTMLDivElement>(null);
  const countriesRef = useRef<HTMLDivElement>(null);

  const filteredCountryList = allowedCountries?.length
    ? COUNTRIES.filter((c) => allowedCountries.includes(c.value))
    : COUNTRIES;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (monthsRef.current && !monthsRef.current.contains(e.target as Node)) {
        setMonthsOpen(false);
      }
      if (countriesRef.current && !countriesRef.current.contains(e.target as Node)) {
        setCountriesOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleMonth = (value: string) => {
    const allMonthValues = MONTHS.map((m) => m.value);
    const isAllMonths = selectedMonths.length === allMonthValues.length;

    // Si está "todo" seleccionado y tocan un mes, pasar a ese mes solo.
    if (isAllMonths && selectedMonths.includes(value)) {
      onMonthsChange([value]);
      return;
    }

    if (selectedMonths.includes(value)) {
      const next = selectedMonths.filter((m) => m !== value);
      onMonthsChange(next.length === 0 ? allMonthValues : next);
    } else {
      onMonthsChange([...selectedMonths, value]);
    }
  };

  const selectAllMonths = () => {
    onMonthsChange(MONTHS.map((m) => m.value));
    setMonthsOpen(false);
  };

  const toggleCountry = (value: string) => {
    if (selectedCountries.includes(value)) {
      onCountriesChange(selectedCountries.filter((c) => c !== value));
    } else {
      onCountriesChange([...selectedCountries, value]);
    }
  };

  const selectAllCountries = () => {
    onCountriesChange([]);
    setCountriesOpen(false);
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      // Obtener productos únicos de budget y ventas (2025 y 2026)
      const [budgetData, sales2025Data, sales2026Data] = await Promise.all([
        supabase
          .from('budget')
          .select('product_name')
          .eq('year', 2026),
        supabase
          .from('ventas_mensuales_view')
          .select('producto')
          .eq('año', 2025),
        supabase
          .from('ventas_mensuales_view')
          .select('producto')
          .eq('año', 2026),
      ]);

      const budgetProducts = budgetData.data?.map((b: any) => b.product_name) || [];
      const sales2025Products = sales2025Data.data?.map((s: any) => s.producto) || [];
      const sales2026Products = sales2026Data.data?.map((s: any) => s.producto) || [];
      
      // Manejar errores sin fallar
      if (sales2026Data.error) {
        console.warn('⚠️ Error al obtener productos de 2026:', sales2026Data.error);
      }
      
      const uniqueProducts = [...new Set([...budgetProducts, ...sales2025Products, ...sales2026Products])].sort();
      setProducts(uniqueProducts);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Filtro de Mes (múltiple) */}
      <div className="flex flex-col gap-2" ref={monthsRef}>
        <label className="text-sm font-medium text-white/90">Mes</label>
        <div className="relative">
          <button
            type="button"
            onClick={() => setMonthsOpen(!monthsOpen)}
            className={cn(
              "flex h-10 w-full items-center justify-between rounded-md border px-3 py-2 text-sm",
              "bg-white/10 border-white/20 text-white focus:border-white/30 focus:ring-2 focus:ring-white/30 focus:ring-offset-0 focus:ring-offset-transparent"
            )}
          >
            <span className="truncate">
              {selectedMonths.length === MONTHS.length
                ? 'Todos los meses'
                : selectedMonths.length === 1
                  ? MONTHS.find((m) => m.value === selectedMonths[0])?.label ?? selectedMonths[0]
                  : `${selectedMonths.length} meses`}
            </span>
            <ChevronDown className={cn("h-4 w-4 opacity-70 transition-transform", monthsOpen && "rotate-180")} />
          </button>
          {monthsOpen && (
            <div className="absolute z-50 mt-1 w-full rounded-md border border-white/20 bg-blue-950/95 backdrop-blur-sm py-2 shadow-lg max-h-64 overflow-y-auto">
              <button
                type="button"
                onClick={selectAllMonths}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-white/90 hover:bg-white/10"
              >
                <Checkbox checked={selectedMonths.length === MONTHS.length} />
                Todos los meses
              </button>
              {MONTHS.map((month) => (
                <button
                  key={month.value}
                  type="button"
                  onClick={() => toggleMonth(month.value)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-white/90 hover:bg-white/10"
                >
                  <Checkbox checked={selectedMonths.includes(month.value)} />
                  {month.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Filtro de Países (múltiple) */}
      <div className="flex flex-col gap-2" ref={countriesRef}>
        <label className="text-sm font-medium text-white/90">Países</label>
        <div className="relative">
          <button
            type="button"
            onClick={() => setCountriesOpen(!countriesOpen)}
            className={cn(
              "flex h-10 w-full items-center justify-between rounded-md border px-3 py-2 text-sm",
              "bg-white/10 border-white/20 text-white focus:border-white/30 focus:ring-2 focus:ring-white/30 focus:ring-offset-0 focus:ring-offset-transparent"
            )}
          >
            <span className="truncate">
              {selectedCountries.length === 0
                ? 'Todos los países'
                : selectedCountries.length === 1
                  ? COUNTRIES.find((c) => c.value === selectedCountries[0])?.label ?? selectedCountries[0]
                  : `${selectedCountries.length} países`}
            </span>
            <ChevronDown className={cn("h-4 w-4 opacity-70 transition-transform", countriesOpen && "rotate-180")} />
          </button>
          {countriesOpen && (
            <div className="absolute z-50 mt-1 w-full rounded-md border border-white/20 bg-blue-950/95 backdrop-blur-sm py-2 shadow-lg max-h-64 overflow-y-auto">
              {showAllCountries && (
                <button
                  type="button"
                  onClick={selectAllCountries}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-white/90 hover:bg-white/10"
                >
                  <Checkbox checked={selectedCountries.length === 0} />
                  Todos los países
                </button>
              )}
              {filteredCountryList.map((country) => (
                <button
                  key={country.value}
                  type="button"
                  onClick={() => toggleCountry(country.value)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-white/90 hover:bg-white/10"
                >
                  <Checkbox checked={selectedCountries.includes(country.value)} />
                  {country.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Filtro de Producto */}
      <div className="flex flex-col gap-2">
        <ProductMultiSearchFilter
          products={products}
          selectedProducts={selectedProducts}
          onSelectedProductsChange={onProductsChange}
          allLabel="Todos los productos"
        />
      </div>
    </div>
  );
}

