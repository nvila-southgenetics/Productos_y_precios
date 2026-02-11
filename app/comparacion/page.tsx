'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, AlertCircle } from 'lucide-react';
import { ComparisonFilters } from '@/components/comparacion/ComparisonFilters';
import { ComparisonSummary } from '@/components/comparacion/ComparisonSummary';
import { ComparisonTable } from '@/components/comparacion/ComparisonTable';

export default function ComparacionPage() {
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedCountry, setSelectedCountry] = useState<string>('all');
  const [selectedProduct, setSelectedProduct] = useState<string>('all');

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            Comparación: Budget 2026 vs Real 2025
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Analiza las proyecciones contra el desempeño histórico real
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm"
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
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
        <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <p className="font-medium">Comparación de períodos:</p>
          <p>
            <strong>Budget:</strong> Proyecciones para 2026 | 
            <strong className="ml-2">Real:</strong> Ventas reales de 2025
          </p>
        </div>
      </div>

      {/* Filtros */}
      <ComparisonFilters
        selectedMonth={selectedMonth}
        selectedCountry={selectedCountry}
        selectedProduct={selectedProduct}
        onMonthChange={setSelectedMonth}
        onCountryChange={setSelectedCountry}
        onProductChange={setSelectedProduct}
      />

      {/* Resumen comparativo */}
      <ComparisonSummary
        month={selectedMonth}
        country={selectedCountry}
        product={selectedProduct}
      />

      {/* Tabla comparativa */}
      <ComparisonTable
        month={selectedMonth}
        country={selectedCountry}
        product={selectedProduct}
      />
    </div>
  );
}



