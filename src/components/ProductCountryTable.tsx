'use client'

import React, { useState, useEffect } from 'react'
import { Product, CountryCode, ComputedResult, OverrideFields } from '@/types'
import { formatCurrency, formatPercentage, computePricing } from '@/lib/compute'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'
import { useNumericInput } from '@/hooks/useNumericInput'

interface ProductCountryTableProps {
  product: Product
  countryCode: CountryCode
  onOverridesChange?: (overrides: OverrideFields) => void
}

export function ProductCountryTable({ product, countryCode, onOverridesChange }: ProductCountryTableProps) {
  const [editingCell, setEditingCell] = useState<string | null>(null)
  const [overrides, setOverrides] = useState<OverrideFields>({})
  const [isLoading, setIsLoading] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  // Hook para el input de edición
  const editInput = useNumericInput()

  // Calcular el resultado usando los overrides actuales
  const computedResult = computePricing(product, countryCode, overrides)
  const { grossSales, discount, salesRevenue, costOfSales, costRows, totalCostOfSales, grossProfit } = computedResult

  useEffect(() => {
    loadOverrides()
  }, [product.id, countryCode])

  useEffect(() => {
    console.log('Editing cell changed to:', editingCell)
  }, [editingCell])

  const loadOverrides = async () => {
    try {
      const { data, error } = await supabase
        .from('product_country_overrides')
        .select('overrides')
        .eq('product_id', product.id)
        .eq('country_code', countryCode)
        .single()

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
        throw error
      }

      const newOverrides = (data?.overrides as OverrideFields) || {}
      console.log('Loading overrides for', countryCode, ':', newOverrides)
      setOverrides(newOverrides)
    } catch (error) {
      console.error('Error loading overrides:', error)
      setOverrides({})
    }
  }

  const saveOverride = async (field: keyof OverrideFields, value: number | undefined) => {
    setIsLoading(true)
    setSaveStatus('saving')
    
    try {
      // Verificar autenticación primero
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        console.error('❌ Usuario no autenticado:', authError)
        throw new Error('Usuario no autenticado')
      }
      console.log('👤 Usuario autenticado:', user.id)

      const newOverrides = { ...overrides, [field]: value }
      
      // Si el valor es undefined, lo eliminamos del objeto
      if (value === undefined) {
        delete newOverrides[field]
      }

      console.log('💾 Guardando override:', field, '=', value, 'para', countryCode)
      console.log('📊 Nuevos overrides:', newOverrides)
      console.log('🆔 Product ID:', product.id)
      console.log('🌍 Country Code:', countryCode)

      // Usar UPSERT para insertar o actualizar automáticamente
      const { data, error } = await supabase
        .from('product_country_overrides')
        .upsert({
          product_id: product.id,
          country_code: countryCode,
          overrides: newOverrides
        }, {
          onConflict: 'product_id,country_code'
        })
        .select()

      console.log('✅ Resultado del upsert:', { data, error })

      if (error) {
        console.error('❌ Error en base de datos:', error)
        console.error('❌ Detalles del error:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        })
        throw error
      }

      console.log('✅ Override guardado exitosamente en la base de datos')
      setOverrides(newOverrides)
      setSaveStatus('saved')
      onOverridesChange?.(newOverrides)
      
      // Resetear el estado de guardado después de 2 segundos
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch (error) {
      console.error('❌ Error guardando override:', error)
      setSaveStatus('error')
      
      // Resetear el estado de error después de 3 segundos
      setTimeout(() => setSaveStatus('idle'), 3000)
    } finally {
      setIsLoading(false)
    }
  }

  const resetAllToZero = async () => {
    setIsLoading(true)
    try {
      // Poner todos los valores en cero incluyendo Gross Sales
      const resetOverrides: OverrideFields = {
        grossSalesUSD: product.base_price, // Resetear a precio base del producto
        commercialDiscountPct: 0,
        commercialDiscountUSD: 0,
        productCostPct: 0,
        productCostUSD: 0,
        kitCostPct: 0,
        kitCostUSD: 0,
        paymentFeePct: 0,
        paymentFeeUSD: 0,
        bloodDrawSamplePct: 0,
        bloodDrawSampleUSD: 0,
        sanitaryPermitsPct: 0,
        sanitaryPermitsUSD: 0,
        externalCourierPct: 0,
        externalCourierUSD: 0,
        internalCourierPct: 0,
        internalCourierUSD: 0,
        physiciansFeesPct: 0,
        physiciansFeesUSD: 0,
        salesCommissionPct: 0,
        salesCommissionUSD: 0
      }

      // Usar UPSERT para insertar o actualizar automáticamente
      const { error } = await supabase
        .from('product_country_overrides')
        .upsert({
          product_id: product.id,
          country_code: countryCode,
          overrides: resetOverrides
        }, {
          onConflict: 'product_id,country_code'
        })
        .select()

      if (error) {
        console.error('Error en upsert:', error)
        throw error
      }

      setOverrides(resetOverrides)
      onOverridesChange?.(resetOverrides)
    } catch (error) {
      console.error('Error resetting overrides:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const startEditing = (cellId: string, currentValue: number) => {
    console.log('🎯 Starting to edit cell:', cellId, 'with value:', currentValue)
    console.log('📦 Product ID:', product.id)
    console.log('🌍 Country Code:', countryCode)
    setEditingCell(cellId)
    editInput.setValueFromNumber(Math.round(currentValue), 0) // Valores enteros
    console.log('✅ Editing cell set to:', cellId)
  }

  const finishEditing = async (cellId: string) => {
    const newValue = editInput.getNumericValue()
    
    console.log('🏁 Finishing edit for cellId:', cellId, 'newValue:', newValue)
    console.log('📦 Product ID:', product.id)
    console.log('🌍 Country Code:', countryCode)
    
    // Determinar si es edición de USD o porcentaje
    const isPercentageEdit = cellId.endsWith('-pct')
    const baseCellId = cellId.replace('-usd', '').replace('-pct', '')
    
    // Mapear cellId base a sus campos USD y Pct correspondientes
    const fieldPairMap: Record<string, { usd: keyof OverrideFields; pct?: keyof OverrideFields }> = {
      'gross-sales': { usd: 'grossSalesUSD' }, // Solo USD, no tiene %
      'commercial-discount': { usd: 'commercialDiscountUSD', pct: 'commercialDiscountPct' },
      'product-cost': { usd: 'productCostUSD', pct: 'productCostPct' },
      'kit-cost': { usd: 'kitCostUSD', pct: 'kitCostPct' },
      'payment-fee': { usd: 'paymentFeeUSD', pct: 'paymentFeePct' },
      'blood-draw': { usd: 'bloodDrawSampleUSD', pct: 'bloodDrawSamplePct' },
      'sanitary-permits': { usd: 'sanitaryPermitsUSD', pct: 'sanitaryPermitsPct' },
      'external-courier': { usd: 'externalCourierUSD', pct: 'externalCourierPct' },
      'internal-courier': { usd: 'internalCourierUSD', pct: 'internalCourierPct' },
      'physicians-fees': { usd: 'physiciansFeesUSD', pct: 'physiciansFeesPct' },
      'sales-commission': { usd: 'salesCommissionUSD', pct: 'salesCommissionPct' }
    }

    const fieldPair = fieldPairMap[baseCellId]
    if (fieldPair) {
      console.log('Field pair:', fieldPair, 'isPercentageEdit:', isPercentageEdit, 'newValue:', newValue)
      
      // Guardar valores
      const newOverrides = { ...overrides }
      
      if (baseCellId === 'gross-sales') {
        // Gross Sales solo tiene USD, no tiene %
        const usdValue = newValue || 0
        console.log('💾 Guardando Gross Sales USD como:', usdValue)
        newOverrides[fieldPair.usd] = usdValue
      } else {
        // Calcular la base de referencia (salesRevenue para la mayoría, grossSalesAmount para commercial-discount)
        const baseAmount = baseCellId === 'commercial-discount' 
          ? computedResult.grossSales.amount 
          : computedResult.salesRevenue.amount
        
        // Guardar ambos valores (USD y Pct) calculándolos entre sí
        if (isPercentageEdit && fieldPair.pct) {
          // Editamos porcentaje -> calcular USD
          const pctValue = newValue ? newValue / 100 : 0
          const usdValue = baseAmount * pctValue
          
          console.log('💾 Guardando % como:', pctValue, 'y calculando USD como:', usdValue)
          newOverrides[fieldPair.pct] = pctValue
          newOverrides[fieldPair.usd] = usdValue
        } else {
          // Editamos USD -> calcular %
          const usdValue = newValue || 0
          const pctValue = baseAmount > 0 ? usdValue / baseAmount : 0
          
          console.log('💾 Guardando USD como:', usdValue, 'y calculando % como:', pctValue)
          newOverrides[fieldPair.usd] = usdValue
          if (fieldPair.pct) {
            newOverrides[fieldPair.pct] = pctValue
          }
        }
      }
      
      // Guardar todos los overrides actualizados
      await saveMultipleOverrides(newOverrides)
    }

    setEditingCell(null)
  }
  
  const saveMultipleOverrides = async (newOverrides: OverrideFields) => {
    setIsLoading(true)
    setSaveStatus('saving')
    
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        console.error('❌ Usuario no autenticado:', authError)
        throw new Error('Usuario no autenticado')
      }

      console.log('💾 Guardando múltiples overrides:', newOverrides)

      // Usar UPSERT para insertar o actualizar automáticamente
      const { data, error } = await supabase
        .from('product_country_overrides')
        .upsert({
          product_id: product.id,
          country_code: countryCode,
          overrides: newOverrides
        }, {
          onConflict: 'product_id,country_code'
        })
        .select()

      if (error) {
        console.error('❌ Error en upsert:', error)
        throw error
      }
      
      console.log('✅ Data guardada:', data)

      console.log('✅ Overrides guardados exitosamente')
      setOverrides(newOverrides)
      setSaveStatus('saved')
      onOverridesChange?.(newOverrides)
      
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch (error) {
      console.error('❌ Error guardando overrides:', error)
      setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 3000)
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent, cellId: string) => {
    if (e.key === 'Enter') {
      finishEditing(cellId)
    } else if (e.key === 'Escape') {
      setEditingCell(null)
    }
  }

  const renderEditableCell = (cellId: string, value: number, isPercentage = false, isPercentageColumn = false) => {
    if (editingCell === cellId) {
      return (
        <Input
          type="text"
          value={editInput.stringValue}
          onChange={(e) => editInput.updateValue(e.target.value)}
          onBlur={() => finishEditing(cellId)}
          onKeyDown={(e) => handleKeyPress(e, cellId)}
          className="w-20 text-right font-mono text-sm"
          autoFocus
        />
      )
    }

    let displayValue: string
    if (isPercentageColumn) {
      displayValue = formatPercentage(value * 100)
    } else {
      displayValue = formatCurrency(value)
    }

    return (
      <span 
        className="cursor-pointer hover:bg-gray-100 px-2 py-1 rounded"
        onDoubleClick={() => {
          console.log('🖱️ Double click detected on cell:', cellId)
          console.log('📊 Value:', value, 'isPercentage:', isPercentageColumn)
          console.log('📦 Product ID:', product.id)
          console.log('🌍 Country Code:', countryCode)
          
          if (isPercentageColumn) {
            console.log('📈 Starting percentage edit with value:', value * 100)
            startEditing(cellId, value * 100) // Para porcentajes, mostrar como porcentaje (0-100)
          } else {
            console.log('💰 Starting USD edit with value:', isPercentage ? value * 100 : value)
            startEditing(cellId, isPercentage ? value * 100 : value) // Para USD, mostrar como USD
          }
        }}
      >
        {displayValue}
      </span>
    )
  }

  const renderRow = (row: any, isHeader = false, isTotal = false, cellId?: string) => {
    const isGrossProfit = row.label === "Gross Profit"
    const rowClasses = isHeader 
      ? "table-header font-semibold" 
      : isTotal 
        ? isGrossProfit 
          ? "table-row bg-emerald-50 font-semibold border-t-2 border-emerald-300"
          : "table-row bg-gray-100 font-semibold border-t-2 border-gray-300"
        : "table-row"

    const amountClasses = isGrossProfit ? "px-4 py-3 text-right font-mono text-emerald-700 font-bold" : "px-4 py-3 text-right font-mono"
    const pctClasses = isGrossProfit ? "px-4 py-3 text-right font-mono text-sm text-emerald-600" : "px-4 py-3 text-right font-mono text-sm"

    return (
      <tr className={rowClasses}>
        <td className={isGrossProfit ? "px-4 py-3 text-left text-emerald-700 font-semibold" : "px-4 py-3 text-left"}>{row.label}</td>
        <td className={amountClasses}>
          {cellId && !isHeader && !isTotal ? (
            renderEditableCell(`${cellId}-usd`, Math.abs(row.amount))
          ) : (
            row.amount >= 0 ? formatCurrency(row.amount) : formatCurrency(Math.abs(row.amount))
          )}
        </td>
        <td className={pctClasses}>
          {cellId && !isHeader && !isTotal && row.pct !== undefined ? (
            renderEditableCell(`${cellId}-pct`, row.pct / 100, false, true)
          ) : (
            row.pct !== undefined ? formatPercentage(row.pct) : '-'
          )}
        </td>
        <td className="px-4 py-3 text-right text-xs text-muted-foreground font-mono">
          {row.account || '-'}
        </td>
      </tr>
    )
  }

  return (
    <Card className="w-full">
      <CardContent className="p-0">
        {/* Header con botón de reiniciar y estado de guardado */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-gray-900">
              <span className="inline-block w-1 h-4 bg-blue-600 mr-2"></span>
              Cálculo de Costos
            </h3>
            {saveStatus === 'saving' && (
              <div className="flex items-center gap-1 text-sm text-orange-600 bg-orange-50 px-3 py-1 rounded-full">
                <div className="w-3 h-3 border-2 border-orange-600 border-t-transparent rounded-full animate-spin"></div>
                Guardando...
              </div>
            )}
            {saveStatus === 'saved' && (
              <div className="flex items-center gap-1 text-sm text-green-600 bg-green-50 px-3 py-1 rounded-full">
                <span>✅</span>
                Guardado
              </div>
            )}
            {saveStatus === 'error' && (
              <div className="flex items-center gap-1 text-sm text-red-600 bg-red-50 px-3 py-1 rounded-full">
                <span>❌</span>
                Error al guardar
              </div>
            )}
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={resetAllToZero}
            disabled={isLoading}
            className="text-gray-700 border-gray-300 hover:bg-gray-100 hover:text-gray-900 hover:border-gray-400"
          >
            {isLoading ? 'Guardando...' : 'Reiniciar Parámetros'}
          </Button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 text-left text-sm font-semibold">Concepto</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    USD
                  </span>
                </th>
                <th className="px-4 py-3 text-right text-sm font-semibold">
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                    %
                  </span>
                </th>
                <th className="px-4 py-3 text-right text-sm font-semibold">Cuenta</th>
              </tr>
            </thead>
            <tbody>
              {/* Sección principal - Gross Sales ahora es editable */}
              {renderRow(grossSales, false, false, 'gross-sales')}
              
              {/* Commercial Discount - editable, siempre visible */}
              {renderRow(discount, false, false, 'commercial-discount')}
              
              {/* Sales Revenue - no editable (calculado) */}
              {renderRow(salesRevenue, false, true)}
              
              {/* Separador Cost of Sales - siempre visible */}
              <tr className="table-row">
                <td colSpan={4} className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100">
                  Cost of Sales
                </td>
              </tr>
              
              {/* Componentes de Cost of Sales - todos editables */}
              {costRows.map((row, index) => {
                // Mapear cada fila a su cellId correspondiente
                const cellIdMap: Record<string, string> = {
                  'Product Cost': 'product-cost',
                  'Kit Cost': 'kit-cost',
                  'Payment Fee Costs': 'payment-fee',
                  'Blood Drawn & Sample Handling': 'blood-draw',
                  'Sanitary Permits to export blood': 'sanitary-permits',
                  'External Courier': 'external-courier',
                  'Internal Courier': 'internal-courier',
                  'Physicians Fees': 'physicians-fees',
                  'Sales Commission': 'sales-commission'
                }
                
                const cellId = cellIdMap[row.label]
                return (
                  <React.Fragment key={index}>
                    {renderRow(row, false, false, cellId)}
                  </React.Fragment>
                )
              })}
              
              {/* Totales - no editables */}
              {renderRow(totalCostOfSales, false, true)}
              {renderRow(grossProfit, false, true)}
            </tbody>
          </table>
        </div>
        
        {/* Instrucciones */}
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
          <p className="text-xs text-gray-600">
            💡 Haz doble clic en cualquier valor USD para editarlo. Los valores con % se calculan automáticamente.
          </p>
          <p className="text-xs text-gray-600 mt-1">
            💰 <strong>Gross Sales es editable por país</strong> - cambia según el mercado local.
          </p>
          <p className="text-xs text-gray-600 mt-1">
            🔄 "Reiniciar Parámetros" pone todos los valores en cero y Gross Sales al precio base original.
          </p>
          <p className="text-xs text-gray-600 mt-1">
            ⌨️ Presiona Enter para guardar o Escape para cancelar la edición.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
