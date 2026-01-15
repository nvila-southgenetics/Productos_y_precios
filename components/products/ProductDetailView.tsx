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
import { Info, AlertTriangle } from "lucide-react"

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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
      {/* Columna Izquierda - 70% */}
      <div className="lg:col-span-7 space-y-4">
        {/* Vista por País */}
        <div className="flex items-center justify-between">
          <Tabs value={selectedCountry} onValueChange={setSelectedCountry}>
            <TabsList>
              {countries.map((country) => (
                <TabsTrigger key={country.code} value={country.code}>
                  {country.name}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <Button variant="outline" onClick={handleReset}>
            Reiniciar Parámetros
          </Button>
        </div>

        {/* Encabezado */}
        <div>
          <h2 className="text-xl font-semibold mb-2">Cálculo de Costos</h2>
          <div className="flex gap-2 flex-wrap">
            {product.category && (
              <Badge
                className={`${categoryColors[product.category] || categoryColors["Otros"]} border`}
              >
                {product.category}
              </Badge>
            )}
            {product.tipo && (
              <Badge
                className={`${tipoColors[product.tipo] || "bg-gray-100 text-gray-700 border-gray-300"} border`}
              >
                {product.tipo}
              </Badge>
            )}
          </div>
        </div>

        {/* Tabla de Costos */}
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="h-12 px-4 text-left align-middle font-medium">Concepto</th>
                <th className="h-12 px-4 text-right align-middle font-medium">💵 USD</th>
                <th className="h-12 px-4 text-right align-middle font-medium">📊 %</th>
                <th className="h-12 px-4 text-left align-middle font-medium">Cuenta</th>
              </tr>
            </thead>
            <tbody>
              {/* Gross Sales */}
              <tr className="border-b">
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <Checkbox checked={true} disabled />
                    <span>Gross Sales (sin IVA)</span>
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
                      className="w-32 ml-auto"
                    />
                  ) : (
                    <span
                      className="cursor-pointer hover:bg-yellow-50 px-2 py-1 rounded transition-colors"
                      onDoubleClick={() => handleDoubleClick(costRows[0])}
                    >
                      {formatCurrency(grossSales)}
                    </span>
                  )}
                </td>
                <td className="p-4 text-right">100.00%</td>
                <td className="p-4 text-sm text-muted-foreground">4.1.1.6</td>
              </tr>

              {/* Commercial Discount */}
              <tr className="border-b">
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={costRows[1].getChecked(overrides)}
                      onChange={(checked) => handleCheckboxChange(costRows[1], checked)}
                    />
                    <span>Commercial Discount</span>
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
                      className="cursor-pointer hover:bg-yellow-50 px-2 py-1 rounded transition-colors"
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
                            "px-2 py-1 rounded transition-colors",
                            row.editable && "cursor-pointer hover:bg-yellow-50"
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
              <tr className="border-b bg-muted/30">
                <td className="p-4 font-medium">Total Cost of Sales</td>
                <td className="p-4 text-right font-medium">{formatCurrency(totalCostOfSales)}</td>
                <td className="p-4 text-right font-medium">
                  {formatPercentage(grossSales > 0 ? totalCostOfSales / grossSales : 0)}
                </td>
                <td className="p-4 text-sm text-muted-foreground">-</td>
              </tr>

              {/* Gross Profit */}
              <tr className="border-b bg-green-50">
                <td className="p-4 font-semibold text-green-900">Gross Profit</td>
                <td className="p-4 text-right font-semibold text-green-900">
                  {formatCurrency(grossProfit)}
                </td>
                <td className="p-4 text-right font-semibold text-green-900">
                  {formatPercentage(grossSales > 0 ? grossProfit / grossSales : 0)}
                </td>
                <td className="p-4 text-sm text-muted-foreground">-</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Mensajes informativos */}
        <div className="text-sm space-y-2">
          <div className="flex items-start gap-2 text-muted-foreground">
            <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <p>
              Haz doble clic en cualquier valor USD para editarlo. Los valores con % se calculan
              automáticamente.
            </p>
          </div>
          <div className="flex items-start gap-2 text-amber-600">
            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <p>Gross Sales es editable por país, cambio según el mercado local</p>
          </div>
        </div>

        {isSaving && (
          <div className="text-sm text-muted-foreground">Guardando cambios...</div>
        )}
      </div>

      {/* Columna Derecha - 30% */}
      <div className="lg:col-span-3">
        <div className="rounded-lg border bg-white p-4 space-y-4 sticky top-4">
          <h3 className="font-semibold text-lg">Información del Producto</h3>
          <div>
            <label className="text-sm text-muted-foreground">Nombre</label>
            <p className="font-medium mt-1">{product.name}</p>
          </div>
          <div>
            <label className="text-sm text-muted-foreground">SKU</label>
            <p className="font-medium mt-1">{product.sku}</p>
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Categoría</label>
            <div className="mt-1">
              {product.category && (
                <Badge
                  className={`${categoryColors[product.category] || categoryColors["Otros"]} border`}
                >
                  {product.category}
                </Badge>
              )}
            </div>
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Tipo</label>
            <div className="mt-1">
              {product.tipo && (
                <Badge
                  className={`${tipoColors[product.tipo] || "bg-gray-100 text-gray-700 border-gray-300"} border`}
                >
                  {product.tipo}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

