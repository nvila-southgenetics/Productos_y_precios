"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter, useParams } from "next/navigation"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { formatCurrency, formatPercentage, cn } from "@/lib/utils"
import type { ProductWithOverrides, ProductCountryOverride } from "@/lib/supabase-mcp"
import { updateProductCountryOverride, getProductsWithOverrides } from "@/lib/supabase-mcp"
import { Info, AlertTriangle, GitCompare, ChevronDown, Search } from "lucide-react"

interface ProductDetailViewProps {
  product: ProductWithOverrides
}

const countries = [
  { code: "AR", name: "Argentina" },
  { code: "CL", name: "Chile" },
  { code: "CO", name: "Colombia" },
  { code: "MX", name: "México" },
  { code: "UY", name: "Uruguay" },
  { code: "VE", name: "Venezuela" },
]

const categoryColors: Record<string, string> = {
  "Ginecología": "bg-pink-300/20 text-pink-200 border-pink-300/30",
  "Oncología": "bg-rose-300/20 text-rose-200 border-rose-300/30",
  "Urología": "bg-sky-300/20 text-sky-200 border-sky-300/30",
  "Endocrinología": "bg-violet-300/20 text-violet-200 border-violet-300/30",
  "Prenatales": "bg-teal-300/20 text-teal-200 border-teal-300/30",
  "Anualidades": "bg-amber-300/20 text-amber-200 border-amber-300/30",
  "Carrier": "bg-indigo-300/20 text-indigo-200 border-indigo-300/30",
  "Nutrición": "bg-lime-300/20 text-lime-200 border-lime-300/30",
  "Otros": "bg-slate-300/20 text-slate-200 border-slate-300/30",
}

const tipoColors: Record<string, string> = {
  "Sangre": "bg-red-300/20 text-red-200 border-red-300/30",
  "Corte de Tejido": "bg-blue-300/20 text-blue-200 border-blue-300/30",
  "Punción": "bg-purple-300/20 text-purple-200 border-purple-300/30",
  "Biopsia endometrial": "bg-fuchsia-300/20 text-fuchsia-200 border-fuchsia-300/30",
  "Hisopado bucal": "bg-emerald-300/20 text-emerald-200 border-emerald-300/30",
  "Sangre y corte tejido": "bg-orange-300/20 text-orange-200 border-orange-300/30",
  "Orina": "bg-cyan-300/20 text-cyan-200 border-cyan-300/30",
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
  const router = useRouter()
  const params = useParams()
  const currentProductId = params.productId as string
  
  const [selectedCountry, setSelectedCountry] = useState("UY")
  const [overrides, setOverrides] = useState<ProductCountryOverride["overrides"]>({})
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editValue, setEditValue] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null)
  const [isComparing, setIsComparing] = useState(false)
  const [selectedCountriesToCompare, setSelectedCountriesToCompare] = useState<string[]>([])
  const [allProducts, setAllProducts] = useState<{ id: string; name: string }[]>([])
  const [isLoadingProducts, setIsLoadingProducts] = useState(false)
  const [productSearchOpen, setProductSearchOpen] = useState(false)
  const [productSearchQuery, setProductSearchQuery] = useState("")
  const productSearchRef = useRef<HTMLDivElement>(null)
  const [reviewedStates, setReviewedStates] = useState<Record<string, boolean>>({})

  // Restaurar países seleccionados desde query params
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      const countriesParam = urlParams.get('countries')
      if (countriesParam) {
        const countries = countriesParam.split(',').filter(Boolean)
        if (countries.length > 0) {
          setSelectedCountriesToCompare(countries)
          setIsComparing(true)
        }
      }
    }
  }, [])

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (productSearchRef.current && !productSearchRef.current.contains(e.target as Node)) {
        setProductSearchOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Cargar lista de productos cuando se entra en modo comparación
  useEffect(() => {
    if (isComparing) {
      loadProducts()
    }
  }, [isComparing])

  const loadProducts = async () => {
    setIsLoadingProducts(true)
    try {
      const products = await getProductsWithOverrides()
      setAllProducts(products.map(p => ({ id: p.id, name: p.name })).sort((a, b) => a.name.localeCompare(b.name)))
    } catch (error) {
      console.error("Error loading products:", error)
    } finally {
      setIsLoadingProducts(false)
    }
  }

  const handleProductChange = (newProductId: string) => {
    if (newProductId !== currentProductId) {
      // Mantener países seleccionados en query params
      const countriesParam = selectedCountriesToCompare.length > 0 
        ? `?countries=${selectedCountriesToCompare.join(',')}`
        : ''
      router.push(`/productos/${newProductId}${countriesParam}`)
    }
  }

  // Cargar overrides del país seleccionado
  useEffect(() => {
    const countryOverride = product.country_overrides?.find(
      (o) => o.country_code === selectedCountry
    )
    setOverrides(countryOverride?.overrides || {})
  }, [product, selectedCountry])

  // Cargar estados de revisión desde los overrides
  useEffect(() => {
    const states: Record<string, boolean> = {}
    countries.forEach((country) => {
      const countryOverride = product.country_overrides?.find(
        (o) => o.country_code === country.code
      )
      states[country.code] = countryOverride?.overrides?.reviewed || false
    })
    setReviewedStates(states)
  }, [product])

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

  const handleReviewToggle = async (countryCode: string, checked: boolean) => {
    // Actualizar estado local inmediatamente para feedback visual
    setReviewedStates(prev => ({ ...prev, [countryCode]: checked }))
    
    try {
      const countryOverride = product.country_overrides?.find(
        (o) => o.country_code === countryCode
      )
      
      const currentOverrides = countryOverride?.overrides || {}
      const updatedOverrides: ProductCountryOverride["overrides"] = {
        ...currentOverrides,
        reviewed: checked,
      }

      // Actualizar o crear override en la base de datos
      await updateProductCountryOverride(
        product.id,
        countryCode as 'UY' | 'AR' | 'MX' | 'CL' | 'VE' | 'CO',
        updatedOverrides
      )

      // Actualizar el estado local si es el país seleccionado
      if (countryCode === selectedCountry) {
        setOverrides(updatedOverrides)
      }
    } catch (error) {
      console.error("Error al actualizar estado de revisión:", error)
      // Revertir el estado local en caso de error
      setReviewedStates(prev => ({ ...prev, [countryCode]: !checked }))
      alert("Error al guardar el estado de revisión. Intenta de nuevo.")
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
      reviewed: overrides.reviewed || false, // Mantener el estado de revisión
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
        <div className="mb-3 pb-2 border-b border-white/20">
          <h3 className="text-lg font-bold text-white">{countryName}</h3>
        </div>
        <div className="rounded-lg border border-white/20 overflow-hidden shadow-sm bg-white/10 backdrop-blur-sm">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/20 bg-white/10">
                <th className="h-12 px-3 text-left align-middle font-semibold text-white text-sm">Concepto</th>
                <th className="h-12 px-3 text-right align-middle font-semibold text-white text-sm">USD</th>
                <th className="h-12 px-3 text-right align-middle font-semibold text-white text-sm">%</th>
              </tr>
            </thead>
            <tbody>
              {/* Gross Sales */}
              <tr className="border-b border-white/10">
                <td className="p-3">
                  <span className="font-medium text-white/90 text-sm">Gross Sales</span>
                </td>
                <td className="p-3 text-right font-semibold text-blue-300 text-sm">
                  {formatCurrency(countryGrossSales)}
                </td>
                <td className="p-3 text-right font-medium text-white/70 text-sm">100.00%</td>
              </tr>

              {/* Commercial Discount */}
              <tr className="border-b border-white/10">
                <td className="p-3">
                  <span className="text-white/90 text-sm">Commercial Discount</span>
                </td>
                <td className="p-3 text-right font-medium text-white/90 text-sm">
                  {formatCurrency(countryCommercialDiscount)}
                </td>
                <td className="p-3 text-right text-white/70 text-sm">
                  {formatPercentage(countryGrossSales > 0 ? countryCommercialDiscount / countryGrossSales : 0)}
                </td>
              </tr>

              {/* Sales Revenue */}
              <tr className="border-b border-white/10 bg-white/5">
                <td className="p-3 font-medium text-sm text-white/90">Sales Revenue</td>
                <td className="p-3 text-right font-medium text-sm text-white">{formatCurrency(countrySalesRevenue)}</td>
                <td className="p-3 text-right font-medium text-sm text-white/70">
                  {formatPercentage(countryGrossSales > 0 ? countrySalesRevenue / countryGrossSales : 0)}
                </td>
              </tr>

              {/* Cost of Sales Header */}
              <tr className="border-b border-white/10 bg-white/5">
                <td className="p-3 font-semibold text-sm text-white" colSpan={3}>
                  --- Cost of Sales ---
                </td>
              </tr>

              {/* Cost Rows */}
              {costRows.slice(2).map((row) => {
                const isChecked = row.getChecked(countryOverrides)
                if (!isChecked) return null
                return (
                  <tr key={row.concept} className="border-b border-white/10">
                    <td className="p-3 text-white/90 text-sm">{row.concept}</td>
                    <td className="p-3 text-right font-medium text-white/90 text-sm">
                      {formatCurrency(row.getValue(countryOverrides))}
                    </td>
                    <td className="p-3 text-right text-white/70 text-sm">
                      {formatPercentage(row.getPct(countryOverrides, countryGrossSales) / 100)}
                    </td>
                  </tr>
                )
              })}

              {/* Total Cost of Sales */}
              <tr className="border-t-2 border-white/20 bg-white/5">
                <td className="p-3 font-semibold text-white text-sm">Total Cost of Sales</td>
                <td className="p-3 text-right font-semibold text-white text-sm">{formatCurrency(countryTotalCostOfSales)}</td>
                <td className="p-3 text-right font-semibold text-white text-sm">
                  {formatPercentage(countryGrossSales > 0 ? countryTotalCostOfSales / countryGrossSales : 0)}
                </td>
              </tr>

              {/* Gross Profit */}
              <tr className="border-t-2 border-white/30 bg-white/10">
                <td className="p-3 font-bold text-white text-sm">Gross Profit</td>
                <td className="p-3 text-right font-bold text-emerald-300 text-sm">
                  {formatCurrency(countryGrossProfit)}
                </td>
                <td className="p-3 text-right font-bold text-white text-sm">
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
    <div className="px-4">
      <div className={`grid grid-cols-1 gap-6 ${isComparing ? 'lg:grid-cols-1' : 'lg:grid-cols-10'}`}>
      {/* Columna Izquierda - 70% o 100% si está comparando */}
      <div className={isComparing ? "space-y-4" : "lg:col-span-7 space-y-4"}>
        {/* Vista por País */}
        <div className="flex items-center justify-between mb-6">
          {!isComparing ? (
            <>
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-4">
                  <Tabs value={selectedCountry} onValueChange={setSelectedCountry}>
                    <TabsList className="bg-white/10 border border-white/20 p-1">
                      {countries.map((country) => (
                        <TabsTrigger 
                          key={country.code}
                          value={country.code}
                          className={cn(
                            "rounded-sm px-3 py-1.5 text-sm font-medium transition-all",
                            selectedCountry === country.code
                              ? "bg-white/20 text-white shadow-sm"
                              : "text-white/70 hover:bg-white/10 hover:text-white"
                          )}
                        >
                          {country.name}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                </div>
                <div className="flex items-center gap-4 flex-wrap">
                  <span className="text-xs text-white/60 font-medium">Marcar como revisado:</span>
                  {countries.map((country) => {
                    const isReviewed = reviewedStates[country.code] || false
                    return (
                      <div key={country.code} className="flex items-center gap-2">
                        <Checkbox
                          id={`review-${country.code}`}
                          checked={isReviewed}
                          onCheckedChange={(checked) => handleReviewToggle(country.code, checked === true)}
                          className="data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500 border-white/30"
                        />
                        <label 
                          htmlFor={`review-${country.code}`}
                          className={cn(
                            "text-sm cursor-pointer transition-colors",
                            isReviewed 
                              ? "text-blue-300 font-medium" 
                              : "text-white/70 hover:text-white/90"
                          )}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {country.name}
                        </label>
                      </div>
                    )
                  })}
                </div>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={handleCompareCountries}
                  className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                >
                  <GitCompare className="h-4 w-4 mr-2" />
                  Comparar Países
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleReset}
                  className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                >
                  Reiniciar Parámetros
                </Button>
              </div>
            </>
          ) : (
            <div className="space-y-4 w-full">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">Comparación de Países</h3>
                <Button 
                  variant="outline" 
                  onClick={handleStopComparison}
                  className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                >
                  Salir de Comparación
                </Button>
              </div>
              {/* Selector de Producto con búsqueda */}
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-white/90 whitespace-nowrap">Producto:</label>
                <div className="relative flex-1 max-w-md" ref={productSearchRef}>
                  <button
                    type="button"
                    onClick={() => setProductSearchOpen(!productSearchOpen)}
                    className={cn(
                      "flex h-10 w-full items-center justify-between rounded-md border px-3 py-2 text-sm",
                      "bg-white/10 border-white/20 text-white focus:border-white/30 focus:ring-2 focus:ring-white/30 focus:ring-offset-0 focus:ring-offset-transparent",
                      "hover:bg-white/15"
                    )}
                    disabled={isLoadingProducts}
                  >
                    <span className="truncate">
                      {product.name || (isLoadingProducts ? "Cargando..." : "Seleccionar producto")}
                    </span>
                    <ChevronDown className={cn("h-4 w-4 opacity-70 transition-transform", productSearchOpen && "rotate-180")} />
                  </button>
                  {productSearchOpen && !isLoadingProducts && (
                    <div className="absolute z-50 mt-1 w-full rounded-md border border-white/20 bg-blue-950/95 backdrop-blur-sm py-2 shadow-lg max-h-64 overflow-hidden flex flex-col">
                      <div className="px-3 pb-2 border-b border-white/10">
                        <div className="relative">
                          <Search className="absolute left-2 top-2.5 h-4 w-4 text-white/50" />
                          <Input
                            type="text"
                            placeholder="Buscar producto..."
                            value={productSearchQuery}
                            onChange={(e) => setProductSearchQuery(e.target.value)}
                            className="pl-8 bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:border-white/30"
                            autoFocus
                          />
                        </div>
                      </div>
                      <div className="overflow-y-auto max-h-48">
                        {allProducts
                          .filter((p) =>
                            p.name.toLowerCase().includes(productSearchQuery.toLowerCase())
                          )
                          .map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                handleProductChange(p.id)
                                setProductSearchOpen(false)
                                setProductSearchQuery("")
                              }}
                              className={cn(
                                "flex w-full items-center px-3 py-2 text-sm text-white/90 hover:bg-white/10 transition-colors",
                                p.id === currentProductId && "bg-white/10 font-medium"
                              )}
                            >
                              {p.name}
                            </button>
                          ))}
                        {allProducts.filter((p) =>
                          p.name.toLowerCase().includes(productSearchQuery.toLowerCase())
                        ).length === 0 && (
                          <div className="px-3 py-2 text-sm text-white/60 text-center">
                            No se encontraron productos
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <p className="text-sm text-white/70">Selecciona países para ver los costos lado a lado:</p>
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
                          ? "bg-white/20 text-white border-white/30"
                          : "border-white/20 text-white/70 hover:bg-white/10 hover:border-white/30 hover:text-white"
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
          <div className="mb-4 pb-4 border-b border-white/20">
            <h2 className="text-2xl font-bold mb-3 text-white">
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
            <div className="mb-4 pb-4 border-b border-white/20">
              <h2 className="text-2xl font-bold mb-3 text-white">
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
                    className={`${tipoColors[product.tipo] || "bg-gray-500/20 text-gray-200 border-gray-400/30"} border shadow-sm`}
                  >
                    {product.tipo}
                  </Badge>
                )}
              </div>
            </div>
            {selectedCountriesToCompare.length === 0 ? (
              <div className="rounded-lg border border-white/20 bg-white/10 backdrop-blur-sm p-8 text-center text-white/70">
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
        <div className="rounded-lg border border-white/20 overflow-hidden shadow-sm bg-white/10 backdrop-blur-sm">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/20 bg-white/10">
                <th className="h-12 px-4 text-left align-middle font-semibold text-white">Concepto</th>
                <th className="h-12 px-4 text-right align-middle font-semibold text-white">USD</th>
                <th className="h-12 px-4 text-right align-middle font-semibold text-white">%</th>
                <th className="h-12 px-4 text-left align-middle font-semibold text-white">Cuenta</th>
              </tr>
            </thead>
            <tbody>
              {/* Gross Sales */}
              <tr className="border-b border-white/10 hover:bg-white/5 transition-colors">
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <Checkbox checked={true} disabled />
                    <span className="font-medium text-white/90">Gross Sales (sin IVA)</span>
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
                      className="w-32 ml-auto bg-white/10 border-white/20 text-white focus:border-white/40"
                    />
                  ) : (
                    <span
                      className="cursor-pointer hover:bg-white/10 px-3 py-1.5 rounded-md transition-all font-semibold text-blue-300 hover:text-blue-200 hover:shadow-sm"
                      onDoubleClick={() => handleDoubleClick(costRows[0])}
                    >
                      {formatCurrency(grossSales)}
                    </span>
                  )}
                </td>
                <td className="p-4 text-right font-medium text-white/70">100.00%</td>
                <td className="p-4 text-sm text-white/60">4.1.1.6</td>
              </tr>

              {/* Commercial Discount */}
              <tr className="border-b border-white/10 hover:bg-white/5 transition-colors">
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={costRows[1].getChecked(overrides)}
                      onChange={(checked) => handleCheckboxChange(costRows[1], checked)}
                    />
                    <span className="text-white/90">Commercial Discount</span>
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
                      className="w-32 ml-auto bg-white/10 border-white/20 text-white focus:border-white/40"
                    />
                  ) : (
                    <span
                      className="cursor-pointer hover:bg-white/10 px-3 py-1.5 rounded-md transition-all font-medium text-white/90 hover:text-white hover:shadow-sm"
                      onDoubleClick={() => handleDoubleClick(costRows[1])}
                    >
                      {formatCurrency(commercialDiscount)}
                    </span>
                  )}
                </td>
                <td className="p-4 text-right text-white/70">
                  {formatPercentage(costRows[1].getPct(overrides, grossSales) / 100)}
                </td>
                <td className="p-4 text-sm text-white/60">4.1.1.10</td>
              </tr>

              {/* Sales Revenue (calculado) */}
              <tr className="border-b border-white/10 bg-white/5">
                <td className="p-4 font-medium text-white/90">Sales Revenue</td>
                <td className="p-4 text-right font-medium text-white">{formatCurrency(salesRevenue)}</td>
                <td className="p-4 text-right font-medium text-white/70">
                  {formatPercentage(grossSales > 0 ? salesRevenue / grossSales : 0)}
                </td>
                <td className="p-4 text-sm text-white/60">-</td>
              </tr>

              {/* Cost of Sales Header */}
              <tr className="border-b border-white/10 bg-white/5">
                <td className="p-4 font-semibold text-white" colSpan={4}>
                  --- Cost of Sales ---
                </td>
              </tr>

              {/* Cost Rows */}
              {costRows.slice(2).map((row) => {
                const isChecked = row.getChecked(overrides)
                return (
                  <tr key={row.concept} className="border-b border-white/10 hover:bg-white/5">
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={isChecked}
                          onChange={(checked) => handleCheckboxChange(row, checked)}
                        />
                        <span className="text-white/90">{row.concept}</span>
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
                          className="w-32 ml-auto bg-white/10 border-white/20 text-white focus:border-white/40"
                        />
                      ) : (
                        <span
                          className={cn(
                            "px-3 py-1.5 rounded-md transition-all font-medium text-white/90",
                            row.editable && "cursor-pointer hover:bg-white/10 hover:text-white hover:shadow-sm"
                          )}
                          onDoubleClick={() => row.editable && handleDoubleClick(row)}
                        >
                          {formatCurrency(row.getValue(overrides))}
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-right text-white/70">
                      {formatPercentage(row.getPct(overrides, grossSales) / 100)}
                    </td>
                    <td className="p-4 text-sm text-white/60">{row.account}</td>
                  </tr>
                )
              })}

              {/* Total Cost of Sales */}
              <tr className="border-t-2 border-white/20 bg-white/5">
                <td className="p-4 font-semibold text-white">Total Cost of Sales</td>
                <td className="p-4 text-right font-semibold text-white">{formatCurrency(totalCostOfSales)}</td>
                <td className="p-4 text-right font-semibold text-white">
                  {formatPercentage(grossSales > 0 ? totalCostOfSales / grossSales : 0)}
                </td>
                <td className="p-4 text-sm text-white/60">-</td>
              </tr>

              {/* Gross Profit */}
              <tr className="border-t-2 border-white/30 bg-white/10">
                <td className="p-4 font-bold text-white">Gross Profit</td>
                <td className="p-4 text-right font-bold text-emerald-300">
                  {formatCurrency(grossProfit)}
                </td>
                <td className="p-4 text-right font-bold text-white">
                  {formatPercentage(grossSales > 0 ? grossProfit / grossSales : 0)}
                </td>
                <td className="p-4 text-sm text-white/60">-</td>
              </tr>
            </tbody>
          </table>
        </div>

            {/* Mensajes informativos */}
            <div className="text-sm space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-white/10 border border-white/20 backdrop-blur-sm">
                <Info className="h-4 w-4 mt-0.5 flex-shrink-0 text-blue-300" />
                <p className="text-white/90">
                  Haz doble clic en cualquier valor USD para editarlo. Los valores con % se calculan
                  automáticamente.
                </p>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-white/10 border border-white/20 backdrop-blur-sm">
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0 text-yellow-300" />
                <p className="text-white/90">Gross Sales es editable por país, cambio según el mercado local</p>
              </div>
            </div>

            {isSaving && (
              <div className="text-sm text-white/70">Guardando cambios...</div>
            )}
          </>
        )}
      </div>

      {/* Columna Derecha - 30% (oculta cuando está comparando) */}
      {!isComparing && (
        <div className="lg:col-span-3">
          <div className="rounded-lg border border-white/20 bg-white/10 backdrop-blur-sm shadow-sm p-6 space-y-5 sticky top-4">
          <div className="pb-4 border-b border-white/20">
            <h3 className="font-bold text-lg text-white">
              Información del Producto
            </h3>
          </div>
          <div>
            <label className="text-xs font-semibold text-white/70 uppercase tracking-wide">Nombre</label>
            <p className="font-semibold mt-2 text-white">{product.name}</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-white/70 uppercase tracking-wide">SKU</label>
            <p className="font-medium mt-2 text-white/80 font-mono">{product.sku}</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-white/70 uppercase tracking-wide">Categoría</label>
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
            <label className="text-xs font-semibold text-white/70 uppercase tracking-wide">Tipo</label>
            <div className="mt-2">
              {product.tipo && (
                <Badge
                  className={`${tipoColors[product.tipo] || "bg-gray-500/20 text-gray-200 border-gray-400/30"} border shadow-sm`}
                >
                  {product.tipo}
                </Badge>
              )}
            </div>
          </div>
        </div>
        </div>
      )}
      </div>
    </div>
  )
}

