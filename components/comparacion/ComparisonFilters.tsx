'use client';

import { Select } from '@/components/ui/select';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface ComparisonFiltersProps {
  selectedMonth: string;
  selectedCountry: string;
  selectedProduct: string;
  onMonthChange: (month: string) => void;
  onCountryChange: (country: string) => void;
  onProductChange: (product: string) => void;
}

const MONTHS = [
  { value: 'all', label: 'Todos los meses' },
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
  { value: 'all', label: 'Todos los países' },
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
  selectedMonth,
  selectedCountry,
  selectedProduct,
  onMonthChange,
  onCountryChange,
  onProductChange,
}: ComparisonFiltersProps) {
  const [products, setProducts] = useState<string[]>([]);

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
    <div className="bg-white p-4 rounded-lg border">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Filtro de Mes */}
        <div>
          <label className="text-sm font-medium mb-2 block">Mes</label>
          <Select
            value={selectedMonth}
            onChange={(e) => onMonthChange(e.target.value)}
            className="w-full"
          >
            {MONTHS.map((month) => (
              <option key={month.value} value={month.value}>
                {month.label}
              </option>
            ))}
          </Select>
        </div>

        {/* Filtro de País */}
        <div>
          <label className="text-sm font-medium mb-2 block">País</label>
          <Select
            value={selectedCountry}
            onChange={(e) => onCountryChange(e.target.value)}
            className="w-full"
          >
            {COUNTRIES.map((country) => (
              <option key={country.value} value={country.value}>
                {country.label}
              </option>
            ))}
          </Select>
        </div>

        {/* Filtro de Producto */}
        <div>
          <label className="text-sm font-medium mb-2 block">Producto</label>
          <Select
            value={selectedProduct}
            onChange={(e) => onProductChange(e.target.value)}
            className="w-full"
          >
            <option value="all">Todos los productos</option>
            {products.map((product) => (
              <option key={product} value={product}>
                {product}
              </option>
            ))}
          </Select>
        </div>
      </div>
    </div>
  );
}

