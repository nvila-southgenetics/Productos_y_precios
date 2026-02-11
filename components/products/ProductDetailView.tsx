"use client"

import { useState, useEffect } from "react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { formatCurrency, formatPercentage, cn } from "@/lib/utils"
import type { ProductWithOverrides, ProductCountryOverride } from "@/lib/supabase-mcp"
import { updateProductCountryOverride } from "@/lib/supabase-mcp"
import { Info, AlertTriangle, GitCompare } from "lucide-react"

interface ProductDetailViewProps {
  product: ProductWithOverrides
}

const countries = [
  { code: "UY", name: "Uruguay" },
  { code: "AR", name: "Argentina" },
  { code: "MX", name: "México" },
  { code: "CL", name: "Chile" },
  { code: "VE", name: "Venezuela" },
  { code: "CO", name: "Colombia" },
]

const categoryColors: Record<string, string> = {
  "Ginecología": "bg-pink-100 text-pink-700 border-pink-300",
  "Oncología": "bg-red-100 text-red-700 border-red-300",
  "Urología": "bg-blue-100 text-blue-700 border-blue-300",
  "Endocrinología": "bg-purple-100 text-purple-700 border-purple-300",
  "Prenatales": "bg-green-100 text-green-700 border-green-300",
  "Anualidades": "bg-yellow-100 text-yellow-700 border-yellow-300",
  "Carrier": "bg-blue-100 text-blue-700 border-blue-300",
  "Nutrición": "bg-green-100 text-green-700 border-green-300",
  "Otros": "bg-gray-100 text-gray-700 border-gray-300",
}

const tipoColors: Record<string, string> = {
  "Sangre": "bg-red-100 text-red-700 border-red-300",
  "Corte de Tejido": "bg-blue-100 text-blue-700 border-blue-300",
  "Punción": "bg-purple-100 text-purple-700 border-purple-300",
  "Biopsia endometrial": "bg-pink-100 text-pink-700 border-pink-300",
  "Hisopado bucal": "bg-green-100 text-green-700 border-green-300",
  "Sangre y corte tejido": "bg-orange-100 text-orange-700 border-orange-300",
  "Orina": "bg-cyan-100 text-cyan-700 border-cyan-300",
}

interface CostRow {
  concept: string
  account: string
  editable: boolean
  defaultChecked: boolean
  getValue: (overrides: ProductCountryOverride["overrides"]) => number
  getPct: (overrides: ProductCountryOverride["overrides"], grossSales: number) => number
  setValue: (overrides: ProductCountryOverride["overrides"], value: number, grossSales: number) => ProductCountryOverride["overrides"]
  getChecked: (overrides: ProductCountryOverride["overrides"]) => boolean
  setChecked: (overrides: ProductCountryOverride["overrides"], checked: boolean) => ProductCountryOverride["overrides"]
}

export function ProductDetailView({ product }: ProductDetailViewProps) {
  const [selectedCountry, setSelectedCountry] = useState("UY")
  const [overrides, setOverrides] = useState<ProductCountryOverride["overrides"]>({})
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editValue, setEditValue] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null)
  const [isComparing, setIsComparing] = useState(false)
  const [selectedCountriesToCompare, setSelectedCountriesToCompare] = useState<string[]>([])

  // Cargar overrides del país seleccionado
  useEffect(() => {
    const countryOverride = product.country_overrides?.find(
      (o) => o.country_code === selectedCountry
    )
    setOverrides(countryOverride?.overrides || {})
  }, [product, selectedCountry])

  const grossSales = overrides.grossSalesUSD || 0
  const commercialDiscount = overrides.commercialDiscountUSD || 0
  const salesRevenue = grossSales - commercialDiscount

  const costRows: CostRow[] = [
    {
      concept: "Gross Sales (sin IVA)",
      account: "4.1.1.6",
      editable: true,
      defaultChecked: true,
      getValue: (o) => o.grossSalesUSD || 0,
      getPct: (o, gs) => 100,
      setValue: (o, v, gs) => ({ ...o, grossSalesUSD: v }),
      getChecked: () => true,
      setChecked: (o) => o,
    },
    {
      concept: "Commercial Discount",
      account: "4.1.1.10",
      editable: true,
      defaultChecked: false,
      getValue: (o) => o.commercialDiscountUSD || 0,
      getPct: (o, gs) => gs > 0 ? ((o.commercialDiscountUSD || 0) / gs) * 100 : 0,
      setValue: (o, v, gs) => ({
        ...o,
        commercialDiscountUSD: v,
        commercialDiscountPct: gs > 0 ? (v / gs) * 100 : 0,
      }),
      getChecked: (o) => (o.commercialDiscountUSD || 0) > 0,
      setChecked: (o, checked) => ({
        ...o,
        commercialDiscountUSD: checked ? (o.commercialDiscountUSD || 0) : 0,
        commercialDiscountPct: 0,
      }),
    },
    {
      concept: "Product Cost",
      account: "5.1.1.6",
      editable: true,
      defaultChecked: true,
      getValue: (o) => o.productCostUSD || 0,
      getPct: (o, gs) => gs > 0 ? ((o.productCostUSD || 0) / gs) * 100 : 0,
      setValue: (o, v, gs) => ({
        ...o,
        productCostUSD: v,
        productCostPct: gs > 0 ? (v / gs) * 100 : 0,
      }),
      getChecked: (o) => (o.productCostUSD || 0) > 0,
      setChecked: (o, checked) => ({
        ...o,
        productCostUSD: checked ? (o.productCostUSD || 0) : 0,
        productCostPct: 0,
      }),
    },
    {
      concept: "Kit Cost",
      account: "5.1.4.1.4",
      editable: true,
      defaultChecked: false,
      getValue: (o) => o.kitCostUSD || 0,
      getPct: (o, gs) => gs > 0 ? ((o.kitCostUSD || 0) / gs) * 100 : 0,
      setValue: (o, v, gs) => ({
        ...o,
        kitCostUSD: v,
        kitCostPct: gs > 0 ? (v / gs) * 100 : 0,
      }),
      getChecked: (o) => (o.kitCostUSD || 0) > 0,
      setChecked: (o, checked) => ({
        ...o,
        kitCostUSD: checked ? (o.kitCostUSD || 0) : 0,
        kitCostPct: 0,
      }),
    },
    {
      concept: "Payment Fee Costs",
      account: "-",
      editable: true,
      defaultChecked: false,
      getValue: (o) => o.paymentFeeUSD || 0,
      getPct: (o, gs) => gs > 0 ? ((o.paymentFeeUSD || 0) / gs) * 100 : 0,
      setValue: (o, v, gs) => ({
        ...o,
        paymentFeeUSD: v,
        paymentFeePct: gs > 0 ? (v / gs) * 100 : 0,
      }),
      getChecked: (o) => (o.paymentFeeUSD || 0) > 0,
      setChecked: (o, checked) => ({
        ...o,
        paymentFeeUSD: checked ? (o.paymentFeeUSD || 0) : 0,
        paymentFeePct: 0,
      }),
    },
    {
      concept: "Blood Drawn & Sample Handling",
      account: "5.1.4.1.2",
      editable: true,
      defaultChecked: false,
      getValue: (o) => o.bloodDrawSampleUSD || 0,
      getPct: (o, gs) => gs > 0 ? ((o.bloodDrawSampleUSD || 0) / gs) * 100 : 0,
      setValue: (o, v, gs) => ({
        ...o,
        bloodDrawSampleUSD: v,
        bloodDrawSamplePct: gs > 0 ? (v / gs) * 100 : 0,
      }),
      getChecked: (o) => (o.bloodDrawSampleUSD || 0) > 0,
      setChecked: (o, checked) => ({
        ...o,
        bloodDrawSampleUSD: checked ? (o.bloodDrawSampleUSD || 0) : 0,
        bloodDrawSamplePct: 0,
      }),
    },
    {
      concept: "Sanitary Permits to export blood",
      account: "5.1.x.x",
      editable: true,
      defaultChecked: false,
      getValue: (o) => o.sanitaryPermitsUSD || 0,
      getPct: (o, gs) => gs > 0 ? ((o.sanitaryPermitsUSD || 0) / gs) * 100 : 0,
      setValue: (o, v, gs) => ({
        ...o,
        sanitaryPermitsUSD: v,
        sanitaryPermitsPct: gs > 0 ? (v / gs) * 100 : 0,
      }),
      getChecked: (o) => (o.sanitaryPermitsUSD || 0) > 0,
      setChecked: (o, checked) => ({
        ...o,
        sanitaryPermitsUSD: checked ? (o.sanitaryPermitsUSD || 0) : 0,
        sanitaryPermitsPct: 0,
      }),
    },
    {
      concept: "External Courier",
      account: "5.1.2.4.2",
      editable: true,
      defaultChecked: false,
      getValue: (o) => o.externalCourierUSD || 0,
      getPct: (o, gs) => gs > 0 ? ((o.externalCourierUSD || 0) / gs) * 100 : 0,
      setValue: (o, v, gs) => ({
        ...o,
        externalCourierUSD: v,
        externalCourierPct: gs > 0 ? (v / gs) * 100 : 0,
      }),
      getChecked: (o) => (o.externalCourierUSD || 0) > 0,
      setChecked: (o, checked) => ({
        ...o,
        externalCourierUSD: checked ? (o.externalCourierUSD || 0) : 0,
        externalCourierPct: 0,
      }),
    },
    {
      concept: "Internal Courier",
      account: "5.1.2.4.1",
      editable: true,
      defaultChecked: false,
      getValue: (o) => o.internalCourierUSD || 0,
      getPct: (o, gs) => gs > 0 ? ((o.internalCourierUSD || 0) / gs) * 100 : 0,
      setValue: (o, v, gs) => ({
        ...o,
        internalCourierUSD: v,
        internalCourierPct: gs > 0 ? (v / gs) * 100 : 0,
      }),
      getChecked: (o) => (o.internalCourierUSD || 0) > 0,
      setChecked: (o, checked) => ({
        ...o,
        internalCourierUSD: checked ? (o.internalCourierUSD || 0) : 0,
        internalCourierPct: 0,
      }),
    },
    {
      concept: "Physicians Fees",
      account: "5.1.4.1.1",
      editable: true,
      defaultChecked: false,
      getValue: (o) => o.physiciansFeesUSD || 0,
      getPct: (o, gs) => gs > 0 ? ((o.physiciansFeesUSD || 0) / gs) * 100 : 0,
      setValue: (o, v, gs) => ({
        ...o,
        physiciansFeesUSD: v,
        physiciansFeesPct: gs > 0 ? (v / gs) * 100 : 0,
      }),
      getChecked: (o) => (o.physiciansFeesUSD || 0) > 0,
      setChecked: (o, checked) => ({
        ...o,
        physiciansFeesUSD: checked ? (o.physiciansFeesUSD || 0) : 0,
        physiciansFeesPct: 0,
      }),
    },
    {
      concept: "Sales Commission",
      account: "6.1.1.06",
      editable: true,
      defaultChecked: false,
      getValue: (o) => o.salesCommissionUSD || 0,
      getPct: (o, gs) => gs > 0 ? ((o.salesCommissionUSD || 0) / gs) * 100 : 0,
      setValue: (o, v, gs) => ({
        ...o,
        salesCommissionUSD: v,
        salesCommissionPct: gs > 0 ? (v / gs) * 100 : 0,
      }),
      getChecked: (o) => (o.salesCommissionUSD || 0) > 0,
      setChecked: (o, checked) => ({
        ...o,
        salesCommissionUSD: checked ? (o.salesCommissionUSD || 0) : 0,
        salesCommissionPct: 0,
      }),
    },
  ]

  const totalCostOfSales = costRows
    .filter((row) => row.concept !== "Gross Sales (sin IVA)" && row.concept !== "Commercial Discount" && row.getChecked(overrides))
    .reduce((sum, row) => sum + row.getValue(overrides), 0)

  const grossProfit = salesRevenue - totalCostOfSales

  const handleDoubleClick = (row: CostRow) => {
    if (!row.editable) return
    setEditingField(row.concept)
    setEditValue(row.getValue(overrides).toString())
  }

  const handleSaveEdit = () => {
    if (!editingField) return

    const row = costRows.find((r) => r.concept === editingField)
    if (!row) return

    const value = parseFloat(editValue) || 0
    if (value < 0) {
      alert("No se permiten valores negativos")
      setEditingField(null)
      setEditValue("")
      return
    }

    const newOverrides = row.setValue(overrides, value, grossSales)
    setOverrides(newOverrides)
    setEditingField(null)
    setEditValue("")

    // Guardar con debounce
    if (saveTimeout) clearTimeout(saveTimeout)
    const timeout = setTimeout(() => {
      saveOverrides(newOverrides)
    }, 500)
    setSaveTimeout(timeout)
  }

  const handleCheckboxChange = (row: CostRow, checked: boolean) => {
    const newOverrides = row.setChecked(overrides, checked)
    setOverrides(newOverrides)

    // Guardar inmediatamente al cambiar checkbox
    saveOverrides(newOverrides)
  }

  const saveOverrides = async (newOverrides: ProductCountryOverride["overrides"]) => {
    setIsSaving(true)
    try {
      await updateProductCountryOverride(product.id, selectedCountry, newOverrides)
      // TODO: Mostrar toast de éxito
    } catch (error) {
      console.error("Error saving overrides:", error)
      alert("Error al guardar los cambios. Intenta de nuevo.")
    } finally {
      setIsSaving(false)
    }
  }

  const handleReset = () => {
    const countryName = countries.find(c => c.code === selectedCountry)?.name || selectedCountry
    if (!confirm(`¿Estás seguro? Esto eliminará todos los valores personalizados para ${countryName}.`)) {
      return
    }

    const resetOverrides: ProductCountryOverride["overrides"] = {
      grossSalesUSD: overrides.grossSalesUSD || 0,
      commercialDiscountUSD: 0,
      commercialDiscountPct: 0,
      productCostUSD: 0,
      productCostPct: 0,
      kitCostUSD: 0,
      kitCostPct: 0,
      paymentFeeUSD: 0,
      paymentFeePct: 0,
      bloodDrawSampleUSD: 0,
      bloodDrawSamplePct: 0,
      sanitaryPermitsUSD: 0,
      sanitaryPermitsPct: 0,
      externalCourierUSD: 0,
      externalCourierPct: 0,
      internalCourierUSD: 0,
      internalCourierPct: 0,
      physiciansFeesUSD: 0,
      physiciansFeesPct: 0,
      salesCommissionUSD: 0,
      salesCommissionPct: 0,
    }

    setOverrides(resetOverrides)
    saveOverrides(resetOverrides)
  }

  const handleCompareCountries = () => {
    setIsComparing(true)
    setSelectedCountriesToCompare([])
  }

  const handleStopComparison = () => {
    setIsComparing(false)
    setSelectedCountriesToCompare([])
  }

  const toggleCountryInComparison = (code: string) => {
    setSelectedCountriesToCompare((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    )
  }

  // Función helper para renderizar una tabla de costos para un país específico
  const renderCostTable = (countryCode: string, countryOverrides: ProductCountryOverride["overrides"]) => {
    const countryGrossSales = countryOverrides.grossSalesUSD || 0
    const countryCommercialDiscount = countryOverrides.commercialDiscountUSD || 0
    const countrySalesRevenue = countryGrossSales - countryCommercialDiscount
    const countryTotalCostOfSales = costRows
      .filter((row) => row.concept !== "Gross Sales (sin IVA)" && row.concept !== "Commercial Discount" && row.getChecked(countryOverrides))
      .reduce((sum, row) => sum + row.getValue(countryOverrides), 0)
    const countryGrossProfit = countrySalesRevenue - countryTotalCostOfSales
    const countryName = countries.find(c => c.code === countryCode)?.name || countryCode

    return (
      <div key={countryCode} className="flex-shrink-0 w-[min(100%,320px)] min-w-[280px]">
        <div className="mb-3 pb-2 border-b border-blue-200">
          <h3 className="text-lg font-bold text-blue-900">{countryName}</h3>
        </div>
        <div className="rounded-lg border border-blue-200/50 overflow-hidden shadow-sm bg-white">
          <table className="w-full">
            <thead>
              <tr className="border-b border-blue-200 bg-gradient-to-r from-blue-50 to-blue-100/50">
                <th className="h-12 px-3 text-left align-middle font-semibold text-blue-900 text-sm">Concepto</th>
                <th className="h-12 px-3 text-right align-middle font-semibold text-blue-900 text-sm">USD</th>
                <th className="h-12 px-3 text-right align-middle font-semibold text-blue-900 text-sm">%</th>
              </tr>
            </thead>
            <tbody>
              {/* Gross Sales */}
              <tr className="border-b border-blue-100/50">
                <td className="p-3">
                  <span className="font-medium text-slate-700 text-sm">Gross Sales</span>
                </td>
                <td className="p-3 text-right font-semibold text-blue-700 text-sm">
                  {formatCurrency(countryGrossSales)}
                </td>
                <td className="p-3 text-right font-medium text-slate-600 text-sm">100.00%</td>
              </tr>

              {/* Commercial Discount */}
              <tr className="border-b border-blue-100/50">
                <td className="p-3">
                  <span className="text-slate-700 text-sm">Commercial Discount</span>
                </td>
                <td className="p-3 text-right font-medium text-slate-700 text-sm">
                  {formatCurrency(countryCommercialDiscount)}
                </td>
                <td className="p-3 text-right text-slate-600 text-sm">
                  {formatPercentage(countryGrossSales > 0 ? countryCommercialDiscount / countryGrossSales : 0)}
                </td>
              </tr>

              {/* Sales Revenue */}
              <tr className="border-b bg-muted/30">
                <td className="p-3 font-medium text-sm">Sales Revenue</td>
                <td className="p-3 text-right font-medium text-sm">{formatCurrency(countrySalesRevenue)}</td>
                <td className="p-3 text-right font-medium text-sm">
                  {formatPercentage(countryGrossSales > 0 ? countrySalesRevenue / countryGrossSales : 0)}
                </td>
              </tr>

              {/* Cost of Sales Header */}
              <tr className="border-b bg-muted/50">
                <td className="p-3 font-semibold text-sm" colSpan={3}>
                  --- Cost of Sales ---
                </td>
              </tr>

              {/* Cost Rows */}
              {costRows.slice(2).map((row) => {
                const isChecked = row.getChecked(countryOverrides)
                if (!isChecked) return null
                return (
                  <tr key={row.concept} className="border-b border-blue-100/50">
                    <td className="p-3 text-slate-700 text-sm">{row.concept}</td>
                    <td className="p-3 text-right font-medium text-slate-700 text-sm">
                      {formatCurrency(row.getValue(countryOverrides))}
                    </td>
                    <td className="p-3 text-right text-slate-600 text-sm">
                      {formatPercentage(row.getPct(countryOverrides, countryGrossSales) / 100)}
                    </td>
                  </tr>
                )
              })}

              {/* Total Cost of Sales */}
              <tr className="border-t-2 border-blue-200 bg-gradient-to-r from-blue-50/50 to-transparent">
                <td className="p-3 font-semibold text-blue-900 text-sm">Total Cost of Sales</td>
                <td className="p-3 text-right font-semibold text-blue-900 text-sm">{formatCurrency(countryTotalCostOfSales)}</td>
                <td className="p-3 text-right font-semibold text-blue-900 text-sm">
                  {formatPercentage(countryGrossSales > 0 ? countryTotalCostOfSales / countryGrossSales : 0)}
                </td>
              </tr>

              {/* Gross Profit */}
              <tr className="border-t-2 border-blue-300 bg-gradient-to-r from-blue-50 to-blue-100/50">
                <td className="p-3 font-bold text-blue-900 text-sm">Gross Profit</td>
                <td className="p-3 text-right font-bold text-blue-900 text-sm">
                  {formatCurrency(countryGrossProfit)}
                </td>
                <td className="p-3 text-right font-bold text-blue-900 text-sm">
                  {formatPercentage(countryGrossSales > 0 ? countryGrossProfit / countryGrossSales : 0)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-7xl px-4">
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
      {/* Columna Izquierda - 70% */}
      <div className="lg:col-span-7 space-y-4">
        {/* Vista por País */}
        <div className="flex items-center justify-between mb-6">
          {!isComparing ? (
            <>
              <Tabs value={selectedCountry} onValueChange={setSelectedCountry}>
                <TabsList className="bg-blue-50/50 border border-blue-200/50">
                  {countries.map((country) => (
                    <TabsTrigger 
                      key={country.code} 
                      value={country.code}
                      className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-blue-700 data-[state=active]:text-white data-[state=active]:shadow-blue"
                    >
                      {country.name}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={handleCompareCountries}
                  className="border-blue-300 text-blue-700 hover:bg-blue-50 hover:border-blue-400"
                >
                  <GitCompare className="h-4 w-4 mr-2" />
                  Comparar Países
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleReset}
                  className="border-blue-300 text-blue-700 hover:bg-blue-50 hover:border-blue-400"
                >
                  Reiniciar Parámetros
                </Button>
              </div>
            </>
          ) : (
            <div className="space-y-4 w-full">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-blue-900">Comparación de Países</h3>
                <Button 
                  variant="outline" 
                  onClick={handleStopComparison}
                  className="border-blue-300 text-blue-700 hover:bg-blue-50 hover:border-blue-400"
                >
                  Salir de Comparación
                </Button>
              </div>
              <p className="text-sm text-slate-600">Selecciona países para ver los costos lado a lado:</p>
              <div className="flex flex-wrap gap-2">
                {countries.map((country) => {
                  const selected = selectedCountriesToCompare.includes(country.code)
                  return (
                    <button
                      key={country.code}
                      type="button"
                      onClick={() => toggleCountryInComparison(country.code)}
                      className={cn(
                        "px-4 py-2 rounded-lg text-sm font-medium border transition-all",
                        selected
                          ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white border-blue-600 shadow-blue"
                          : "border-blue-200 text-slate-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700"
                      )}
                    >
                      {country.name}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Encabezado */}
        {!isComparing && (
          <div className="mb-4 pb-4 border-b border-blue-100">
            <h2 className="text-2xl font-bold mb-3 bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
              Cálculo de Costos
            </h2>
            <div className="flex gap-2 flex-wrap">
              {product.category && (
                <Badge
                  className={`${categoryColors[product.category] || categoryColors["Otros"]} border shadow-sm`}
                >
                  {product.category}
                </Badge>
              )}
              {product.tipo && (
                <Badge
                  className={`${tipoColors[product.tipo] || "bg-gray-100 text-gray-700 border-gray-300"} border shadow-sm`}
                >
                  {product.tipo}
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Vista de Comparación o Vista Normal */}
        {isComparing ? (
          <div className="space-y-4">
            <div className="mb-4 pb-4 border-b border-blue-100">
              <h2 className="text-2xl font-bold mb-3 bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
                Comparación de Costos
              </h2>
              <div className="flex gap-2 flex-wrap">
                {product.category && (
                  <Badge
                    className={`${categoryColors[product.category] || categoryColors["Otros"]} border shadow-sm`}
                  >
                    {product.category}
                  </Badge>
                )}
                {product.tipo && (
                  <Badge
                    className={`${tipoColors[product.tipo] || "bg-gray-100 text-gray-700 border-gray-300"} border shadow-sm`}
                  >
                    {product.tipo}
                  </Badge>
                )}
              </div>
            </div>
            {selectedCountriesToCompare.length === 0 ? (
              <div className="rounded-lg border border-blue-200/50 bg-blue-50/30 p-8 text-center text-slate-600">
                Selecciona uno o más países arriba para ver la comparación de costos.
              </div>
            ) : (
              <div className="flex flex-nowrap gap-4 overflow-x-auto pb-4 w-full">
                {selectedCountriesToCompare.map((countryCode) => {
                  const countryOverride = product.country_overrides?.find(
                    (o) => o.country_code === countryCode
                  )
                  const countryOverrides = countryOverride?.overrides || {}
                  return renderCostTable(countryCode, countryOverrides)
                })}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Tabla de Costos */}
        <div className="rounded-lg border border-blue-200/50 overflow-hidden shadow-sm bg-white">
          <table className="w-full">
            <thead>
              <tr className="border-b border-blue-200 bg-gradient-to-r from-blue-50 to-blue-100/50">
                <th className="h-12 px-4 text-left align-middle font-semibold text-blue-900">Concepto</th>
                <th className="h-12 px-4 text-right align-middle font-semibold text-blue-900">USD</th>
                <th className="h-12 px-4 text-right align-middle font-semibold text-blue-900">%</th>
                <th className="h-12 px-4 text-left align-middle font-semibold text-blue-900">Cuenta</th>
              </tr>
            </thead>
            <tbody>
              {/* Gross Sales */}
              <tr className="border-b border-blue-100/50 hover:bg-blue-50/30 transition-colors">
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <Checkbox checked={true} disabled />
                    <span className="font-medium text-slate-700">Gross Sales (sin IVA)</span>
                  </div>
                </td>
                <td className="p-4 text-right">
                  {editingField === "Gross Sales (sin IVA)" ? (
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={handleSaveEdit}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveEdit()
                        if (e.key === "Escape") {
                          setEditingField(null)
                          setEditValue("")
                        }
                      }}
                      autoFocus
                      className="w-32 ml-auto border-blue-300 focus:border-blue-500 focus:ring-blue-500"
                    />
                  ) : (
                    <span
                      className="cursor-pointer hover:bg-blue-50 px-3 py-1.5 rounded-md transition-all font-semibold text-blue-700 hover:text-blue-800 hover:shadow-sm"
                      onDoubleClick={() => handleDoubleClick(costRows[0])}
                    >
                      {formatCurrency(grossSales)}
                    </span>
                  )}
                </td>
                <td className="p-4 text-right font-medium text-slate-600">100.00%</td>
                <td className="p-4 text-sm text-slate-500">4.1.1.6</td>
              </tr>

              {/* Commercial Discount */}
              <tr className="border-b border-blue-100/50 hover:bg-blue-50/30 transition-colors">
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={costRows[1].getChecked(overrides)}
                      onChange={(checked) => handleCheckboxChange(costRows[1], checked)}
                    />
                    <span className="text-slate-700">Commercial Discount</span>
                  </div>
                </td>
                <td className="p-4 text-right">
                  {editingField === "Commercial Discount" ? (
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={handleSaveEdit}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveEdit()
                        if (e.key === "Escape") {
                          setEditingField(null)
                          setEditValue("")
                        }
                      }}
                      autoFocus
                      className="w-32 ml-auto"
                    />
                  ) : (
                    <span
                      className="cursor-pointer hover:bg-blue-50 px-3 py-1.5 rounded-md transition-all font-medium text-slate-700 hover:text-blue-700 hover:shadow-sm"
                      onDoubleClick={() => handleDoubleClick(costRows[1])}
                    >
                      {formatCurrency(commercialDiscount)}
                    </span>
                  )}
                </td>
                <td className="p-4 text-right">
                  {formatPercentage(costRows[1].getPct(overrides, grossSales) / 100)}
                </td>
                <td className="p-4 text-sm text-muted-foreground">4.1.1.10</td>
              </tr>

              {/* Sales Revenue (calculado) */}
              <tr className="border-b bg-muted/30">
                <td className="p-4 font-medium">Sales Revenue</td>
                <td className="p-4 text-right font-medium">{formatCurrency(salesRevenue)}</td>
                <td className="p-4 text-right font-medium">
                  {formatPercentage(grossSales > 0 ? salesRevenue / grossSales : 0)}
                </td>
                <td className="p-4 text-sm text-muted-foreground">-</td>
              </tr>

              {/* Cost of Sales Header */}
              <tr className="border-b bg-muted/50">
                <td className="p-4 font-semibold" colSpan={4}>
                  --- Cost of Sales ---
                </td>
              </tr>

              {/* Cost Rows */}
              {costRows.slice(2).map((row) => {
                const isChecked = row.getChecked(overrides)
                return (
                  <tr key={row.concept} className="border-b">
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={isChecked}
                          onChange={(checked) => handleCheckboxChange(row, checked)}
                        />
                        <span>{row.concept}</span>
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      {editingField === row.concept ? (
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={handleSaveEdit}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveEdit()
                            if (e.key === "Escape") {
                              setEditingField(null)
                              setEditValue("")
                            }
                          }}
                          autoFocus
                          className="w-32 ml-auto"
                        />
                      ) : (
                        <span
                          className={cn(
                            "px-3 py-1.5 rounded-md transition-all font-medium text-slate-700",
                            row.editable && "cursor-pointer hover:bg-blue-50 hover:text-blue-700 hover:shadow-sm"
                          )}
                          onDoubleClick={() => row.editable && handleDoubleClick(row)}
                        >
                          {formatCurrency(row.getValue(overrides))}
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      {formatPercentage(row.getPct(overrides, grossSales) / 100)}
                    </td>
                    <td className="p-4 text-sm text-muted-foreground">{row.account}</td>
                  </tr>
                )
              })}

              {/* Total Cost of Sales */}
              <tr className="border-t-2 border-blue-200 bg-gradient-to-r from-blue-50/50 to-transparent">
                <td className="p-4 font-semibold text-blue-900">Total Cost of Sales</td>
                <td className="p-4 text-right font-semibold text-blue-900">{formatCurrency(totalCostOfSales)}</td>
                <td className="p-4 text-right font-semibold text-blue-900">
                  {formatPercentage(grossSales > 0 ? totalCostOfSales / grossSales : 0)}
                </td>
                <td className="p-4 text-sm text-slate-500">-</td>
              </tr>

              {/* Gross Profit */}
              <tr className="border-t-2 border-blue-300 bg-gradient-to-r from-blue-50 to-blue-100/50">
                <td className="p-4 font-bold text-blue-900">Gross Profit</td>
                <td className="p-4 text-right font-bold text-blue-900">
                  {formatCurrency(grossProfit)}
                </td>
                <td className="p-4 text-right font-bold text-blue-900">
                  {formatPercentage(grossSales > 0 ? grossProfit / grossSales : 0)}
                </td>
                <td className="p-4 text-sm text-slate-500">-</td>
              </tr>
            </tbody>
          </table>
        </div>

            {/* Mensajes informativos */}
            <div className="text-sm space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50/50 border border-blue-200/50">
                <Info className="h-4 w-4 mt-0.5 flex-shrink-0 text-blue-600" />
                <p className="text-blue-900">
                  Haz doble clic en cualquier valor USD para editarlo. Los valores con % se calculan
                  automáticamente.
                </p>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50/50 border border-blue-200/50">
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0 text-blue-600" />
                <p className="text-blue-900">Gross Sales es editable por país, cambio según el mercado local</p>
              </div>
            </div>

            {isSaving && (
              <div className="text-sm text-muted-foreground">Guardando cambios...</div>
            )}
          </>
        )}
      </div>

      {/* Columna Derecha - 30% */}
      <div className="lg:col-span-3">
        <div className="rounded-lg border border-blue-200/50 bg-white shadow-sm p-6 space-y-5 sticky top-4">
          <div className="pb-4 border-b border-blue-100">
            <h3 className="font-bold text-lg bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
              Información del Producto
            </h3>
          </div>
          <div>
            <label className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Nombre</label>
            <p className="font-semibold mt-2 text-slate-800">{product.name}</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-blue-700 uppercase tracking-wide">SKU</label>
            <p className="font-medium mt-2 text-slate-600 font-mono">{product.sku}</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Categoría</label>
            <div className="mt-2">
              {product.category && (
                <Badge
                  className={`${categoryColors[product.category] || categoryColors["Otros"]} border shadow-sm`}
                >
                  {product.category}
                </Badge>
              )}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Tipo</label>
            <div className="mt-2">
              {product.tipo && (
                <Badge
                  className={`${tipoColors[product.tipo] || "bg-gray-100 text-gray-700 border-gray-300"} border shadow-sm`}
                >
                  {product.tipo}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  )
}

