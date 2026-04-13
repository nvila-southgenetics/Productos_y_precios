'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { ProductMultiSearchFilter } from '@/components/dashboard/ProductMultiSearchFilter';
import { MonthRangeFilter } from "@/components/filters/MonthRangeFilter"
import { MultiCheckboxDropdown, type MultiSelectOption } from "@/components/filters/MultiCheckboxDropdown"

interface ComparisonFiltersProps {
  selectedBudgetName: string;
  budgetNames: string[];
  monthFrom: number;
  monthTo: number;
  selectedCountries: string[];
  /** Array vacío = todos. */
  selectedProducts: string[];
  onBudgetNameChange: (budgetName: string) => void;
  onMonthRangeChange: (range: { fromMonth: number; toMonth: number }) => void;
  onCountriesChange: (countries: string[]) => void;
  onProductsChange: (products: string[]) => void;
  allowedCountries?: string[];
  showAllCountries?: boolean;
}

const COUNTRIES: MultiSelectOption[] = [
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
  selectedBudgetName,
  budgetNames,
  monthFrom,
  monthTo,
  selectedCountries,
  selectedProducts,
  onBudgetNameChange,
  onMonthRangeChange,
  onCountriesChange,
  onProductsChange,
  allowedCountries,
  showAllCountries = true,
}: ComparisonFiltersProps) {
  const [products, setProducts] = useState<string[]>([]);

  const filteredCountryList = allowedCountries?.length
    ? COUNTRIES.filter((c) => allowedCountries.includes(c.value))
    : COUNTRIES;

  useEffect(() => {
    fetchProducts();
  }, [selectedBudgetName]);

  const fetchProducts = async () => {
    try {
      // Obtener productos únicos de budget y ventas (2025 y 2026)
      const [budgetData, sales2025Data, sales2026Data] = await Promise.all([
        supabase
          .from('budget')
          .select('product_name')
          .eq('year', 2026)
          .eq('budget_name', selectedBudgetName),
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
      {/* Budget */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-white/90">Budget</label>
        <select
          value={selectedBudgetName}
          onChange={(e) => onBudgetNameChange(e.target.value)}
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-md border px-3 py-2 text-sm",
            "bg-white/10 border-white/20 text-white focus:border-white/30 focus:ring-2 focus:ring-white/30 focus:ring-offset-0 focus:ring-offset-transparent"
          )}
        >
          {budgetNames.map((n) => (
            <option key={n} value={n} className="bg-blue-900 text-white">
              {n}
            </option>
          ))}
        </select>
      </div>

      <MonthRangeFilter label="Mes" fromMonth={monthFrom} toMonth={monthTo} onChange={onMonthRangeChange} />

      <MultiCheckboxDropdown
        label="Compañía"
        options={filteredCountryList}
        selectedValues={selectedCountries.length ? selectedCountries : filteredCountryList.map((c) => c.value)}
        onSelectedValuesChange={onCountriesChange}
        allLabel={showAllCountries ? "Todas las compañías" : "Todas (mis compañías)"}
      />

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

