"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { formatCurrency, formatPercentage, cn } from "@/lib/utils"
import type { ProductWithOverrides, ProductCountryOverride } from "@/lib/supabase-mcp"
import { updateProductCountryOverride } from "@/lib/supabase-mcp"

interface ProductDetailModalProps {
  product: ProductWithOverrides | null
  open: boolean
  onClose: () => void
  onSave: () => void
}

interface CostRow {
  concept: string
  account?: string
  editable: boolean
  defaultChecked?: boolean
  getValue: (overrides: ProductCountryOverride["overrides"]) => number
  getPct: (overrides: ProductCountryOverride["overrides"], grossSales: number) => number
  setValue: (overrides: ProductCountryOverride["overrides"], value: number, grossSales: number) => ProductCountryOverride["overrides"]
  getChecked: (overrides: ProductCountryOverride["overrides"]) => boolean
  setChecked: (overrides: ProductCountryOverride["overrides"], checked: boolean) => ProductCountryOverride["overrides"]
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
  "Ginecología": "bg-pink-200 text-pink-800 border-pink-300",
  "Oncología": "bg-rose-200 text-rose-800 border-rose-300",
  "Urología": "bg-sky-200 text-sky-800 border-sky-300",
  "Endocrinología": "bg-violet-200 text-violet-800 border-violet-300",
  "Prenatales": "bg-teal-200 text-teal-800 border-teal-300",
  "Anualidades": "bg-amber-200 text-amber-800 border-amber-300",
  "Carrier": "bg-indigo-200 text-indigo-800 border-indigo-300",
  "Nutrición": "bg-lime-200 text-lime-800 border-lime-300",
  "Otros": "bg-slate-200 text-slate-800 border-slate-300",
}

const tipoColors: Record<string, string> = {
  "Sangre": "bg-red-200 text-red-800 border-red-300",
  "Corte de Tejido": "bg-blue-200 text-blue-800 border-blue-300",
  "Punción": "bg-purple-200 text-purple-800 border-purple-300",
  "Biopsia endometrial": "bg-fuchsia-200 text-fuchsia-800 border-fuchsia-300",
  "Hisopado bucal": "bg-emerald-200 text-emerald-800 border-emerald-300",
  "Sangre y corte tejido": "bg-orange-200 text-orange-800 border-orange-300",
  "Orina": "bg-cyan-200 text-cyan-800 border-cyan-300",
}

export function ProductDetailModal({
  product,
  open,
  onClose,
  onSave,
}: ProductDetailModalProps) {
  const [selectedCountry, setSelectedCountry] = useState("UY")
  const [overrides, setOverrides] = useState<ProductCountryOverride["overrides"]>({})
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editValue, setEditValue] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (product) {
      const countryOverride = product.country_overrides?.find(
        (o) => o.country_code === selectedCountry
      )
      setOverrides(countryOverride?.overrides || {})
    }
  }, [product, selectedCountry])

  if (!product) return null

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
      account: "4.1.1.6.1",
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
      account: "5.1.4.1.1",
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
      account: "5.1.4.1.2",
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
      account: "5.1.4.1.3",
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
      account: "5.1.4.1.4",
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
      account: "5.1.4.1.5",
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
      account: "5.1.4.1.6",
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
      account: "5.1.4.1.7",
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
      account: "5.1.4.1.8",
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
      account: "5.1.4.1.9",
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
    const newOverrides = row.setValue(overrides, value, grossSales)
    setOverrides(newOverrides)
    setEditingField(null)
    setEditValue("")
  }

  const handleCheckboxChange = (row: CostRow, checked: boolean) => {
    const newOverrides = row.setChecked(overrides, checked)
    setOverrides(newOverrides)
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await updateProductCountryOverride(product.id, selectedCountry, overrides)
      onSave()
      onClose()
    } catch (error) {
      console.error("Error saving overrides:", error)
      alert("Error al guardar los cambios")
    } finally {
      setIsSaving(false)
    }
  }

  const handleReset = () => {
    setOverrides({})
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
        <DialogClose onClose={onClose} />
        <DialogHeader>
          <DialogTitle>{product.name}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-4">
          {/* Panel Izquierdo - Cálculo de Costos */}
          <div className="lg:col-span-2 space-y-4">
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
                  className={`${tipoColors[product.tipo] || "bg-gray-50 text-gray-700 border-gray-200"} border`}
                >
                  {product.tipo}
                </Badge>
              )}
            </div>

            <div className="rounded-md border">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="h-12 px-4 text-left align-middle font-medium">Concepto</th>
                    <th className="h-12 px-4 text-right align-middle font-medium">USD</th>
                    <th className="h-12 px-4 text-right align-middle font-medium">%</th>
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
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={handleSaveEdit}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveEdit()
                          }}
                          autoFocus
                          className="w-24 ml-auto"
                        />
                      ) : (
                        <span
                          className="cursor-pointer hover:bg-muted px-2 py-1 rounded"
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
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={handleSaveEdit}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveEdit()
                          }}
                          autoFocus
                          className="w-24 ml-auto"
                        />
                      ) : (
                        <span
                          className="cursor-pointer hover:bg-muted px-2 py-1 rounded"
                          onDoubleClick={() => handleDoubleClick(costRows[1])}
                        >
                          {formatCurrency(commercialDiscount)}
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      {formatPercentage(costRows[1].getPct(overrides, grossSales) / 100)}
                    </td>
                    <td className="p-4 text-sm text-muted-foreground">4.1.1.6.1</td>
                  </tr>

                  {/* Sales Revenue (calculado) */}
                  <tr className="border-b bg-muted/30">
                    <td className="p-4 font-medium">Sales Revenue</td>
                    <td className="p-4 text-right font-medium">{formatCurrency(salesRevenue)}</td>
                    <td className="p-4 text-right font-medium">
                      {formatPercentage(grossSales > 0 ? salesRevenue / grossSales : 0)}
                    </td>
                    <td className="p-4"></td>
                  </tr>

                  {/* Cost of Sales Header */}
                  <tr className="border-b bg-muted/50">
                    <td className="p-4 font-semibold" colSpan={4}>
                      Cost of Sales
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
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={handleSaveEdit}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleSaveEdit()
                              }}
                              autoFocus
                              className="w-24 ml-auto"
                            />
                          ) : (
                            <span
                              className={cn(
                                "px-2 py-1 rounded",
                                row.editable && "cursor-pointer hover:bg-muted"
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
                    <td className="p-4"></td>
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
                    <td className="p-4"></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="text-sm text-muted-foreground space-y-2">
              <p>
                Haz doble clic en cualquier valor USD para editarlo. Los valores con % se calculan
                automáticamente.
              </p>
              <p className="text-amber-600">
                ⚠️ Gross Sales es editable por país, cambio según el mercado local
              </p>
            </div>
          </div>

          {/* Panel Derecho - Información del Producto */}
          <div className="space-y-4">
            <div className="rounded-lg border p-4 space-y-4">
              <h3 className="font-semibold text-lg">Información del Producto</h3>
              <div>
                <label className="text-sm text-muted-foreground">Nombre</label>
                <p className="font-medium">{product.name}</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">SKU</label>
                <p className="font-medium">{product.sku}</p>
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
                      className={`${tipoColors[product.tipo] || "bg-gray-50 text-gray-700 border-gray-200"} border`}
                    >
                      {product.tipo}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={isSaving} className="flex-1">
                {isSaving ? "Guardando..." : "Guardar Cambios"}
              </Button>
              <Button variant="outline" onClick={onClose}>
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}



