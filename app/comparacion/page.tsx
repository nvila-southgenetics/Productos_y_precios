'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, AlertCircle } from 'lucide-react';
import { ComparisonFilters } from '@/components/comparacion/ComparisonFilters';
import { ComparisonSummary } from '@/components/comparacion/ComparisonSummary';
import { ComparisonTable } from '@/components/comparacion/ComparisonTable';

export default function ComparacionPage() {
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string>('all');

  return (
    <div className="min-h-screen bg-gradient-to-r from-blue-900 via-blue-950 to-slate-900">
      <div className="container mx-auto p-6 space-y-6 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">
              Comparación: Budget 2026 - Real 2026 - Real 2025
            </h1>
            <p className="text-sm text-white/80 mt-1">
              Proyecciones y deltas de crecimiento (Budget vs Real 2026, Real 2026 vs Real 2025). Datos reales desde ventas mensuales.
            </p>
          </div>
          
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm"
              className="bg-white/10 border-white/20 text-white hover:bg-white/20"
              onClick={() => {
                // TODO: Implementar exportación
                alert('Exportar - Funcionalidad próximamente');
              }}
            >
              <Download className="w-4 h-4 mr-2" />
              Exportar
            </Button>
          </div>
        </div>

        {/* Alerta informativa */}
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-white/80 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-white/90">
            <p className="font-medium">Comparación de períodos:</p>
            <p>
              <strong>Budget 2026:</strong> Proyecciones | 
              <strong className="ml-2">Real 2026:</strong> Ventas reales 2026 | 
              <strong className="ml-2">Real 2025:</strong> Ventas reales 2025. Deltas: Budget vs Real 2026 y Real 2026 vs Real 2025 (cantidad y %).
            </p>
          </div>
        </div>

      {/* Filtros */}
      <ComparisonFilters
        selectedMonth={selectedMonth}
        selectedCountries={selectedCountries}
        selectedProduct={selectedProduct}
        onMonthChange={setSelectedMonth}
        onCountriesChange={setSelectedCountries}
        onProductChange={setSelectedProduct}
      />

      {/* Resumen comparativo */}
      <ComparisonSummary
        month={selectedMonth}
        countries={selectedCountries}
        product={selectedProduct}
      />

      {/* Tabla comparativa */}
      <ComparisonTable
        month={selectedMonth}
        countries={selectedCountries}
        product={selectedProduct}
      />
      </div>
    </div>
  );
}



