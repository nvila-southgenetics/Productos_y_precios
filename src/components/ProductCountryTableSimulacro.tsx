'use client'

import React, { useState, useEffect } from 'react'
import { Product, CountryCode, ComputedResult, OverrideFields, MxConfigType, ClConfigType, ColConfigType } from '@/types'
import { formatCurrency, formatPercentage, computePricing } from '@/lib/compute'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { FlaskConical, MessageSquare, Calculator } from 'lucide-react'

interface ProductCountryTableSimulacroProps {
  product: Product
  countryCode: CountryCode
  onOverridesChange?: (overrides: OverrideFields) => void
}

export function ProductCountryTableSimulacro({ product, countryCode, onOverridesChange }: ProductCountryTableSimulacroProps) {
  const [editingCell, setEditingCell] = useState<string | null>(null)
  const [editValue, setEditValue] = useState<string>('')
  const [overrides, setOverrides] = useState<OverrideFields>({})
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [mxConfigType, setMxConfigType] = useState<MxConfigType>('precio_lista')
  const [clConfigType, setClConfigType] = useState<ClConfigType>('precio_lista')
  const [colConfigType, setColConfigType] = useState<ColConfigType>('precio_lista')
  const [multiplier, setMultiplier] = useState<number>(1)
  
  // Estado para comentarios
  const [commentDialogOpen, setCommentDialogOpen] = useState(false)
  const [currentCommentKey, setCurrentCommentKey] = useState<string>('')
  const [currentComment, setCurrentComment] = useState<string>('')

  // Calcular el resultado usando los overrides actuales
  const computedResult = computePricing(product, countryCode, overrides)
  const { grossSales, discount, salesRevenue, costOfSales, costRows, totalCostOfSales, grossProfit } = computedResult

  useEffect(() => {
    loadOverrides()
  }, [product.id, countryCode, mxConfigType, clConfigType, colConfigType])

  const getStorageKey = () => {
    const mxConfig = countryCode === 'MX' ? mxConfigType : 'default'
    const clConfig = countryCode === 'CL' ? clConfigType : 'default'
    const colConfig = countryCode === 'CO' ? colConfigType : 'default'
    return `simulacro_${product.id}_${countryCode}_${mxConfig}_${clConfig}_${colConfig}`
  }

  const loadOverrides = () => {
    try {
      const storageKey = getStorageKey()
      const savedData = localStorage.getItem(storageKey)
      
      if (savedData) {
        const newOverrides = JSON.parse(savedData) as OverrideFields
        console.log('Loading simulacro overrides for', countryCode, mxConfigType, clConfigType, ':', newOverrides)
        setOverrides(newOverrides)
      } else {
        setOverrides({})
      }
    } catch (error) {
      console.error('Error loading simulacro overrides:', error)
      setOverrides({})
    }
  }

  const saveOverride = async (field: keyof OverrideFields, value: number | undefined) => {
    setSaveStatus('saving')
    
    try {
      const newOverrides = { ...overrides, [field]: value }
      
      // Guardar en localStorage
      const storageKey = getStorageKey()
      localStorage.setItem(storageKey, JSON.stringify(newOverrides))
      
      setOverrides(newOverrides)
      onOverridesChange?.(newOverrides)
      
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch (error) {
      console.error('Error saving simulacro override:', error)
      setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 3000)
    }
  }

  const resetAllToZero = async () => {
    if (!confirm('¿Estás seguro de que deseas reiniciar todos los parámetros a sus valores por defecto?')) {
      return
    }

    setSaveStatus('saving')
    
    try {
      // Eliminar del localStorage
      const storageKey = getStorageKey()
      localStorage.removeItem(storageKey)
      
      setOverrides({})
      onOverridesChange?.({})
      
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch (error) {
      console.error('Error resetting simulacro parameters:', error)
      setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 3000)
    }
  }

  const changeMxConfigType = (newType: MxConfigType) => {
    console.log('🔄 Cambiando tipo de configuración MX de', mxConfigType, 'a', newType)
    setMxConfigType(newType)
  }

  const changeClConfigType = (newType: ClConfigType) => {
    console.log('🔄 Cambiando tipo de configuración CL de', clConfigType, 'a', newType)
    setClConfigType(newType)
  }

  const changeColConfigType = (newType: ColConfigType) => {
    console.log('🔄 Cambiando tipo de configuración CO de', colConfigType, 'a', newType)
    setColConfigType(newType)
  }

  const openCommentDialog = (cellId: string) => {
    const comments = overrides.comments || {}
    setCurrentCommentKey(cellId)
    setCurrentComment(comments[cellId] || '')
    setCommentDialogOpen(true)
  }

  const saveComment = () => {
    setSaveStatus('saving')
    
    try {
      const comments = { ...(overrides.comments || {}) }
      
      if (currentComment.trim() === '') {
        // Si el comentario está vacío, lo eliminamos
        delete comments[currentCommentKey]
      } else {
        comments[currentCommentKey] = currentComment.trim()
      }
      
      const newOverrides = { ...overrides, comments }
      
      // Guardar en localStorage
      const storageKey = getStorageKey()
      localStorage.setItem(storageKey, JSON.stringify(newOverrides))
      
      setOverrides(newOverrides)
      onOverridesChange?.(newOverrides)
      
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
      setCommentDialogOpen(false)
    } catch (error) {
      console.error('Error saving comment:', error)
      setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 3000)
    }
  }

  const startEditing = (key: string, currentValue: number) => {
    setEditingCell(key)
    setEditValue(currentValue.toString())
  }

  const finishEditing = async (field: keyof OverrideFields) => {
    const numValue = parseFloat(editValue)
    const value = isNaN(numValue) ? undefined : numValue
    await saveOverride(field, value)
    setEditingCell(null)
    setEditValue('')
  }

  const cancelEdit = () => {
    setEditingCell(null)
    setEditValue('')
  }

  const renderEditableCell = (
    label: string,
    amountValue: number,
    pctValue: number,
    amountField: keyof OverrideFields,
    pctField: keyof OverrideFields,
    cellId?: string
  ) => {
    const amountKey = `${amountField}_amount`
    const pctKey = `${pctField}_pct`
    const isEditingAmount = editingCell === amountKey
    const isEditingPct = editingCell === pctKey
    const hasComment = cellId && overrides.comments && overrides.comments[cellId]

    return (
      <tr className="border-b border-gray-200 hover:bg-gray-100 transition-colors">
        <td className="px-6 py-3 text-sm font-medium text-gray-700">
          <div className="flex items-center gap-2">
            <span>{label}</span>
            {cellId && (
              <button
                onClick={() => openCommentDialog(cellId)}
                className={`p-1 rounded-full hover:bg-blue-100 transition-colors ${
                  hasComment ? 'text-blue-600' : 'text-gray-400 hover:text-blue-600'
                }`}
                title={hasComment ? 'Ver/editar comentario' : 'Agregar comentario'}
              >
                <MessageSquare className={`w-4 h-4 ${hasComment ? 'fill-blue-100' : ''}`} />
              </button>
            )}
          </div>
        </td>
        <td className="px-6 py-3 text-right">
          {isEditingAmount ? (
            <Input
              type="number"
              step="0.01"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={() => finishEditing(amountField)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') finishEditing(amountField)
                if (e.key === 'Escape') cancelEdit()
              }}
              autoFocus
              className="w-32 text-right"
            />
          ) : (
            <div
              onDoubleClick={() => startEditing(amountKey, amountValue)}
              className="text-sm text-gray-900 hover:bg-blue-50 cursor-pointer font-medium px-2 py-1 rounded"
            >
              {formatCurrency(amountValue * multiplier)}
            </div>
          )}
        </td>
        <td className="px-6 py-3 text-right">
          {isEditingPct ? (
            <Input
              type="number"
              step="0.01"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={() => finishEditing(pctField)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') finishEditing(pctField)
                if (e.key === 'Escape') cancelEdit()
              }}
              autoFocus
              className="w-32 text-right"
            />
          ) : (
            <div
              onDoubleClick={() => startEditing(pctKey, pctValue)}
              className="text-sm text-gray-900 hover:bg-blue-50 cursor-pointer font-medium px-2 py-1 rounded"
            >
              {formatPercentage(pctValue)}
            </div>
          )}
        </td>
      </tr>
    )
  }

  const renderGrossSalesRow = () => {
    const key = 'grossSalesUSD'
    const cellId = 'gross-sales'
    const isEditing = editingCell === key
    const hasComment = overrides.comments && overrides.comments[cellId]

    return (
      <tr className="border-b border-gray-200 hover:bg-gray-100 transition-colors">
        <td className="px-6 py-3 text-sm font-medium text-gray-700">
          <div className="flex items-center gap-2">
            <span>{grossSales.label}</span>
            <button
              onClick={() => openCommentDialog(cellId)}
              className={`p-1 rounded-full hover:bg-blue-100 transition-colors ${
                hasComment ? 'text-blue-600' : 'text-gray-400 hover:text-blue-600'
              }`}
              title={hasComment ? 'Ver/editar comentario' : 'Agregar comentario'}
            >
              <MessageSquare className={`w-4 h-4 ${hasComment ? 'fill-blue-100' : ''}`} />
            </button>
          </div>
        </td>
        <td className="px-6 py-3 text-right">
          {isEditing ? (
            <Input
              type="number"
              step="0.01"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={() => finishEditing('grossSalesUSD')}
              onKeyDown={(e) => {
                if (e.key === 'Enter') finishEditing('grossSalesUSD')
                if (e.key === 'Escape') cancelEdit()
              }}
              autoFocus
              className="w-32 text-right"
            />
          ) : (
            <div
              onDoubleClick={() => startEditing(key, grossSales.amount)}
              className="text-sm text-gray-900 hover:bg-blue-50 cursor-pointer font-medium px-2 py-1 rounded"
            >
              {formatCurrency(grossSales.amount * multiplier)}
            </div>
          )}
        </td>
        <td className="px-6 py-3 text-right text-sm text-gray-900 font-medium">
          {formatPercentage(grossSales.pct)}
        </td>
      </tr>
    )
  }

  return (
    <Card className="overflow-hidden border-purple-200 shadow-lg">
      {/* Banner de modo simulacro */}
      <div className="px-6 py-3 border-b border-purple-200 bg-purple-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-purple-600" />
            <span className="text-sm font-semibold text-purple-900">Modo Simulacro</span>
            <span className="text-xs text-purple-700">- Los cambios se guardan solo en tu navegador</span>
          </div>
          
          {/* Multiplicador de valores */}
          <div className="flex items-center gap-3">
            <Calculator className="w-4 h-4 text-purple-600" />
            <label className="text-sm font-medium text-purple-900">
              Multiplicador:
            </label>
            <Input
              type="number"
              min="0.01"
              step="1"
              value={multiplier}
              onChange={(e) => {
                const value = parseFloat(e.target.value)
                if (!isNaN(value) && value > 0) {
                  setMultiplier(value)
                }
              }}
              className="w-24 text-right bg-white border-purple-300 focus:border-purple-500 focus:ring-purple-500"
            />
            <span className="text-xs text-purple-700">× todos los valores</span>
          </div>
        </div>
      </div>

      {/* Selector de configuración de México */}
      {countryCode === 'MX' && (
        <div className="px-6 py-4 border-b border-gray-200 bg-blue-50">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700">
              Configuración de costos:
            </label>
            <Select 
              value={mxConfigType} 
              onValueChange={(value: MxConfigType) => changeMxConfigType(value)}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="precio_lista">Precio de lista</SelectItem>
                <SelectItem value="gobierno">Gobierno</SelectItem>
                <SelectItem value="convenio">Convenio</SelectItem>
                <SelectItem value="lanzamiento">Lanzamiento</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <span className="inline-block w-2 h-2 bg-blue-500 rounded-full"></span>
              Cada configuración tiene valores independientes que puedes editar
            </div>
          </div>
        </div>
      )}

      {/* Selector de configuración de Chile */}
      {countryCode === 'CL' && (
        <div className="px-6 py-4 border-b border-gray-200 bg-blue-50">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700">
              Configuración de costos:
            </label>
            <Select 
              value={clConfigType} 
              onValueChange={(value: ClConfigType) => changeClConfigType(value)}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="precio_lista">Precio de lista</SelectItem>
                <SelectItem value="gobierno">Gobierno</SelectItem>
                <SelectItem value="convenio_christus">Convenio Christus</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <span className="inline-block w-2 h-2 bg-blue-500 rounded-full"></span>
              Cada configuración tiene valores independientes que puedes editar
            </div>
          </div>
        </div>
      )}

      {/* Selector de configuración de Colombia */}
      {countryCode === 'CO' && (
        <div className="px-6 py-4 border-b border-gray-200 bg-blue-50">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700">
              Configuración de costos:
            </label>
            <Select 
              value={colConfigType} 
              onValueChange={(value: ColConfigType) => changeColConfigType(value)}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="precio_lista">Lista de Precios</SelectItem>
                <SelectItem value="cali">Ciudad de CALI</SelectItem>
                <SelectItem value="bogota">Ciudad de BOGOTÁ</SelectItem>
                <SelectItem value="fedex">FedEx</SelectItem>
                <SelectItem value="copa">Copa</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <span className="inline-block w-2 h-2 bg-blue-500 rounded-full"></span>
              Cada configuración tiene valores independientes que puedes editar
            </div>
          </div>
        </div>
      )}
      
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Cálculo de Costos</h3>
          <div className="flex items-center gap-3">
            {saveStatus === 'saving' && (
              <span className="text-sm text-blue-600 flex items-center gap-2">
                <span className="inline-block w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                Guardando...
              </span>
            )}
            {saveStatus === 'saved' && (
              <span className="text-sm text-green-600 flex items-center gap-2">
                <span className="inline-block w-2 h-2 bg-green-500 rounded-full"></span>
                Guardado
              </span>
            )}
            {saveStatus === 'error' && (
              <span className="text-sm text-red-600 flex items-center gap-2">
                <span className="inline-block w-2 h-2 bg-red-500 rounded-full"></span>
                Error al guardar
              </span>
            )}
            <Button 
              onClick={resetAllToZero}
              variant="outline"
              className="text-yellow-600 border-yellow-300 hover:bg-yellow-50"
            >
              Reiniciar Parámetros
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-blue-200 bg-blue-50">
                <th className="px-6 py-3 text-left text-sm font-semibold text-blue-900">Concepto</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-blue-900">Monto (USD)</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-blue-900">Porcentaje</th>
              </tr>
            </thead>
            <tbody>
              {renderGrossSalesRow()}
              {renderEditableCell(
                discount.label,
                discount.amount,
                discount.pct,
                'commercialDiscountUSD',
                'commercialDiscountPct',
                'commercial-discount'
              )}
              
              <tr className="bg-gray-100 border-b-2 border-gray-300">
                <td className="px-6 py-3 text-sm font-semibold text-gray-900">{salesRevenue.label}</td>
                <td className="px-6 py-3 text-right text-sm font-bold text-gray-900">{formatCurrency(salesRevenue.amount * multiplier)}</td>
                <td className="px-6 py-3 text-right text-sm font-bold text-gray-900">{formatPercentage(salesRevenue.pct)}</td>
              </tr>

              <tr className="bg-orange-50 border-b border-orange-200">
                <td colSpan={3} className="px-6 py-2 text-sm font-semibold text-orange-900">{costOfSales.label}</td>
              </tr>

              {costRows.map((row, index) => {
                const fieldMap: Record<string, { amount: keyof OverrideFields, pct: keyof OverrideFields, cellId: string }> = {
                  'Product Cost': { amount: 'productCostUSD', pct: 'productCostPct', cellId: 'product-cost' },
                  'Kit Cost': { amount: 'kitCostUSD', pct: 'kitCostPct', cellId: 'kit-cost' },
                  'Payment Fee Costs': { amount: 'paymentFeeUSD', pct: 'paymentFeePct', cellId: 'payment-fee' },
                  'Blood Drawn & Sample Handling': { amount: 'bloodDrawSampleUSD', pct: 'bloodDrawSamplePct', cellId: 'blood-draw' },
                  'Sanitary Permits to export blood': { amount: 'sanitaryPermitsUSD', pct: 'sanitaryPermitsPct', cellId: 'sanitary-permits' },
                  'External Courier': { amount: 'externalCourierUSD', pct: 'externalCourierPct', cellId: 'external-courier' },
                  'Internal Courier': { amount: 'internalCourierUSD', pct: 'internalCourierPct', cellId: 'internal-courier' },
                  'Physicians Fees': { amount: 'physiciansFeesUSD', pct: 'physiciansFeesPct', cellId: 'physicians-fees' },
                  'Sales Commission': { amount: 'salesCommissionUSD', pct: 'salesCommissionPct', cellId: 'sales-commission' },
                }
                
                const fields = fieldMap[row.label]
                if (fields) {
                  return renderEditableCell(row.label, row.amount, row.pct, fields.amount, fields.pct, fields.cellId)
                }
                
                return null
              })}

              <tr className="bg-gray-100 border-b-2 border-gray-300">
                <td className="px-6 py-3 text-sm font-semibold text-gray-900">{totalCostOfSales.label}</td>
                <td className="px-6 py-3 text-right text-sm font-bold text-gray-900">{formatCurrency(totalCostOfSales.amount * multiplier)}</td>
                <td className="px-6 py-3 text-right text-sm font-bold text-gray-900">{formatPercentage(totalCostOfSales.pct)}</td>
              </tr>

              <tr className="bg-emerald-50 border-b-2 border-emerald-200">
                <td className="px-6 py-4 text-base font-bold text-emerald-900">{grossProfit.label}</td>
                <td className="px-6 py-4 text-right text-base font-bold text-emerald-900">{formatCurrency(grossProfit.amount * multiplier)}</td>
                <td className="px-6 py-4 text-right text-base font-bold text-emerald-900">{formatPercentage(grossProfit.pct)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>

      {/* Diálogo para editar comentarios */}
      <Dialog open={commentDialogOpen} onOpenChange={setCommentDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Comentario</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <textarea
              value={currentComment}
              onChange={(e) => setCurrentComment(e.target.value)}
              placeholder="Escribe un comentario para esta fila..."
              className="w-full min-h-[120px] p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCommentDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={saveComment}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

