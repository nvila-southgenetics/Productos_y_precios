"use client"

import { useEffect, useState, useCallback, useMemo, type ReactNode } from "react"
import { supabase } from "@/lib/supabase"
import { ChevronDown, ChevronRight, Plus, Table2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { displayProductName, displayProductLabelFromName, formatNumber } from "@/lib/utils"
import { useProductCreateDialog } from "@/components/products/ProductCreateDialogProvider"

// ─── Types ────────────────────────────────────────────────────────────────────

interface PLTableProps {
  modelo: "budget" | "real"
  year: number
  countries: string[]
  /**
   * Filtro explícito de compañías (como en Real Import).
   * - `null`: no filtrar por compañía (todas)
   * - `string[]`: filtrar exactamente por esas compañías
   * - `undefined`: usar el mapeo legacy `countries -> compañías`
   */
  salesCompanies?: string[] | null
  categories: string[]
  /** Array vacío = todos. */
  products: string[]
  channels: string[]
  canEdit: boolean
  /** Rango de meses (1-12) para cálculos y totales. */
  monthFrom: number
  monthTo: number
  /** Modo test: permite simular unidades manualmente */
  testMode?: boolean
  /** Identificador del budget seleccionado (solo aplica en modelo budget). */
  budgetName?: string
  /** Si está activo, cada mes puede mostrar un modelo distinto. */
  combineEnabled?: boolean
  /** Modelo por mes (0..11). Solo se usa si combineEnabled. */
  monthModels?: ("real_2026" | "real_2025" | `budget:${string}`)[]
  onMonthModelChange?: (monthIdx0Based: number, model: "real_2026" | "real_2025" | `budget:${string}`) => void
}

interface OverrideData {
  grossSalesUSD: number
  commercialDiscountUSD: number
  productCostUSD: number
  kitCostUSD: number
  paymentFeeUSD: number
  bloodDrawSampleUSD: number
  sanitaryPermitsUSD: number
  externalCourierUSD: number
  internalCourierUSD: number
  physiciansFeesUSD: number
  salesCommissionUSD: number
}

interface SGAData {
  salaries_wages: number
  professional_fees: number
  contracted_services: number
  travel_lodging_meals: number
  rent_expenses: number
  advertising_promotion: number
  financial_expenses: number
  other_expenses: number
}

interface TaxData {
  iibb_pct: number
  income_tax_pct: number
}

// Maps country_code → company names in ventas_mensuales_view
const COUNTRY_TO_COMPANIES: Record<string, string[]> = {
  AR: ["SouthGenetics LLC Argentina", "SouthGenetics LLC Arge"],
  CL: ["Southgenetics LLC Chile"],
  CO: ["SouthGenetics LLC Colombia"],
  MX: ["SouthGenetics LLC México"],
  UY: ["SouthGenetics LLC", "SouthGenetics LLC Uruguay"],
  VE: ["SouthGenetics LLC Venezuela"],
  // \"Todos los países\": unión de todas las compañías conocidas
  all: [
    "SouthGenetics LLC Argentina",
    "SouthGenetics LLC Arge",
    "Southgenetics LLC Chile",
    "SouthGenetics LLC Colombia",
    "SouthGenetics LLC México",
    "SouthGenetics LLC",
    "SouthGenetics LLC Uruguay",
    "SouthGenetics LLC Venezuela",
  ],
}

const MONTH_KEYS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"] as const
const MONTH_LABELS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
const SHORT_LABELS = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"]
const KNOWN_PL_CATEGORIES = ["Anualidades", "Endocrinología", "Ginecología", "Oncología", "Otros", "Prenatales", "Urología"] as const

const SGA_FIELDS: { key: keyof SGAData; label: string }[] = [
  { key: "salaries_wages", label: "Salaries & Wages" },
  { key: "professional_fees", label: "Professional fees" },
  { key: "contracted_services", label: "Contracted services" },
  { key: "travel_lodging_meals", label: "Travel, Lodging & Meals" },
  { key: "rent_expenses", label: "Rent and Expenses" },
  { key: "advertising_promotion", label: "Advertising & Promotion" },
  { key: "financial_expenses", label: "Financial expenses" },
  { key: "other_expenses", label: "Other expenses" },
]

const emptyOverride = (): OverrideData => ({
  grossSalesUSD: 0,
  commercialDiscountUSD: 0,
  productCostUSD: 0,
  kitCostUSD: 0,
  paymentFeeUSD: 0,
  bloodDrawSampleUSD: 0,
  sanitaryPermitsUSD: 0,
  externalCourierUSD: 0,
  internalCourierUSD: 0,
  physiciansFeesUSD: 0,
  salesCommissionUSD: 0,
})
const emptySGA = (): SGAData => ({
  salaries_wages: 0,
  professional_fees: 0,
  contracted_services: 0,
  travel_lodging_meals: 0,
  rent_expenses: 0,
  advertising_promotion: 0,
  financial_expenses: 0,
  other_expenses: 0,
})
const emptyTax = (): TaxData => ({ iibb_pct: 0, income_tax_pct: 0 })

// ─── Formatting ───────────────────────────────────────────────────────────────

function fmt(val: number): string {
  if (val === 0) return "-"
  return formatNumber(val, "es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

// Shows value as negative (for costs / expenses)
function fmtNeg(val: number): string {
  if (val === 0) return "-"
  return `(${Math.abs(val).toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })})`
}

function fmtSigned(val: number): string {
  if (val === 0) return "-"
  return val < 0 ? fmtNeg(val) : fmt(val)
}

// SG&A se guarda como "costo" (positivo) y "crédito" (negativo).
// Para mostrarlo en el P&L, invertimos el signo: costo -> negativo (paréntesis), crédito -> positivo.
function sgaDisplay(val: number): number {
  return -val
}

function fmtSga(val: number): string {
  return fmtSigned(sgaDisplay(val))
}

function normalizeProductKey(name: string): string {
  return (name || "")
    .toLowerCase()
    .replace(/\[.*?\]/g, "")
    .replace(/[^a-z0-9]/g, "")
}

// Normalización más tolerante para emparejar variantes típicas en budget/odoo,
// ej: "v2.0" vs "2.0" (MyProstateScore v2.0 vs MyProstateScore2.0).
function normalizeProductKeyLoose(name: string): string {
  return normalizeProductKey(name).replace(/v(?=\d)/g, "")
}

// Normalización "de matching" para Budget/Forecast:
// - Reduce diferencias frecuentes entre fuentes (inglés/español, acentos, corchetes, etc.)
// - No intenta ser fuzzy (sin levenshtein), pero cubre variantes comunes.
function normalizeBudgetMatchKey(name: string): string {
  const raw = String(name || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\[.*?\]/g, " ")

  // Equivalencias comunes que rompen matching exacto entre fuentes
  const canon = raw.replace(/\b(professional|profesional)\b/g, "prof")

  return canon.replace(/[^a-z0-9]/g, "")
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PLTable({
  modelo,
  year,
  countries,
  salesCompanies,
  categories,
  products,
  channels,
  canEdit,
  monthFrom,
  monthTo,
  testMode,
  budgetName = "budget",
  combineEnabled = false,
  monthModels,
  onMonthModelChange,
}: PLTableProps) {
  const [loading, setLoading] = useState(true)
  const [quantities, setQuantities] = useState<Record<string, number[]>>({})
  // Real-only: monto_total (Odoo) agregado por producto y mes (incluye devoluciones si vienen negativas)
  const [odooAmounts, setOdooAmounts] = useState<Record<string, number[]>>({})
  const [productCategories, setProductCategories] = useState<Record<string, string>>({})
  const [productAliases, setProductAliases] = useState<Record<string, string>>({})
  const [overrides, setOverrides] = useState<Record<string, OverrideData>>({})
  // Budget-mode raw rows (product_id, product_name, channel, months) to compute precio * unidades por canal
  const [budgetRows, setBudgetRows] = useState<Record<string, unknown>[]>([])
  // Budget-mode overrides por producto(+canal). Claves típicas: `${product_id}|${channel}` o `${product_id}|`.
  const [budgetOverrides, setBudgetOverrides] = useState<Record<string, OverrideData>>({})
  // SGA per month (summed if viewing "all", specific if product+channel selected)
  const [sga, setSga] = useState<SGAData[]>(Array.from({ length: 12 }, emptySGA))
  // Raw SG&A rows from `pl_sga` used to build tooltips (breakdown by product+channel)
  const [sgaRowsRaw, setSgaRowsRaw] = useState<any[]>([])
  // Tax rates: country-level, stored with product_name='' and channel=''
  const [taxRates, setTaxRates] = useState<TaxData[]>(Array.from({ length: 12 }, emptyTax))
  // Editing state
  const [editingCell, setEditingCell] = useState<{ field: keyof SGAData | keyof TaxData; month: number } | null>(null)
  const [editValue, setEditValue] = useState<string>("")
  const [editingBudgetUnit, setEditingBudgetUnit] = useState<{ productName: string; monthIdx: number } | null>(null)
  const [budgetUnitEditValue, setBudgetUnitEditValue] = useState<string>("")
  // Detail panel
  const [showDetail, setShowDetail] = useState(false)
  const [detailMonth, setDetailMonth] = useState<number | null>(null)
  // Test mode: unidades simuladas por producto y mes
  const [testQuantities, setTestQuantities] = useState<Record<string, number[]> | null>(null)

  const product = products.length === 1 ? products[0] : "all"
  const { openCreateProductDialog } = useProductCreateDialog()
  const categoriesSet = new Set(categories)
  const allKnownCategoriesSelected = KNOWN_PL_CATEGORIES.every((c) => categoriesSet.has(c))
  const shouldFilterCategories = categories.length > 0 && !allKnownCategoriesSelected

  const resolveSalesCompanies = useCallback((): string[] | null => {
    if (salesCompanies !== undefined) return salesCompanies
    // Legacy: derivar compañías desde países.
    const companies = countries.flatMap((c) => COUNTRY_TO_COMPANIES[c] || [])
    return companies.length ? companies : null
  }, [salesCompanies, countries])

  // Dropdowns independientes por fila de totales.
  // Al expandir una fila, se muestra el desglose correspondiente (y dependencias),
  // pero al expandir otra no se cierra esta.
  const [expandedSalesRevenue, setExpandedSalesRevenue] = useState(false)
  const [expandedGrossProfit, setExpandedGrossProfit] = useState(false)
  const [expandedSGA, setExpandedSGA] = useState(false)
  const [expandedNetIncome, setExpandedNetIncome] = useState(false)

  // SG&A / impuestos se pueden usar tanto en Budget como en Real,
  // pero siempre filtrando por la columna `modelo` en `pl_sga`.
  const financialEnabled = true
  // Can edit SGA amounts only when both product AND channel are specific (exactly one product)
  // En multi-selección: podemos editar solo cuando se seleccionó un único canal.
  const canEditSGA =
    canEdit && financialEnabled && products.length === 1 && channels.length === 1 && countries.length === 1
  // Taxes are stored at country-level (one country_code row), so allow editing only when a single country is selected.
  const canEditTax = canEdit && financialEnabled && countries.length === 1

  const canEditBudgetUnits =
    canEdit &&
    modelo === "budget" &&
    !combineEnabled &&
    !testMode &&
    countries.length === 1 &&
    channels.length === 1

  const startIndex = Math.min(Math.max(Math.min(monthFrom, monthTo) - 1, 0), 11)
  const endIndex = Math.min(Math.max(Math.max(monthFrom, monthTo) - 1, 0), 11)
  const monthIndices = Array.from({ length: endIndex - startIndex + 1 }, (_, k) => startIndex + k)

  type MonthModel = "real_2026" | "real_2025" | `budget:${string}`
  const baseMonthModel: MonthModel =
    modelo === "budget" ? `budget:${budgetName}` : (year === 2025 ? "real_2025" : "real_2026")
  const effectiveMonthModels: MonthModel[] =
    (monthModels && monthModels.length === 12 ? monthModels : Array(12).fill(baseMonthModel)) as MonthModel[]

  type ModelSnapshot = {
    model: MonthModel
    // Budget data
    budgetRows?: Record<string, unknown>[]
    budgetOverrides?: Record<string, OverrideData>
    // Real data
    quantities?: Record<string, number[]>
    odooAmounts?: Record<string, number[]>
    overrides?: Record<string, OverrideData>
    // Shared
    sga: SGAData[]
    tax: TaxData[]
  }

  const [combinedSnapshots, setCombinedSnapshots] = useState<Partial<Record<MonthModel, ModelSnapshot>>>({})
  const [combineError, setCombineError] = useState<string | null>(null)
  const neededMonthModels = Array.from(new Set(effectiveMonthModels))
  const combineReady = !combineEnabled || neededMonthModels.every((m) => Boolean(combinedSnapshots[m]))

  const isForecastQ1 =
    modelo === "budget" &&
    String(budgetName || "").trim().toLowerCase() === "forecast q1" &&
    year === 2026

  // Modo híbrido (sin UI de Combinar): Q1 = Real 2026, resto = Budget forecast Q1.
  // Importante: solo aplica cuando el filtro de países esté acotado a AR/CL (los únicos países cargados en ese budget),
  // para no "inventar" datos Real en países que no tienen proyección en forecast Q1.
  const hybridCountriesOk =
    countries.length > 0 && countries.every((c) => ["AR", "CL"].includes(String(c || "").toUpperCase()))
  const hybridForecastQ1Enabled = isForecastQ1 && hybridCountriesOk && !combineEnabled && !testMode
  const [hybridRealSnapshot, setHybridRealSnapshot] = useState<ModelSnapshot | null>(null)

  // Mapeo (normalizado) de texto de ventas/budget -> nombre canónico del catálogo.
  // Evita duplicados en detalle cuando Odoo/budget usan alias/apodos o variantes.
  const catalogKeyToName = useMemo(() => {
    const m = new Map<string, string>()
    for (const name of Object.keys(productCategories)) {
      const nk = normalizeProductKey(name)
      if (nk) m.set(nk, name)
      const alias = productAliases[name]
      const ak = normalizeProductKey(alias || "")
      if (ak) m.set(ak, name)
    }
    return m
  }, [productCategories, productAliases])

  const resolveToCatalogName = useCallback((raw: string) => {
    const trimmed = String(raw || "").trim()
    if (!trimmed) return ""
    return catalogKeyToName.get(normalizeProductKey(trimmed)) || trimmed
  }, [catalogKeyToName])

  const calcMonthModelAt = (monthIdx0: number): MonthModel => {
    if (combineEnabled) return effectiveMonthModels[monthIdx0]
    if (hybridForecastQ1Enabled) return monthIdx0 <= 2 ? "real_2026" : (`budget:${budgetName}` as MonthModel)
    return baseMonthModel
  }

  const computeNetIncomeChain = (
    grossSales: number[],
    commercialDiscount: number[],
    productCost: number[],
    kitCost: number[],
    paymentFee: number[],
    bloodDraw: number[],
    sanitary: number[],
    extCourier: number[],
    intCourier: number[],
    physiciansFees: number[],
    salesCommission: number[],
    sgaMonth: SGAData[],
    taxRates: TaxData[]
  ) => {
    const salesRevenue = grossSales.map((v, i) => v - commercialDiscount[i])
    const totalCOS = Array.from({ length: 12 }, (_, i) =>
      productCost[i] + kitCost[i] + paymentFee[i] + bloodDraw[i] + sanitary[i] +
      extCourier[i] + intCourier[i] + physiciansFees[i] + salesCommission[i]
    )
    const grossProfit = salesRevenue.map((v, i) => v - totalCOS[i])
    const totalSGA = Array.from({ length: 12 }, (_, i) =>
      SGA_FIELDS.reduce((s, f) => s + sgaMonth[i][f.key], 0)
    )
    const iibbAmount = salesRevenue.map((v, i) => v * (taxRates[i].iibb_pct / 100))
    const incomeTaxBase = grossProfit.map((v, i) => v - totalSGA[i])
    const incomeTax = incomeTaxBase.map((v, i) => Math.max(0, v) * (taxRates[i].income_tax_pct / 100))
    const netIncome = grossProfit.map((v, i) => v - totalSGA[i] - iibbAmount[i] - incomeTax[i])
    return { salesRevenue, grossProfit, netIncome, totalSGA, iibbAmount, incomeTax }
  }

  const fetchTaxesFor = async (modelTag: "real" | "budget", forYear: number): Promise<TaxData[]> => {
    const taxArr: TaxData[] = Array.from({ length: 12 }, emptyTax)
    let taxQuery = supabase
      .from("pl_sga")
      .select("month, iibb_pct, income_tax_pct")
      .eq("year", forYear)
      .eq("modelo", modelTag)
      .eq("product_name", "")
      .eq("channel", "")
    if (countries.length) taxQuery = taxQuery.in("country_code", countries)
    const { data, error } = await taxQuery
    if (error) throw error
    for (const row of data || []) {
      const idx = (row as any).month - 1
      if (idx >= 0 && idx < 12) {
        taxArr[idx] = {
          iibb_pct: Math.abs(Number((row as any).iibb_pct || 0)),
          income_tax_pct: Math.abs(Number((row as any).income_tax_pct || 0)),
        }
      }
    }
    return taxArr
  }

  const fetchSGAFor = async (modelTag: "real" | "budget", forYear: number): Promise<SGAData[]> => {
    const sgaArr: SGAData[] = Array.from({ length: 12 }, emptySGA)
    let sgaQuery = supabase
      .from("pl_sga")
      .select(
        "month, salaries_wages, professional_fees, contracted_services, travel_lodging_meals, rent_expenses, advertising_promotion, financial_expenses, other_expenses, product_name, channel, country_code"
      )
      .eq("year", forYear)
      .eq("modelo", modelTag)
    if (countries.length) sgaQuery = sgaQuery.in("country_code", countries)
    if (channels.length) sgaQuery = sgaQuery.in("channel", channels)

    if (products.length === 1 && channels.length === 1) {
      sgaQuery = sgaQuery.eq("product_name", product).eq("channel", channels[0])
    } else {
      sgaQuery = sgaQuery.neq("product_name", "").neq("channel", "")
    }

    const { data, error } = await sgaQuery
    if (error) throw error

    let allowedProductsByCategory: Set<string> | null = null
    if (shouldFilterCategories) {
      const { data: allProds } = await supabase.from("products").select("name, category")
      allowedProductsByCategory = new Set(
        (allProds || [])
          .filter((p: { name: string; category: string | null }) => categoriesSet.has(p.category || ""))
          .map((p: { name: string }) => p.name)
      )
    }

    const selectedProducts = products.length > 0 ? new Set(products) : null
    for (const row of data || []) {
      const rowProduct = String((row as any).product_name || "")
      if (!rowProduct) continue
      if (selectedProducts && !selectedProducts.has(rowProduct)) continue
      if (allowedProductsByCategory && !allowedProductsByCategory.has(rowProduct)) continue
      const idx = Number((row as any).month) - 1
      if (idx < 0 || idx >= 12) continue
      for (const f of SGA_FIELDS) {
        // SG&A puede tener créditos (negativos). No normalizamos el signo.
        sgaArr[idx][f.key] += Number((row as any)[f.key] || 0)
      }
    }

    return sgaArr
  }

  const computeMonthlyRealField = (
    quantities: Record<string, number[]>,
    overrides: Record<string, OverrideData>,
    field: keyof OverrideData
  ): number[] => {
    return Array.from({ length: 12 }, (_, mIdx) =>
      Object.entries(quantities).reduce((sum, [name, qtArr]) => {
        const ov = overrides[name] || emptyOverride()
        return sum + ov[field] * (qtArr[mIdx] || 0)
      }, 0)
    )
  }

  const computeMonthlyRealGrossSalesFromOdoo = (amounts: Record<string, number[]>): number[] => {
    return Array.from({ length: 12 }, (_, i) =>
      Object.values(amounts).reduce((s, arr) => s + (arr[i] || 0), 0)
    )
  }

  const computeMonthlyBudgetField = (
    rows: Record<string, unknown>[],
    ovs: Record<string, OverrideData>,
    field: keyof OverrideData
  ): number[] => {
    return Array.from({ length: 12 }, (_, mIdx) =>
      (rows || []).reduce((sum, row) => {
        const prodId = ((row as any).product_id as string | null) || ""
        const name = (row as any).product_name as string
        const rowChannel = ((row as any).channel as string) || ""
        const nameNorm = normalizeProductKeyLoose(name)
        const nameMatch = normalizeBudgetMatchKey(name)

        const idChannelKey = prodId ? `${prodId}|${rowChannel}` : ""
        const idPacienteKey = prodId ? `${prodId}|Paciente` : ""
        const idBaseKey = prodId ? `${prodId}|` : ""
        const nameChannelKey = `${name}|${rowChannel}`
        const namePacienteKey = `${name}|Paciente`
        const nameBaseKey = `${name}|`
        const normChannelKey = nameNorm ? `${nameNorm}|${rowChannel}` : ""
        const normPacienteKey = nameNorm ? `${nameNorm}|Paciente` : ""
        const normBaseKey = nameNorm ? `${nameNorm}|` : ""
        const matchChannelKey = nameMatch ? `${nameMatch}|${rowChannel}` : ""
        const matchPacienteKey = nameMatch ? `${nameMatch}|Paciente` : ""
        const matchBaseKey = nameMatch ? `${nameMatch}|` : ""

        const ov =
          (idChannelKey && ovs[idChannelKey]) ||
          (idPacienteKey && ovs[idPacienteKey]) ||
          (idBaseKey && ovs[idBaseKey]) ||
          ovs[nameChannelKey] ||
          ovs[namePacienteKey] ||
          ovs[nameBaseKey] ||
          (normChannelKey && ovs[normChannelKey]) ||
          (normPacienteKey && ovs[normPacienteKey]) ||
          (normBaseKey && ovs[normBaseKey]) ||
          (matchChannelKey && ovs[matchChannelKey]) ||
          (matchPacienteKey && ovs[matchPacienteKey]) ||
          (matchBaseKey && ovs[matchBaseKey]) ||
          emptyOverride()

        const units = Number((row as any)[MONTH_KEYS[mIdx] as any] || 0)
        return sum + ov[field] * units
      }, 0)
    )
  }

  const totalUnitsFromBudgetRows = (rows: Record<string, unknown>[]) =>
    Array.from({ length: 12 }, (_, i) =>
      (rows || []).reduce((s, row) => s + Number((row as any)[MONTH_KEYS[i] as any] || 0), 0)
    )

  const totalUnitsFromRealQty = (qty: Record<string, number[]>) =>
    Array.from({ length: 12 }, (_, i) => Object.values(qty).reduce((s, arr) => s + (arr[i] || 0), 0))

  // Inicializar cantidades de test cuando se activa el modo o cambian cantidades base
  useEffect(() => {
    if (!testMode) {
      setTestQuantities(null)
      return
    }
    setTestQuantities((prev) => {
      const next: Record<string, number[]> = {}
      // Copiar cantidades base y preservar ediciones previas cuando existan
      for (const [name, arr] of Object.entries(quantities)) {
        next[name] = prev?.[name] ? [...prev[name]] : [...arr]
      }
      // Mantener productos agregados manualmente que no están en quantities
      if (prev) {
        for (const [name, arr] of Object.entries(prev)) {
          if (!next[name]) next[name] = [...arr]
        }
      }
      return next
    })
  }, [testMode, quantities])

  const activeQuantities: Record<string, number[]> = (testMode && testQuantities) ? testQuantities : quantities

  // ── Data fetching ─────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true)
    setCombineError(null)
    // En Real queremos "limpiar" únicamente SG&A/Impuestos (no el resto).
    // Los costos de producto (Gross Sales / Gross Profit) se calculan desde overrides + cantidades,
    // por eso NO debemos tocarlos.
    setSga(Array.from({ length: 12 }, emptySGA))
    setTaxRates(Array.from({ length: 12 }, emptyTax))
    setSgaRowsRaw([])
    try {
      if (countries.length === 0) {
        setQuantities({})
        setOdooAmounts({})
        setBudgetRows([])
        setOverrides({})
        setBudgetOverrides({})
        setCombinedSnapshots({})
        setCombineError(null)
        setHybridRealSnapshot(null)
        setSgaRowsRaw([])
        return
      }

      // Modo combinar: pre-cargar todos los modelos necesarios y dejar que cada mes elija.
      if (combineEnabled) {
        const neededModels = new Set<MonthModel>(effectiveMonthModels)
        const snapshots: Partial<Record<MonthModel, ModelSnapshot>> = {}

        const fetchBudgetSnapshot = async (forBudgetName: string): Promise<ModelSnapshot> => {
          // Budget rows (unidades) filtradas
          let q = supabase
            .from("budget")
            .select("product_id, product_name, jan,feb,mar,apr,may,jun,jul,aug,sep,oct,nov,dec, channel, country_code")
            .eq("year", year)
            .eq("budget_name", forBudgetName)
          if (countries.length) q = q.in("country_code", countries)
          if (products.length > 0) q = q.in("product_name", products)
          if (channels.length) q = q.in("channel", channels)
          const { data: budData } = await q

          // Filtrado por categoría (solo si categoría filtra)
          const rowsForBudget: Record<string, unknown>[] = []
          if (shouldFilterCategories) {
            const { data: allProds } = await supabase.from("products").select("name, category")
            const allowed = new Set(
              (allProds || [])
                .filter((p: { name: string; category: string | null }) => categoriesSet.has(p.category || ""))
                .map((p: { name: string }) => p.name)
            )
            for (const row of budData || []) {
              const name = (row as any).product_name as string
              if (!allowed.has(name)) continue
              rowsForBudget.push(row as any)
            }
          } else {
            for (const row of budData || []) rowsForBudget.push(row as any)
          }

          // Budget overrides (por product_id|channel)
          const ovs: Record<string, OverrideData> = {}
          let qo = supabase.from("product_country_overrides").select("overrides, product_id, country_code, channel")
          if (countries.length) qo = qo.in("country_code", countries)
          const { data: overrideRows } = await qo
          if (overrideRows && overrideRows.length > 0) {
            const productIds = (overrideRows as any[]).map((r) => r.product_id).filter(Boolean)
            const { data: productRows } = await supabase
              .from("products")
              .select("id, name, category")
              .in("id", productIds)
            const idToName: Record<string, string> = {}
            const idToCat: Record<string, string> = {}
            for (const p of productRows || []) { idToName[p.id] = p.name; idToCat[p.id] = p.category || "" }

            for (const row of overrideRows as any[]) {
              const prodId = row.product_id as string
              const name = idToName[prodId]
              if (!name) continue
              if (shouldFilterCategories && idToCat[prodId] && !categoriesSet.has(idToCat[prodId])) continue
              if (products.length > 0 && !products.includes(name)) continue

              const o = row.overrides || {}
              const key = `${prodId}|${row.channel || ""}`
              const prev = ovs[key] || emptyOverride()
              ovs[key] = {
                grossSalesUSD: prev.grossSalesUSD + (o.grossSalesUSD || 0),
                commercialDiscountUSD: prev.commercialDiscountUSD + (o.commercialDiscountUSD || 0),
                productCostUSD: prev.productCostUSD + (o.productCostUSD || 0),
                kitCostUSD: prev.kitCostUSD + (o.kitCostUSD || 0),
                paymentFeeUSD: prev.paymentFeeUSD + (o.paymentFeeUSD || 0),
                bloodDrawSampleUSD: prev.bloodDrawSampleUSD + (o.bloodDrawSampleUSD || 0),
                sanitaryPermitsUSD: prev.sanitaryPermitsUSD + (o.sanitaryPermitsUSD || 0),
                externalCourierUSD: prev.externalCourierUSD + (o.externalCourierUSD || 0),
                internalCourierUSD: prev.internalCourierUSD + (o.internalCourierUSD || 0),
                physiciansFeesUSD: prev.physiciansFeesUSD + (o.physiciansFeesUSD || 0),
                salesCommissionUSD: prev.salesCommissionUSD + (o.salesCommissionUSD || 0),
              }
            }
          }

          const [tax, sga] = await Promise.all([fetchTaxesFor("budget", year), fetchSGAFor("budget", year)])
          return { model: `budget:${forBudgetName}`, budgetRows: rowsForBudget, budgetOverrides: ovs, tax, sga }
        }

        const fetchRealSnapshot = async (m: "real_2026" | "real_2025"): Promise<ModelSnapshot> => {
          const forYear = m === "real_2025" ? 2025 : 2026
          // Quantities
          const qtys: Record<string, number[]> = {}
          const amts: Record<string, number[]> = {}
          const cats: Record<string, string> = {}
          const aliases: Record<string, string> = {}
          const saleKeyToCatalogName = new Map<string, string>()
          const { data: allProds } = await supabase.from("products").select("name, category, alias")
          for (const p of allProds || []) {
            const name = String((p as any).name || "")
            const alias = String((p as any).alias || "")
            cats[name] = (p as any).category || ""
            aliases[name] = alias || ""
            const nameKey = normalizeProductKey(name)
            if (nameKey) saleKeyToCatalogName.set(nameKey, name)
            const aliasKey = normalizeProductKey(alias)
            if (aliasKey) saleKeyToCatalogName.set(aliasKey, name)
          }

          const companies = resolveSalesCompanies()
          let qSales = supabase
            .from("ventas_mensuales_view")
            .select("producto, mes, cantidad_ventas, monto_total, compañia")
            .eq("año", forYear)
          if (companies && companies.length) qSales = qSales.in("compañia", companies)

          {
            const { data } = await qSales

            const categorySet = shouldFilterCategories ? categoriesSet : null
            const selectedProductKeys = new Set((products || []).map((p) => normalizeProductKey(p)))
            for (const row of (data || []) as any[]) {
              const rawName = row.producto as string
              if (!rawName) continue
              const resolvedName = saleKeyToCatalogName.get(normalizeProductKey(rawName)) || rawName
              if (selectedProductKeys.size > 0 && !selectedProductKeys.has(normalizeProductKey(resolvedName))) continue
              if (categorySet) {
                const knownCategory = cats[resolvedName]
                if (knownCategory && !categorySet.has(knownCategory)) continue
              }
              if (!qtys[resolvedName]) qtys[resolvedName] = Array(12).fill(0)
              if (!amts[resolvedName]) amts[resolvedName] = Array(12).fill(0)
              const mIdx = Number(row.mes) - 1
              if (mIdx >= 0 && mIdx < 12) {
                qtys[resolvedName][mIdx] += Number(row.cantidad_ventas || 0)
                amts[resolvedName][mIdx] += Number(row.monto_total || 0)
              }
            }
            if (channels.length > 0 && !channels.includes("Paciente")) {
              for (const k of Object.keys(qtys)) qtys[k] = Array(12).fill(0)
              for (const k of Object.keys(amts)) amts[k] = Array(12).fill(0)
            }
          }

          // Overrides (Paciente)
          const ovs: Record<string, OverrideData> = {}
          let q = supabase.from("product_country_overrides").select("overrides, product_id, country_code").eq("channel", "Paciente")
          if (countries.length) q = q.in("country_code", countries)
          const { data: overrideRows } = await q
          if (overrideRows && overrideRows.length > 0) {
            const productIds = (overrideRows as any[]).map((r) => r.product_id).filter(Boolean)
            const { data: productRows } = await supabase.from("products").select("id, name, category").in("id", productIds)
            const idToName: Record<string, string> = {}
            const idToCat: Record<string, string> = {}
            for (const p of productRows || []) { idToName[p.id] = p.name; idToCat[p.id] = p.category || "" }

            for (const row of overrideRows as any[]) {
              const name = idToName[row.product_id]
              if (!name) continue
              if (shouldFilterCategories && idToCat[row.product_id] && !categoriesSet.has(idToCat[row.product_id])) continue
              if (products.length > 0 && !products.includes(name)) continue
              const o = row.overrides || {}
              const prev = ovs[name] || emptyOverride()
              ovs[name] = {
                grossSalesUSD: prev.grossSalesUSD + (o.grossSalesUSD || 0),
                commercialDiscountUSD: prev.commercialDiscountUSD + (o.commercialDiscountUSD || 0),
                productCostUSD: prev.productCostUSD + (o.productCostUSD || 0),
                kitCostUSD: prev.kitCostUSD + (o.kitCostUSD || 0),
                paymentFeeUSD: prev.paymentFeeUSD + (o.paymentFeeUSD || 0),
                bloodDrawSampleUSD: prev.bloodDrawSampleUSD + (o.bloodDrawSampleUSD || 0),
                sanitaryPermitsUSD: prev.sanitaryPermitsUSD + (o.sanitaryPermitsUSD || 0),
                externalCourierUSD: prev.externalCourierUSD + (o.externalCourierUSD || 0),
                internalCourierUSD: prev.internalCourierUSD + (o.internalCourierUSD || 0),
                physiciansFeesUSD: prev.physiciansFeesUSD + (o.physiciansFeesUSD || 0),
                salesCommissionUSD: prev.salesCommissionUSD + (o.salesCommissionUSD || 0),
              }
            }
          }

          const [tax, sga] = await Promise.all([fetchTaxesFor("real", forYear), fetchSGAFor("real", forYear)])
          // Reutilizamos categorías/alias del modelo base para UI (ya se cargan en el path normal).
          return { model: m, quantities: qtys, odooAmounts: amts, overrides: ovs, tax, sga }
        }

        // Fetch in parallel (tolerante a fallos: no colgar en "Cargando datos...")
        const taskList: { model: MonthModel; promise: Promise<ModelSnapshot> }[] = []
        for (const m of neededModels) {
          if (m === "real_2026") taskList.push({ model: m, promise: fetchRealSnapshot("real_2026") })
          else if (m === "real_2025") taskList.push({ model: m, promise: fetchRealSnapshot("real_2025") })
          else if (m.startsWith("budget:")) {
            const forName = m.slice("budget:".length)
            taskList.push({ model: m, promise: fetchBudgetSnapshot(forName) })
          }
        }

        const settled = await Promise.allSettled(taskList.map((t) => t.promise))
        const failures: string[] = []
        for (let idx = 0; idx < settled.length; idx++) {
          const res = settled[idx]
          const m = taskList[idx].model
          if (res.status === "fulfilled") {
            snapshots[m] = res.value
          } else {
            failures.push(m)
            console.error("PLTable combine fetch failed:", m, res.reason)
          }
        }

        setCombinedSnapshots(snapshots)
        const missing = Array.from(neededModels).filter((m) => !snapshots[m])
        if (missing.length > 0) setCombineError(`No se pudieron cargar: ${missing.join(", ")}`)
        if (failures.length > 0 && missing.length === 0) setCombineError(`Fallaron: ${failures.join(", ")}`)

        // Mantener la UI base cargada para el detalle (no se usa en combinar, pero evita flashes raros).
        if (modelo === "budget") {
          await Promise.all([fetchQuantities(), fetchBudgetOverrides(), fetchSGA()])
        } else {
          await Promise.all([fetchQuantities(), fetchOverrides(), fetchSGA()])
        }
        return
      }

      const fetchHybridRealSnapshot2026 = async (): Promise<ModelSnapshot> => {
        const forYear = 2026
        const qtys: Record<string, number[]> = {}
        const amts: Record<string, number[]> = {}
        const cats: Record<string, string> = {}
        const aliases: Record<string, string> = {}
        const saleKeyToCatalogName = new Map<string, string>()

        const { data: allProds } = await supabase.from("products").select("name, category, alias")
        for (const p of allProds || []) {
          const name = String((p as any).name || "")
          const alias = String((p as any).alias || "")
          cats[name] = (p as any).category || ""
          aliases[name] = alias || ""
          const nameKey = normalizeProductKey(name)
          if (nameKey) saleKeyToCatalogName.set(nameKey, name)
          const aliasKey = normalizeProductKey(alias)
          if (aliasKey) saleKeyToCatalogName.set(aliasKey, name)
        }

        const companies = resolveSalesCompanies()
        let qSales = supabase
          .from("ventas_mensuales_view")
          .select("producto, mes, cantidad_ventas, monto_total, compañia")
          .eq("año", forYear)
        if (companies && companies.length) qSales = qSales.in("compañia", companies)

        {
          const { data } = await qSales

          const categorySet = shouldFilterCategories ? categoriesSet : null
          const selectedProductKeys = new Set((products || []).map((p) => normalizeProductKey(p)))
          for (const row of (data || []) as any[]) {
            const rawName = row.producto as string
            if (!rawName) continue
            const resolvedName = saleKeyToCatalogName.get(normalizeProductKey(rawName)) || rawName
            if (selectedProductKeys.size > 0 && !selectedProductKeys.has(normalizeProductKey(resolvedName))) continue
            if (categorySet) {
              const knownCategory = cats[resolvedName]
              if (knownCategory && !categorySet.has(knownCategory)) continue
            }
            if (!qtys[resolvedName]) qtys[resolvedName] = Array(12).fill(0)
            if (!amts[resolvedName]) amts[resolvedName] = Array(12).fill(0)
            const mIdx = Number(row.mes) - 1
            if (mIdx >= 0 && mIdx < 12) {
              qtys[resolvedName][mIdx] += Number(row.cantidad_ventas || 0)
              amts[resolvedName][mIdx] += Number(row.monto_total || 0)
            }
          }
          if (channels.length > 0 && !channels.includes("Paciente")) {
            for (const k of Object.keys(qtys)) qtys[k] = Array(12).fill(0)
            for (const k of Object.keys(amts)) amts[k] = Array(12).fill(0)
          }
        }

        const ovs: Record<string, OverrideData> = {}
        let q = supabase
          .from("product_country_overrides")
          .select("overrides, product_id, country_code")
          .eq("channel", "Paciente")
        if (countries.length) q = q.in("country_code", countries)
        const { data: overrideRows } = await q
        if (overrideRows && overrideRows.length > 0) {
          const productIds = (overrideRows as any[]).map((r) => r.product_id).filter(Boolean)
          const { data: productRows } = await supabase.from("products").select("id, name, category").in("id", productIds)
          const idToName: Record<string, string> = {}
          const idToCat: Record<string, string> = {}
          for (const p of productRows || []) { idToName[p.id] = p.name; idToCat[p.id] = p.category || "" }

          for (const row of overrideRows as any[]) {
            const name = idToName[row.product_id]
            if (!name) continue
            if (shouldFilterCategories && idToCat[row.product_id] && !categoriesSet.has(idToCat[row.product_id])) continue
            if (products.length > 0 && !products.includes(name)) continue
            const o = row.overrides || {}
            const prev = ovs[name] || emptyOverride()
            ovs[name] = {
              grossSalesUSD: prev.grossSalesUSD + (o.grossSalesUSD || 0),
              commercialDiscountUSD: prev.commercialDiscountUSD + (o.commercialDiscountUSD || 0),
              productCostUSD: prev.productCostUSD + (o.productCostUSD || 0),
              kitCostUSD: prev.kitCostUSD + (o.kitCostUSD || 0),
              paymentFeeUSD: prev.paymentFeeUSD + (o.paymentFeeUSD || 0),
              bloodDrawSampleUSD: prev.bloodDrawSampleUSD + (o.bloodDrawSampleUSD || 0),
              sanitaryPermitsUSD: prev.sanitaryPermitsUSD + (o.sanitaryPermitsUSD || 0),
              externalCourierUSD: prev.externalCourierUSD + (o.externalCourierUSD || 0),
              internalCourierUSD: prev.internalCourierUSD + (o.internalCourierUSD || 0),
              physiciansFeesUSD: prev.physiciansFeesUSD + (o.physiciansFeesUSD || 0),
              salesCommissionUSD: prev.salesCommissionUSD + (o.salesCommissionUSD || 0),
            }
          }
        }

        const [tax, sga] = await Promise.all([fetchTaxesFor("real", forYear), fetchSGAFor("real", forYear)])
        return {
          model: "real_2026",
          quantities: qtys,
          odooAmounts: amts,
          overrides: ovs,
          tax,
          sga,
        }
      }

      if (modelo === "budget") {
        if (testMode) {
          // En modo Test usamos overrides agregados por producto, igual que en REAL
          await Promise.all([fetchQuantities(), fetchOverrides(), fetchSGA()])
        } else {
          await Promise.all([fetchQuantities(), fetchBudgetOverrides(), fetchSGA()])
        }
      } else {
        await Promise.all([fetchQuantities(), fetchOverrides(), fetchSGA()])
      }

      if (hybridForecastQ1Enabled) {
        try {
          const snap = await fetchHybridRealSnapshot2026()
          setHybridRealSnapshot(snap)
        } catch (e) {
          console.error("PLTable hybrid forecast Q1 real snapshot failed:", e)
          setHybridRealSnapshot(null)
        }
      } else {
        setHybridRealSnapshot(null)
      }
    } catch (e) {
      console.error("PLTable fetchData:", e)
      if (combineEnabled) setCombineError("Error cargando datos para combinar")
    } finally {
      setLoading(false)
    }
  }, [modelo, year, countries, categories, products, channels, testMode, budgetName, combineEnabled, effectiveMonthModels.join("|")])

  useEffect(() => { fetchData() }, [fetchData])

  const fetchQuantities = async () => {
    const qtys: Record<string, number[]> = {}
    const amts: Record<string, number[]> = {}
    const cats: Record<string, string> = {}
    const aliases: Record<string, string> = {}

    const { data: allProds } = await supabase.from("products").select("name, category, alias")
    // Resolver: texto de ventas (test/producto) -> nombre canónico en catálogo,
    // soportando que Odoo envíe "alias/apodo" en vez de `products.name`.
    const saleKeyToCatalogName = new Map<string, string>()
    for (const p of allProds || []) {
      const name = String((p as any).name || "")
      const alias = String((p as any).alias || "")
      cats[name] = (p as any).category || ""
      aliases[name] = alias || ""
      const nameKey = normalizeProductKey(name)
      if (nameKey) saleKeyToCatalogName.set(nameKey, name)
      const aliasKey = normalizeProductKey(alias)
      if (aliasKey) saleKeyToCatalogName.set(aliasKey, name)
    }

    if (modelo === "budget") {
      let q = supabase
        .from("budget")
        .select("id, product_id, product_name, jan,feb,mar,apr,may,jun,jul,aug,sep,oct,nov,dec, channel, country_code, budget_name, year")
        .eq("year", year)
        .eq("budget_name", budgetName)

      if (countries.length) q = q.in("country_code", countries)
      if (products.length > 0) {
        q = q.in("product_name", products)
      }
      // Si se selecciona un canal específico, las unidades deben provenir solo de ese canal.
      // Si el canal es "all", sumamos las unidades de todos los canales.
      if (channels.length) q = q.in("channel", channels)

      const { data } = await q
      if (!data) { setProductCategories(cats); setProductAliases(aliases); setBudgetRows([]); return }

      const categorySet = shouldFilterCategories ? categoriesSet : null
      const allowedProds = categorySet
        ? new Set(Object.entries(cats).filter(([, c]) => categorySet.has(c)).map(([n]) => n))
        : null

      const rowsForBudget: Record<string, unknown>[] = []

      for (const row of data as Record<string, unknown>[]) {
        const rawName = row.product_name as string
        const resolvedName = saleKeyToCatalogName.get(normalizeProductKey(rawName)) || rawName
        if (allowedProds && !allowedProds.has(resolvedName)) continue
        // Normalizar product_name al nombre canónico del catálogo para que:
        // - no aparezca el "+" si el budget usa alias
        // - los cálculos/joins basados en nombre sean consistentes
        rowsForBudget.push({ ...row, product_name: resolvedName })
        const arr = MONTH_KEYS.map((k) => Number(row[k] || 0))
        qtys[resolvedName] = qtys[resolvedName] ? qtys[resolvedName].map((v, i) => v + arr[i]) : arr
      }

      setBudgetRows(rowsForBudget)
    } else {
      // Modo REAL: no usamos budgetRows
      setBudgetRows([])
      const companies = resolveSalesCompanies()
      let qSales = supabase
        .from("ventas_mensuales_view")
        .select("producto, mes, cantidad_ventas, monto_total, compañia")
        .eq("año", year)
      if (companies && companies.length) qSales = qSales.in("compañia", companies)

      const { data } = await qSales

      if (!data) { setProductCategories(cats); setProductAliases(aliases); return }

      // IMPORTANTE (Real):
      // Si el producto no existe en `public.products` (no está en `cats`),
      // NO lo descartamos. Así mostramos las ventas aunque falte el match.
      const categorySet = shouldFilterCategories ? categoriesSet : null
      const selectedProductKeys = new Set((products || []).map((p) => normalizeProductKey(p)))

      for (const row of data as { producto: string; mes: number; cantidad_ventas: number | string | null; monto_total?: number | string | null; compañia: string | null }[]) {
        const rawName = row.producto
        if (!rawName) continue
        const resolvedName = saleKeyToCatalogName.get(normalizeProductKey(rawName)) || rawName
        if (selectedProductKeys.size > 0 && !selectedProductKeys.has(normalizeProductKey(resolvedName))) continue

        if (categorySet) {
          const knownCategory = cats[resolvedName]
          // Solo excluimos si es un producto CON categoría conocida y NO coincide.
          // Si `knownCategory` es undefined/"" (producto faltante), lo dejamos pasar.
          if (knownCategory && !categorySet.has(knownCategory)) continue
        }
        if (!qtys[resolvedName]) qtys[resolvedName] = Array(12).fill(0)
        if (!amts[resolvedName]) amts[resolvedName] = Array(12).fill(0)
        const mIdx = Number(row.mes) - 1
        if (mIdx >= 0 && mIdx < 12) {
          qtys[resolvedName][mIdx] += Number(row.cantidad_ventas || 0)
          amts[resolvedName][mIdx] += Number((row as any).monto_total || 0)
        }
      }

      // Ventas reales solo están cargadas en el canal Paciente; si el filtro no lo incluye,
      // no hay unidades reales para esos otros canales.
      if (channels.length > 0 && !channels.includes("Paciente")) {
        for (const k of Object.keys(qtys)) {
          qtys[k] = Array(12).fill(0)
        }
        for (const k of Object.keys(amts)) {
          amts[k] = Array(12).fill(0)
        }
      }
    }

    setQuantities(qtys)
    setOdooAmounts(amts)
    setProductCategories(cats)
    setProductAliases(aliases)
  }

  // Overrides específicos para modo Budget (por producto+canal) para poder hacer precio * unidades por canal
  const fetchBudgetOverrides = async () => {
    const ovs: Record<string, OverrideData> = {}

    let q = supabase
      .from("product_country_overrides")
      .select("overrides, product_id, country_code, channel")

    if (countries.length) q = q.in("country_code", countries)

    const { data: overrideRows } = await q
    if (!overrideRows || overrideRows.length === 0) {
      setBudgetOverrides({})
      return
    }

    const productIds = overrideRows.map((r: { product_id: string }) => r.product_id).filter(Boolean)
    if (!productIds.length) {
      setBudgetOverrides({})
      return
    }

    const { data: productRows } = await supabase
      .from("products")
      .select("id, name, category")
      .in("id", productIds)

    const idToName: Record<string, string> = {}
    const idToCat: Record<string, string> = {}
    for (const p of productRows || []) {
      idToName[p.id] = p.name
      idToCat[p.id] = p.category || ""
    }

    for (const row of overrideRows as { product_id: string; overrides: Record<string, number>; channel?: string }[]) {
      const prodId = row.product_id
      const name = idToName[prodId]
      if (!name) continue
      const categorySet = shouldFilterCategories ? categoriesSet : null
      if (categorySet && idToCat[prodId] && !categorySet.has(idToCat[prodId])) continue
      if (products.length > 0 && !products.includes(name)) continue

      const o = row.overrides || {}
      const ch = row.channel || ""
      const idKey = `${prodId}|${ch}`
      const nameKey = `${name}|${ch}`
      const normName = normalizeProductKeyLoose(name)
      const normKey = normName ? `${normName}|${ch}` : ""
      const matchName = normalizeBudgetMatchKey(name)
      const matchKey = matchName ? `${matchName}|${ch}` : ""

      const addToKey = (key: string) => {
        const prev = ovs[key] || emptyOverride()
        ovs[key] = {
          grossSalesUSD: prev.grossSalesUSD + (o.grossSalesUSD || 0),
          commercialDiscountUSD: prev.commercialDiscountUSD + (o.commercialDiscountUSD || 0),
          productCostUSD: prev.productCostUSD + (o.productCostUSD || 0),
          kitCostUSD: prev.kitCostUSD + (o.kitCostUSD || 0),
          paymentFeeUSD: prev.paymentFeeUSD + (o.paymentFeeUSD || 0),
          bloodDrawSampleUSD: prev.bloodDrawSampleUSD + (o.bloodDrawSampleUSD || 0),
          sanitaryPermitsUSD: prev.sanitaryPermitsUSD + (o.sanitaryPermitsUSD || 0),
          externalCourierUSD: prev.externalCourierUSD + (o.externalCourierUSD || 0),
          internalCourierUSD: prev.internalCourierUSD + (o.internalCourierUSD || 0),
          physiciansFeesUSD: prev.physiciansFeesUSD + (o.physiciansFeesUSD || 0),
          salesCommissionUSD: prev.salesCommissionUSD + (o.salesCommissionUSD || 0),
        }
      }

      // Soportar budget rows con product_id NULL:
      // - claves por id|canal (principal)
      // - claves por name|canal (fallback)
      // - claves por name normalizado|canal (fallback tolerante)
      // - claves por matchKey|canal (fallback para variantes frecuentes)
      // - y claves base sin canal (fallback)
      addToKey(idKey)
      addToKey(nameKey)
      if (normKey) addToKey(normKey)
      if (matchKey) addToKey(matchKey)
      addToKey(`${prodId}|`)
      addToKey(`${name}|`)
      if (normName) addToKey(`${normName}|`)
      if (matchName) addToKey(`${matchName}|`)
    }

    setBudgetOverrides(ovs)
  }

  const fetchOverrides = async () => {
    const ovs: Record<string, OverrideData> = {}

    let q = supabase
      .from("product_country_overrides")
      .select("overrides, product_id, country_code")
    if (countries.length) q = q.in("country_code", countries)
    // Real: precios/costos unitarios reales solo existen en overrides del canal Paciente.
    if (modelo === "real") {
      q = q.eq("channel", "Paciente")
    } else if (channels.length) {
      q = q.in("channel", channels)
    }

    const { data: overrideRows } = await q
    // Si no hay overrides para este filtro (por país/canal), limpiamos el estado
    // para que los canales sin configuración aparezcan con valores 0.
    if (!overrideRows || overrideRows.length === 0) {
      setOverrides({})
      return
    }

    const productIds = overrideRows.map((r: { product_id: string }) => r.product_id).filter(Boolean)
    if (!productIds.length) {
      setOverrides({})
      return
    }

    const { data: productRows } = await supabase
      .from("products")
      .select("id, name, category")
      .in("id", productIds)

    const idToName: Record<string, string> = {}
    const idToCat: Record<string, string> = {}
    for (const p of productRows || []) { idToName[p.id] = p.name; idToCat[p.id] = p.category || "" }

    for (const row of overrideRows as { product_id: string; overrides: Record<string, number> }[]) {
      const name = idToName[row.product_id]
      if (!name) continue
      const categorySet = shouldFilterCategories ? categoriesSet : null
      if (categorySet && idToCat[row.product_id] && !categorySet.has(idToCat[row.product_id])) continue
      if (products.length > 0 && !products.includes(name)) continue

      const o = row.overrides || {}

      // Cuando el filtro de canal es \"Todos los canales\" (o país = \"all\"),
      // es posible que existan múltiples overrides para el mismo producto.
      // En ese caso, acumulamos (sumamos) los costos por unidad de todos los canales/países.
      const prev = ovs[name] || emptyOverride()

      ovs[name] = {
        grossSalesUSD: prev.grossSalesUSD + (o.grossSalesUSD || 0),
        commercialDiscountUSD: prev.commercialDiscountUSD + (o.commercialDiscountUSD || 0),
        productCostUSD: prev.productCostUSD + (o.productCostUSD || 0),
        kitCostUSD: prev.kitCostUSD + (o.kitCostUSD || 0),
        paymentFeeUSD: prev.paymentFeeUSD + (o.paymentFeeUSD || 0),
        bloodDrawSampleUSD: prev.bloodDrawSampleUSD + (o.bloodDrawSampleUSD || 0),
        sanitaryPermitsUSD: prev.sanitaryPermitsUSD + (o.sanitaryPermitsUSD || 0),
        externalCourierUSD: prev.externalCourierUSD + (o.externalCourierUSD || 0),
        internalCourierUSD: prev.internalCourierUSD + (o.internalCourierUSD || 0),
        physiciansFeesUSD: prev.physiciansFeesUSD + (o.physiciansFeesUSD || 0),
        salesCommissionUSD: prev.salesCommissionUSD + (o.salesCommissionUSD || 0),
      }
    }
    setOverrides(ovs)
  }

  const fetchTaxes = async () => {
    const taxArr: TaxData[] = Array.from({ length: 12 }, emptyTax)

    // Fetch tax rates (country-level: product_name='' AND channel='')
    let taxQuery = supabase
      .from("pl_sga")
      .select("month, iibb_pct, income_tax_pct")
      .eq("year", year)
      .eq("modelo", modelo)
      .eq("product_name", "")
      .eq("channel", "")

    if (countries.length) {
      taxQuery = taxQuery.in("country_code", countries)
    }

    const { data: taxData } = await taxQuery

    for (const row of taxData || []) {
      const idx = row.month - 1
      if (idx >= 0 && idx < 12) {
        // Normalizamos tasas como positivas para evitar que un valor negativo "sume" en los cálculos
        taxArr[idx] = {
          iibb_pct: Math.abs(Number(row.iibb_pct || 0)),
          income_tax_pct: Math.abs(Number(row.income_tax_pct || 0)),
        }
      }
    }

    setTaxRates(taxArr)
  }

  const fetchSGA = async () => {
    const sgaArr: SGAData[] = Array.from({ length: 12 }, emptySGA)
    await fetchTaxes()

    // Fetch SGA amounts
    let sgaQuery = supabase
      .from("pl_sga")
      .select("month, salaries_wages, professional_fees, contracted_services, travel_lodging_meals, rent_expenses, advertising_promotion, financial_expenses, other_expenses, product_name, channel, country_code")
      .eq("year", year)
      .eq("modelo", modelo)
    if (countries.length) sgaQuery = sgaQuery.in("country_code", countries)
    if (channels.length) sgaQuery = sgaQuery.in("channel", channels)

    if (products.length === 1 && channels.length === 1) {
      // Specific product+channel → load that specific row
      sgaQuery = sgaQuery.eq("product_name", product).eq("channel", channels[0])
    } else {
      // Aggregate all product/channel rows (exclude the tax-only country-level row)
      sgaQuery = sgaQuery.neq("product_name", "").neq("channel", "")
    }

    const { data: sgaData } = await sgaQuery

    // SG&A depende de producto; si filtramos por categoría, traducimos categoría -> nombres de producto permitidos.
    let allowedProductsByCategory: Set<string> | null = null
    if (shouldFilterCategories) {
      const { data: allProds } = await supabase.from("products").select("name, category")
      const categorySet = categoriesSet
      allowedProductsByCategory = new Set(
        (allProds || [])
          .filter((p: { name: string; category: string | null }) => categorySet.has(p.category || ""))
          .map((p: { name: string; category: string | null }) => p.name)
      )
    }

    const selectedProducts = products.length > 0 ? new Set(products) : null
    const usedRows: any[] = []
    for (const row of sgaData || []) {
      const rowProduct = String(row.product_name || "")
      if (!rowProduct) continue
      if (selectedProducts && !selectedProducts.has(rowProduct)) continue
      if (allowedProductsByCategory && !allowedProductsByCategory.has(rowProduct)) continue

      const idx = row.month - 1
      if (idx < 0 || idx >= 12) continue
      usedRows.push(row)
      for (const f of SGA_FIELDS) {
        // SG&A puede tener créditos (negativos). No normalizamos el signo.
        sgaArr[idx][f.key] += Number(row[f.key] || 0)
      }
    }
    setSga(sgaArr)
    setSgaRowsRaw(usedRows)
  }

  // ── P&L calculations ──────────────────────────────────────────────────────

  const computeMonthly = (field: keyof OverrideData): number[] => {
    if (modelo === "budget" && !testMode) {
      // Budget: sumar por fila de budget (producto+canal) usando su override específico.
      // Prioridad de búsqueda:
      // 1) override por product_id + canal exacto
      // 2) override por product_id + canal 'Paciente' (canal por defecto)
      // 3) override por product_id sin canal
      // 4) override por nombre + canal (compatibilidad)
      return Array.from({ length: 12 }, (_, mIdx) =>
        (budgetRows || []).reduce((sum, row) => {
          const prodId = (row.product_id as string | null) || ""
          const name = row.product_name as string
          const rowChannel = (row.channel as string) || ""

          const idChannelKey = prodId ? `${prodId}|${rowChannel}` : ""
          const idPacienteKey = prodId ? `${prodId}|Paciente` : ""
          const idBaseKey = prodId ? `${prodId}|` : ""
          const nameChannelKey = `${name}|${rowChannel}`
          const namePacienteKey = `${name}|Paciente`
          const nameBaseKey = `${name}|`

          const ov =
            (idChannelKey && budgetOverrides[idChannelKey]) ||
            (idPacienteKey && budgetOverrides[idPacienteKey]) ||
            (idBaseKey && budgetOverrides[idBaseKey]) ||
            budgetOverrides[nameChannelKey] ||
            budgetOverrides[namePacienteKey] ||
            budgetOverrides[nameBaseKey] ||
            emptyOverride()

          const units = Number(row[MONTH_KEYS[mIdx] as string] || 0)
          return sum + ov[field] * units
        }, 0)
      )
    }

    // Real (y Budget en modo Test): usar cantidades agregadas por producto y overrides por producto
    return Array.from({ length: 12 }, (_, mIdx) =>
      Object.entries(activeQuantities).reduce((sum, [name, qtArr]) => {
        const ov = overrides[name] || emptyOverride()
        const units = qtArr[mIdx] || 0
        return sum + ov[field] * units
      }, 0)
    )
  }

  const totalUnits = Array.from({ length: 12 }, (_, i) => {
    // En modo Test, siempre usamos las cantidades activas simuladas
    if (testMode) {
      return Object.values(activeQuantities).reduce((s, arr) => s + (arr[i] || 0), 0)
    }

    if (combineEnabled) {
      const m = calcMonthModelAt(i)
      const snap = combinedSnapshots[m]
      if (!snap) return 0
      if (m.startsWith("budget:")) {
        return (snap.budgetRows || []).reduce((s, row) => s + Number((row as any)[MONTH_KEYS[i] as any] || 0), 0)
      }
      return Object.values(snap.quantities || {}).reduce((s, arr) => s + (arr[i] || 0), 0)
    }

    // Modo híbrido: solo Q1 toma Real; el resto usa el budget normal ya cargado.
    if (hybridForecastQ1Enabled) {
      const m = calcMonthModelAt(i)
      if (m === "real_2026") {
        const snap = hybridRealSnapshot
        if (!snap) return 0
        return Object.values(snap.quantities || {}).reduce((s, arr) => s + (arr[i] || 0), 0)
      }
      // budget month: unidades desde la tabla budget (respetando canal seleccionado o todos)
      return (budgetRows || []).reduce((s, row) => s + Number((row as any)[MONTH_KEYS[i] as any] || 0), 0)
    }

    if (modelo === "budget") {
      // Unidades directas desde la tabla budget (respetando canal seleccionado o todos)
      return (budgetRows || []).reduce(
        (s, row) => s + Number(row[MONTH_KEYS[i] as string] || 0),
        0
      )
    }

    // Modelo real sin test
    return Object.values(quantities).reduce((s, arr) => s + (arr[i] || 0), 0)
  })

  const mergeMonthlyMetric = (perModel: Record<string, number[]>): number[] => {
    return Array.from({ length: 12 }, (_, i) => {
      const m = calcMonthModelAt(i)
      return (perModel[m] || Array(12).fill(0))[i] || 0
    })
  }

  const buildCombinedDetail = () => {
    const qty: Record<string, number[]> = {}
    const odoo: Record<string, number[]> = {}
    const ensureArr = (m: Record<string, number[]>, key: string) => {
      if (!m[key]) m[key] = Array(12).fill(0)
      return m[key]
    }

    for (let i = 0; i < 12; i++) {
      const m = effectiveMonthModels[i]
      const snap = combinedSnapshots[m]
      if (!snap) continue

      if (m.startsWith("budget:")) {
        for (const row of (snap.budgetRows || []) as any[]) {
          const name = resolveToCatalogName(String(row.product_name || ""))
          if (!name) continue
          const v = Number(row[MONTH_KEYS[i] as any] || 0)
          if (v === 0) continue
          ensureArr(qty, name)[i] += v
        }
      } else {
        for (const [rawName, arr] of Object.entries(snap.quantities || {})) {
          const name = resolveToCatalogName(rawName)
          if (!name) continue
          const v = (arr[i] || 0) as number
          if (v !== 0) ensureArr(qty, name)[i] += v
        }
        for (const [rawName, arr] of Object.entries(snap.odooAmounts || {})) {
          const name = resolveToCatalogName(rawName)
          if (!name) continue
          const v = (arr[i] || 0) as number
          if (v !== 0) ensureArr(odoo, name)[i] += v
        }
      }
    }

    return { qty, odoo }
  }

  const detailData = (() => {
    if (combineEnabled) {
      // En modo combinar, el detalle solo soporta Gross Sale para meses "real" (odooAmounts) por ahora.
      const built = buildCombinedDetail()
      return { ...built, grossSale: built.odoo }
    }
    // No combinar: usar los estados actuales.
    // En real, Gross Sales viene de Odoo (odooAmounts). En budget/test no tenemos Odoo.
    const grossSale: Record<string, number[]> = {}
    const ensureArr = (m: Record<string, number[]>, key: string) => {
      if (!m[key]) m[key] = Array(12).fill(0)
      return m[key]
    }

    if (modelo === "real") {
      // Real: usar directamente montos importados de Odoo por producto y mes
      for (const [rawName, arr] of Object.entries(odooAmounts)) {
        const name = resolveToCatalogName(rawName)
        const outArr = ensureArr(grossSale, name)
        for (let i = 0; i < 12; i++) outArr[i] += (arr[i] || 0)
      }
    } else if (modelo === "budget" && !testMode) {
      // Budget: calcular gross sale desde budgetRows + override por unidad (por canal cuando corresponda)
      const pickBudgetOv = (row: any): OverrideData => {
        const prodId = String(row?.product_id || "")
        const name = resolveToCatalogName(String(row?.product_name || ""))
        const rowChannel = String(row?.channel || "")
        const nameNorm = normalizeProductKeyLoose(name)
        const nameMatch = normalizeBudgetMatchKey(name)
        const idChannelKey = prodId ? `${prodId}|${rowChannel}` : ""
        const idPacienteKey = prodId ? `${prodId}|Paciente` : ""
        const idBaseKey = prodId ? `${prodId}|` : ""
        const nameChannelKey = `${name}|${rowChannel}`
        const namePacienteKey = `${name}|Paciente`
        const nameBaseKey = `${name}|`
        const normChannelKey = nameNorm ? `${nameNorm}|${rowChannel}` : ""
        const normPacienteKey = nameNorm ? `${nameNorm}|Paciente` : ""
        const normBaseKey = nameNorm ? `${nameNorm}|` : ""
        const matchChannelKey = nameMatch ? `${nameMatch}|${rowChannel}` : ""
        const matchPacienteKey = nameMatch ? `${nameMatch}|Paciente` : ""
        const matchBaseKey = nameMatch ? `${nameMatch}|` : ""
        return (
          (idChannelKey && budgetOverrides[idChannelKey]) ||
          (idPacienteKey && budgetOverrides[idPacienteKey]) ||
          (idBaseKey && budgetOverrides[idBaseKey]) ||
          budgetOverrides[nameChannelKey] ||
          budgetOverrides[namePacienteKey] ||
          budgetOverrides[nameBaseKey] ||
          (normChannelKey && budgetOverrides[normChannelKey]) ||
          (normPacienteKey && budgetOverrides[normPacienteKey]) ||
          (normBaseKey && budgetOverrides[normBaseKey]) ||
          (matchChannelKey && budgetOverrides[matchChannelKey]) ||
          (matchPacienteKey && budgetOverrides[matchPacienteKey]) ||
          (matchBaseKey && budgetOverrides[matchBaseKey]) ||
          emptyOverride()
        )
      }

      for (const row of (budgetRows || []) as any[]) {
        const name = resolveToCatalogName(String(row?.product_name || ""))
        if (!name) continue
        const ov = pickBudgetOv(row)
        const outArr = ensureArr(grossSale, name)
        for (let i = 0; i < 12; i++) {
          const units = Number(row[MONTH_KEYS[i] as any] || 0)
          if (units === 0) continue
          outArr[i] += (ov.grossSalesUSD || 0) * units
        }
      }
    }

    // Modo híbrido forecast Q1: para Q1, usar montos reales (Odoo) por producto si están disponibles.
    if (hybridForecastQ1Enabled && hybridRealSnapshot?.odooAmounts) {
      for (const [rawName, arr] of Object.entries(hybridRealSnapshot.odooAmounts)) {
        const name = resolveToCatalogName(rawName)
        const outArr = ensureArr(grossSale, name)
        for (let i = 0; i <= 2; i++) outArr[i] = (arr[i] || 0)
      }
    }

    return {
      qty: activeQuantities,
      odoo: modelo === "real" ? odooAmounts : {},
      grossSale,
    }
  })()

  const computeAllModelLines = () => {
    const out: Partial<Record<string, ReturnType<typeof computeNetIncomeChain> & {
      grossSales: number[]
      commercialDiscount: number[]
      productCost: number[]
      kitCost: number[]
      paymentFee: number[]
      bloodDraw: number[]
      sanitary: number[]
      extCourier: number[]
      intCourier: number[]
      physiciansFees: number[]
      salesCommission: number[]
    }>> = {}

    const models: MonthModel[] = (combineEnabled || hybridForecastQ1Enabled)
      ? Array.from(new Set(Array.from({ length: 12 }, (_, i) => calcMonthModelAt(i))))
      : [baseMonthModel]
    for (const m of models) {
      const snap = combineEnabled ? combinedSnapshots[m] : (hybridForecastQ1Enabled && m === "real_2026" ? hybridRealSnapshot : null)
      if ((combineEnabled || hybridForecastQ1Enabled) && m === "real_2026" && !snap) continue

      if (m.startsWith("budget:")) {
        const rows = combineEnabled ? (snap!.budgetRows || []) : (budgetRows || [])
        const ovs = combineEnabled ? (snap!.budgetOverrides || {}) : (budgetOverrides || {})
        const sgaArr = combineEnabled ? snap!.sga : sga
        const taxArr = combineEnabled ? snap!.tax : taxRates

        const grossSales = computeMonthlyBudgetField(rows, ovs, "grossSalesUSD")
        const commercialDiscount = computeMonthlyBudgetField(rows, ovs, "commercialDiscountUSD")
        const productCost = computeMonthlyBudgetField(rows, ovs, "productCostUSD")
        const kitCost = computeMonthlyBudgetField(rows, ovs, "kitCostUSD")
        const paymentFee = computeMonthlyBudgetField(rows, ovs, "paymentFeeUSD")
        const bloodDraw = computeMonthlyBudgetField(rows, ovs, "bloodDrawSampleUSD")
        const sanitary = computeMonthlyBudgetField(rows, ovs, "sanitaryPermitsUSD")
        const extCourier = computeMonthlyBudgetField(rows, ovs, "externalCourierUSD")
        const intCourier = computeMonthlyBudgetField(rows, ovs, "internalCourierUSD")
        const physiciansFees = computeMonthlyBudgetField(rows, ovs, "physiciansFeesUSD")
        const salesCommission = computeMonthlyBudgetField(rows, ovs, "salesCommissionUSD")

        out[m] = {
          grossSales,
          commercialDiscount,
          productCost,
          kitCost,
          paymentFee,
          bloodDraw,
          sanitary,
          extCourier,
          intCourier,
          physiciansFees,
          salesCommission,
          ...computeNetIncomeChain(
            grossSales,
            commercialDiscount,
            productCost,
            kitCost,
            paymentFee,
            bloodDraw,
            sanitary,
            extCourier,
            intCourier,
            physiciansFees,
            salesCommission,
            sgaArr,
            taxArr
          ),
        }
      } else {
        const qty = (combineEnabled || hybridForecastQ1Enabled) ? (snap!.quantities || {}) : quantities
        const amts = (combineEnabled || hybridForecastQ1Enabled) ? (snap!.odooAmounts || {}) : odooAmounts
        const ovs = (combineEnabled || hybridForecastQ1Enabled) ? (snap!.overrides || {}) : overrides
        const sgaArr = (combineEnabled || hybridForecastQ1Enabled) ? snap!.sga : sga
        const taxArr = (combineEnabled || hybridForecastQ1Enabled) ? snap!.tax : taxRates

        const grossSales = computeMonthlyRealGrossSalesFromOdoo(amts)
        const commercialDiscount = computeMonthlyRealField(qty, ovs, "commercialDiscountUSD")
        const productCost = computeMonthlyRealField(qty, ovs, "productCostUSD")
        const kitCost = computeMonthlyRealField(qty, ovs, "kitCostUSD")
        const paymentFee = computeMonthlyRealField(qty, ovs, "paymentFeeUSD")
        const bloodDraw = computeMonthlyRealField(qty, ovs, "bloodDrawSampleUSD")
        const sanitary = computeMonthlyRealField(qty, ovs, "sanitaryPermitsUSD")
        const extCourier = computeMonthlyRealField(qty, ovs, "externalCourierUSD")
        const intCourier = computeMonthlyRealField(qty, ovs, "internalCourierUSD")
        const physiciansFees = computeMonthlyRealField(qty, ovs, "physiciansFeesUSD")
        const salesCommission = computeMonthlyRealField(qty, ovs, "salesCommissionUSD")

        out[m] = {
          grossSales,
          commercialDiscount,
          productCost,
          kitCost,
          paymentFee,
          bloodDraw,
          sanitary,
          extCourier,
          intCourier,
          physiciansFees,
          salesCommission,
          ...computeNetIncomeChain(
            grossSales,
            commercialDiscount,
            productCost,
            kitCost,
            paymentFee,
            bloodDraw,
            sanitary,
            extCourier,
            intCourier,
            physiciansFees,
            salesCommission,
            sgaArr,
            taxArr
          ),
        }
      }
    }

    return out as Record<string, (ReturnType<typeof computeNetIncomeChain> & any)>
  }

  const modelLines = computeAllModelLines()

  const grossSales = mergeMonthlyMetric(Object.fromEntries(Object.entries(modelLines).map(([k, v]) => [k, v.grossSales])) as Record<string, number[]>)
  const commercialDiscount = mergeMonthlyMetric(Object.fromEntries(Object.entries(modelLines).map(([k, v]) => [k, v.commercialDiscount])) as Record<string, number[]>)
  const salesRevenue = mergeMonthlyMetric(Object.fromEntries(Object.entries(modelLines).map(([k, v]) => [k, v.salesRevenue])) as Record<string, number[]>)

  const productCost = mergeMonthlyMetric(Object.fromEntries(Object.entries(modelLines).map(([k, v]) => [k, v.productCost])) as Record<string, number[]>)
  const kitCost = mergeMonthlyMetric(Object.fromEntries(Object.entries(modelLines).map(([k, v]) => [k, v.kitCost])) as Record<string, number[]>)
  const paymentFee = mergeMonthlyMetric(Object.fromEntries(Object.entries(modelLines).map(([k, v]) => [k, v.paymentFee])) as Record<string, number[]>)
  const bloodDraw = mergeMonthlyMetric(Object.fromEntries(Object.entries(modelLines).map(([k, v]) => [k, v.bloodDraw])) as Record<string, number[]>)
  const sanitary = mergeMonthlyMetric(Object.fromEntries(Object.entries(modelLines).map(([k, v]) => [k, v.sanitary])) as Record<string, number[]>)
  const extCourier = mergeMonthlyMetric(Object.fromEntries(Object.entries(modelLines).map(([k, v]) => [k, v.extCourier])) as Record<string, number[]>)
  const intCourier = mergeMonthlyMetric(Object.fromEntries(Object.entries(modelLines).map(([k, v]) => [k, v.intCourier])) as Record<string, number[]>)
  const physiciansFees = mergeMonthlyMetric(Object.fromEntries(Object.entries(modelLines).map(([k, v]) => [k, v.physiciansFees])) as Record<string, number[]>)
  const salesCommission = mergeMonthlyMetric(Object.fromEntries(Object.entries(modelLines).map(([k, v]) => [k, v.salesCommission])) as Record<string, number[]>)

  const totalCOS = Array.from({ length: 12 }, (_, i) =>
    productCost[i] + kitCost[i] + paymentFee[i] + bloodDraw[i] + sanitary[i] +
    extCourier[i] + intCourier[i] + physiciansFees[i] + salesCommission[i]
  )
  const grossProfit = mergeMonthlyMetric(Object.fromEntries(Object.entries(modelLines).map(([k, v]) => [k, v.grossProfit])) as Record<string, number[]>)

  const totalSGA = mergeMonthlyMetric(Object.fromEntries(Object.entries(modelLines).map(([k, v]) => [k, v.totalSGA])) as Record<string, number[]>)
  const iibbAmount = mergeMonthlyMetric(Object.fromEntries(Object.entries(modelLines).map(([k, v]) => [k, v.iibbAmount])) as Record<string, number[]>)
  const incomeTax = mergeMonthlyMetric(Object.fromEntries(Object.entries(modelLines).map(([k, v]) => [k, v.incomeTax])) as Record<string, number[]>)
  const netIncome = mergeMonthlyMetric(Object.fromEntries(Object.entries(modelLines).map(([k, v]) => [k, v.netIncome])) as Record<string, number[]>)

  // Solo se usa para mostrar el detalle por campo cuando no estamos combinando.
  const sgaMonthly: Record<keyof SGAData, number[]> = Object.fromEntries(
    SGA_FIELDS.map(({ key }) => [key, sga.map((x) => x[key])])
  ) as Record<keyof SGAData, number[]>

  const periodSum = (arr: number[]) => monthIndices.reduce((s, i) => s + (arr[i] || 0), 0)
  const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0)

  // ── Editing ───────────────────────────────────────────────────────────────

  const startEdit = (field: keyof SGAData | keyof TaxData, monthIdx: number) => {
    const isTaxField = field === "iibb_pct" || field === "income_tax_pct"
    if (!isTaxField && !canEditSGA) return
    if (isTaxField && !canEditTax) return
    setEditingCell({ field, month: monthIdx })
    const cur = isTaxField ? taxRates[monthIdx][field as keyof TaxData] : sga[monthIdx][field as keyof SGAData]
    setEditValue(String(cur))
  }

  const commitEdit = async () => {
    if (!editingCell) return
    const { field, month } = editingCell
    const newVal = parseFloat(editValue) || 0
    const isTaxField = field === "iibb_pct" || field === "income_tax_pct"

    if (isTaxField) {
      const normalized = Math.abs(newVal)
      setTaxRates((prev) => prev.map((r, i) => i === month ? { ...r, [field]: normalized } : r))
      await supabase.from("pl_sga").upsert(
        { year, country_code: countries[0], month: month + 1, modelo, product_name: "", channel: "", [field]: normalized },
        { onConflict: "year,country_code,month,product_name,channel,modelo" }
      )
    } else {
      // Permitir créditos (negativos) además de gastos (positivos).
      const signed = newVal
      setSga((prev) => prev.map((s, i) => i === month ? { ...s, [field]: signed } : s))
      await supabase.from("pl_sga").upsert(
        { year, country_code: countries[0], month: month + 1, modelo, product_name: product, channel: channels[0], [field]: signed },
        { onConflict: "year,country_code,month,product_name,channel,modelo" }
      )
    }
    setEditingCell(null)
  }

  const cancelEdit = () => setEditingCell(null)

  const buildSgaTooltip = (monthIdx: number, field: keyof SGAData | "TOTAL") => {
    if (combineEnabled) return undefined
    const monthNumber = monthIdx + 1
    const rows = (sgaRowsRaw || []).filter((r) => Number((r as any)?.month) === monthNumber)
    if (!rows.length) return undefined

    const items: { channel: string; product: string; amount: number }[] = []
    for (const r of rows as any[]) {
      const channel = String(r?.channel || "(sin canal)")
      const product = String(r?.product_name || "(sin producto)")
      let amount = 0
      if (field === "TOTAL") {
        for (const f of SGA_FIELDS) amount += Number(r?.[f.key] || 0)
      } else {
        amount = Number(r?.[field] || 0)
      }
      if (amount === 0) continue
      items.push({ channel, product, amount })
    }

    if (!items.length) return undefined

    const byChannel = new Map<string, Map<string, number>>()
    for (const it of items) {
      if (!byChannel.has(it.channel)) byChannel.set(it.channel, new Map())
      const m = byChannel.get(it.channel)!
      m.set(it.product, (m.get(it.product) || 0) + it.amount)
    }

    const channelEntries = Array.from(byChannel.entries()).map(([ch, prodMap]) => {
      const prodEntries = Array.from(prodMap.entries())
        .map(([p, a]) => ({ product: p, amount: a }))
        .sort((a, b) => b.amount - a.amount)
      const channelTotal = prodEntries.reduce((s, x) => s + x.amount, 0)
      return { channel: ch, channelTotal, prodEntries }
    })
    channelEntries.sort((a, b) => b.channelTotal - a.channelTotal)

    const headerLabel =
      field === "TOTAL"
        ? `SG&A — ${MONTH_LABELS[monthIdx]}`
        : `${SGA_FIELDS.find((f) => f.key === field)?.label || "SG&A"} — ${MONTH_LABELS[monthIdx]}`

    const lines: string[] = [headerLabel, "Desglose por canal y producto:"]
    let printed = 0
    const maxProducts = 18
    for (const ch of channelEntries) {
      if (printed >= maxProducts) break
      lines.push(`- ${ch.channel}: ${fmtSga(ch.channelTotal)}`)
      for (const p of ch.prodEntries) {
        if (printed >= maxProducts) break
        lines.push(`  - ${p.product}: ${fmtSga(p.amount)}`)
        printed++
      }
    }
    const total = channelEntries.reduce((s, x) => s + x.channelTotal, 0)
    lines.push(`Total: ${fmtSga(total)}`)
    if (printed >= maxProducts) lines.push("(mostrando top contribuciones)")
    return lines.join("\n")
  }

  const startEditBudgetUnit = (productName: string, monthIdx: number, current: number) => {
    if (!canEditBudgetUnits) return
    setEditingBudgetUnit({ productName, monthIdx })
    setBudgetUnitEditValue(String(current ?? 0))
  }

  const commitEditBudgetUnit = async () => {
    if (!editingBudgetUnit) return
    const { productName, monthIdx } = editingBudgetUnit
    const monthKey = MONTH_KEYS[monthIdx]
    const nextVal = Math.max(0, Math.round(Number(budgetUnitEditValue) || 0))

    // Encontrar la fila única de budget a editar (seguro: requerimos 1 país, 1 canal, 1 producto, 1 budgetName).
    const countryCode = countries[0]
    const channel = channels[0]
    const row = (budgetRows as any[]).find((r) =>
      String(r?.product_name || "") === productName &&
      String(r?.country_code || "") === countryCode &&
      String(r?.channel || "") === channel &&
      String(r?.budget_name || "") === budgetName &&
      Number(r?.year || year) === year
    )

    const rowId = row?.id as string | undefined
    if (!rowId) {
      alert("No se pudo identificar una fila única de budget para editar. Revisá filtros (compañía+canal+producto).")
      setEditingBudgetUnit(null)
      return
    }

    // Optimistic: actualizar estado local
    setBudgetRows((prev) =>
      (prev as any[]).map((r) => (r?.id === rowId ? { ...r, [monthKey]: nextVal } : r))
    )
    setQuantities((prev) => {
      const cur = prev[productName] ? [...prev[productName]] : Array(12).fill(0)
      cur[monthIdx] = nextVal
      return { ...prev, [productName]: cur }
    })

    const { error } = await supabase.from("budget").update({ [monthKey]: nextVal }).eq("id", rowId)
    if (error) {
      alert(`Error guardando budget: ${error.message}`)
      // fallback: recargar desde DB
      await fetchData()
    }

    setEditingBudgetUnit(null)
  }

  // ── Render helpers ────────────────────────────────────────────────────────

  const cellCls = "text-right px-2 py-1.5 text-xs whitespace-nowrap tabular-nums"
  const stickyLabel = (bold = false, section = false, prominent = false, forceGray = false) =>
    `sticky left-0 px-3 ${
      prominent ? "py-2.5 text-sm" : "py-1.5 text-xs"
    } whitespace-nowrap z-10 min-w-[220px] ${
      section
        ? "bg-slate-600/95 font-semibold text-white/60 uppercase tracking-wider"
        : forceGray
          ? "bg-slate-700/40 border-y border-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] font-extrabold tracking-wide text-white"
          : bold
            ? `bg-slate-700/95 ${prominent ? "font-extrabold tracking-wide text-white" : "font-bold text-white"}`
            : "bg-slate-800/95 text-white/80"
    }`

  // Render a standard P&L row
  const Row = ({
    label,
    labelNode,
    values,
    bold = false,
    section = false,
    negative = false,
    indent = false,
    colorClass,
    prominent = false,
    forceGray = false,
    cellTitle,
    formatValue,
  }: {
    label: string
    labelNode?: ReactNode
    values: number[]
    bold?: boolean
    section?: boolean
    negative?: boolean
    indent?: boolean
    colorClass?: string
    prominent?: boolean
    // Forzar color gris/neutral en totales clave.
    forceGray?: boolean
    cellTitle?: (monthIdx: number) => string | undefined
    formatValue?: (val: number) => string
  }) => {
    const ytdVal = periodSum(values)
    const totalVal = sum(values)
    const rowCls = forceGray
      ? "bg-slate-700/40 border-y border-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
      : section
      ? "bg-slate-600/30 border-t border-white/20"
      : prominent
      ? "bg-slate-900/45 border-y border-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
      : bold
      ? "bg-slate-700/40 border-t border-white/10"
      : "hover:bg-white/5"
    const numColor = colorClass
      ? colorClass
      : negative
      ? "text-rose-300"
      : bold
      ? "text-white"
      : "text-white/80"
    const fmtFn = negative ? fmtNeg : fmt
    const fmtCell = formatValue || fmtFn
    const cellSizeCls = prominent ? "py-2.5 text-sm" : ""
    const labelSizeCls = prominent ? "text-sm" : ""
    const labelWeightCls = prominent ? "font-extrabold tracking-wide" : (bold ? "font-bold" : "")

    return (
      <tr className={`${rowCls} transition-colors`}>
        <td className={stickyLabel(bold, section, prominent, forceGray)}>
          <span className={`${labelSizeCls} ${labelWeightCls}`}>
            {indent ? (
              <span className="ml-4">{labelNode ?? label}</span>
            ) : (
              labelNode ?? label
            )}
          </span>
        </td>
        {monthIndices.map((i) => {
          const v = values[i] ?? 0
          return (
            <td key={i} className={`${cellCls} ${cellSizeCls} ${numColor} ${bold || prominent ? "font-semibold" : ""}`}>
              <span title={cellTitle ? cellTitle(i) : undefined}>{fmtCell(v)}</span>
            </td>
          )
        })}
        <td className={`${cellCls} ${cellSizeCls} ${numColor} ${bold || prominent ? "font-semibold" : ""} border-l border-white/10`}>
          {fmtCell(ytdVal)}
        </td>
        <td className={`${cellCls} ${cellSizeCls} ${numColor} ${bold || prominent ? "font-semibold" : ""}`}>
          {fmtCell(totalVal)}
        </td>
      </tr>
    )
  }

  // Render an editable SGA row (negative display)
  const SGARow = ({ field, label }: { field: keyof SGAData; label: string }) => {
    const values = sgaMonthly[field]
    const ytdVal = periodSum(values)
    const totalVal = sum(values)

    return (
      <tr className="hover:bg-white/5 transition-colors">
        <td className={stickyLabel()}>
          <span className="ml-4">{label}</span>
          {!canEditSGA && canEdit && (
            <span className="ml-2 text-[10px] text-white/30">(selecciona producto+canal)</span>
          )}
        </td>
        {monthIndices.map((mIdx) => {
          const v = values[mIdx] ?? 0
          const isEditing = editingCell?.field === field && editingCell.month === mIdx
          const dv = sgaDisplay(v)
          const dvCls = dv > 0 ? "text-emerald-300/90" : dv < 0 ? "text-rose-300" : "text-white/25"
          return (
            <td
              key={mIdx}
              className={`${cellCls} ${dvCls} ${canEditSGA ? "cursor-pointer hover:bg-white/10 rounded" : ""}`}
              onDoubleClick={() => startEdit(field, mIdx)}
              title={canEditSGA ? "Doble clic para editar" : undefined}
            >
              {isEditing ? (
                <input
                  type="number"
                  className="w-20 bg-white/20 text-white text-xs text-right px-1 rounded border border-white/30 focus:outline-none"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={commitEdit}
                  onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") cancelEdit() }}
                  autoFocus
                />
              ) : (
                <span title={buildSgaTooltip(mIdx, field)}>{fmtSga(v)}</span>
              )}
            </td>
          )
        })}
        <td className={`${cellCls} ${sgaDisplay(ytdVal) > 0 ? "text-emerald-300/90" : sgaDisplay(ytdVal) < 0 ? "text-rose-300" : "text-white/25"} border-l border-white/10`}>
          {fmtSga(ytdVal)}
        </td>
        <td className={`${cellCls} ${sgaDisplay(totalVal) > 0 ? "text-emerald-300/90" : sgaDisplay(totalVal) < 0 ? "text-rose-300" : "text-white/25"}`}>
          {fmtSga(totalVal)}
        </td>
      </tr>
    )
  }

  // Render tax rate config row (editable, always country-level)
  const TaxConfigRow = ({ field, label }: { field: keyof TaxData; label: string }) => (
    <tr className="hover:bg-white/5 transition-colors">
      <td className={stickyLabel()}>
        <span className="ml-4 text-white/50 italic text-[11px]">{label}</span>
      </td>
      {monthIndices.map((mIdx) => {
        const t = taxRates[mIdx]
        const v = t[field]
        const isEditing = editingCell?.field === field && editingCell.month === mIdx
        return (
          <td
            key={mIdx}
            className={`${cellCls} text-amber-400/70 text-[11px] ${canEditTax ? "cursor-pointer hover:bg-white/10 rounded" : ""}`}
            onDoubleClick={() => startEdit(field, mIdx)}
          >
            {isEditing ? (
              <input
                type="number"
                step="0.1"
                className="w-14 bg-white/20 text-white text-xs text-right px-1 rounded border border-white/30 focus:outline-none"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") cancelEdit() }}
                autoFocus
              />
            ) : `${v}%`}
          </td>
        )
      })}
      <td className={`${cellCls} text-amber-400/70 text-[11px] border-l border-white/10`}>—</td>
      <td className={`${cellCls} text-amber-400/70 text-[11px]`}>—</td>
    </tr>
  )

  // Section header row
  const SectionHeader = ({ label, colSpan = 15 }: { label: string; colSpan?: number }) => (
    <tr className="bg-slate-600/30">
      <td colSpan={colSpan} className={stickyLabel(false, true) + " py-1.5"}>
        {label}
      </td>
    </tr>
  )

  const vCellCls = `${cellCls} text-cyan-200/95`
  const renderVarianceRow = (label: string, values: (number | null)[]) => {
    const periodVar = monthIndices.reduce((s, mi) => s + (values[mi] ?? 0), 0)
    const totalVar = values.reduce((s: number, v) => s + (v ?? 0), 0)
    return (
      <tr className="hover:bg-white/5 transition-colors bg-slate-900/25">
        <td className={stickyLabel()}>
          <span className="ml-2 text-xs font-medium text-cyan-100/90">{label}</span>
        </td>
        {monthIndices.map((mi) => {
          const v = values[mi]
          return (
            <td
              key={mi}
              className={`${vCellCls} ${v != null && v < 0 ? "text-rose-300" : v != null && v > 0 ? "text-emerald-300/90" : ""}`}
            >
              {v == null ? "—" : fmt(v)}
            </td>
          )
        })}
        <td className={`${vCellCls} border-l border-white/10`}>{fmt(periodVar)}</td>
        <td className={vCellCls}>{fmt(totalVar)}</td>
      </tr>
    )
  }

  // Booleans del desglose según filas expandidas (independientes).
  const zero12 = Array.from({ length: 12 }, () => 0)

  const showGrossSalesAndDiscount =
    expandedSalesRevenue || expandedGrossProfit || expandedNetIncome
  const showCostOfSales = expandedGrossProfit || expandedNetIncome
  // En modo combinar, deshabilitamos desglose editable por campo (SGA/tasas) porque el modelo puede cambiar por mes.
  const showSGAFields = !combineEnabled && financialEnabled && (expandedSGA || expandedNetIncome)
  const showTaxRows = !combineEnabled && financialEnabled && expandedNetIncome

  // ── Loading ───────────────────────────────────────────────────────────────

  if (loading || (combineEnabled && !combineReady)) {
    return (
      <div className="flex items-center justify-center py-20 text-white/60 text-sm">
        {combineError ? `Error en combinar: ${combineError}` : "Cargando datos..."}
      </div>
    )
  }

  const netColor = sum(netIncome) >= 0 ? "text-emerald-300" : "text-red-400"

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <>
      <div className="rounded-lg border border-white/20 bg-slate-800/60 backdrop-blur-sm shadow-xl overflow-hidden">
        {/* Info bar */}
        <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/10">
          <div className="flex items-center gap-4 flex-wrap">
            {canEdit && (
              <span className="text-xs text-white/40">
                Doble clic en celdas editables para modificar valores
              </span>
            )}
            {canEdit && product === "all" && (
              <span className="text-xs text-amber-400/70">
                · SG&A de solo lectura — filtrá por producto + canal para editar
              </span>
            )}
            {canEdit && product !== "all" && channels.length !== 1 && (
              <span className="text-xs text-amber-400/70">
                · SG&A de solo lectura — seleccioná un canal específico para editar
              </span>
            )}
          </div>
          {/* Dropdowns de agrupación van en cada fila de totales */}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            {/* ─ Header ─────────────────────────────────────────────────── */}
            <thead>
              <tr className="bg-slate-700/80 border-b border-white/20">
                <th className="sticky left-0 bg-slate-700/95 px-3 py-2.5 text-left text-xs font-semibold text-white/70 min-w-[220px] z-20">
                  Concepto
                </th>
              {monthIndices.map((i) => (
                <th
                  key={i}
                  className="px-2 py-2.5 text-right text-xs font-semibold min-w-[92px] text-white"
                >
                  <div className="flex flex-col items-end gap-1">
                    <span>{SHORT_LABELS[i]}</span>
                    {combineEnabled && (
                      <select
                        value={effectiveMonthModels[i]}
                        onChange={(e) => onMonthModelChange?.(i, e.target.value as MonthModel)}
                        className="h-7 w-[86px] rounded-md border border-white/20 bg-white/10 px-2 text-[11px] text-white"
                        title="Modelo del mes"
                      >
                        <option value={`budget:${budgetName}`} className="bg-blue-900 text-white">Budget</option>
                        <option value="real_2026" className="bg-blue-900 text-white">Real 2026</option>
                        <option value="real_2025" className="bg-blue-900 text-white">Real 2025</option>
                      </select>
                    )}
                  </div>
                </th>
              ))}
                <th className="px-2 py-2.5 text-right text-xs font-semibold text-blue-300 min-w-[80px] border-l border-white/20">
                  PERIODO
                </th>
                <th className="px-2 py-2.5 text-right text-xs font-semibold text-blue-300 min-w-[80px]">
                  TOTAL
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-white/5">
              {/* ─ Unidades ───────────────────────────────────────────── */}
              <tr className="bg-blue-900/30 border-b border-white/20">
                <td className="sticky left-0 bg-blue-900/60 px-3 py-2 text-xs font-bold text-blue-200 whitespace-nowrap z-10 min-w-[220px]">
                  Unidades
                </td>
                {monthIndices.map((i) => {
                  const v = totalUnits[i] ?? 0
                  return (
                    <td
                      key={i}
                      className={`${cellCls} font-bold ${
                        v > 0 ? "text-blue-200" : v < 0 ? "text-rose-300" : "text-white/25"
                      }`}
                    >
                      {v !== 0 ? formatNumber(v, "es-AR") : "-"}
                    </td>
                  )
                })}
                <td
                  className={`${cellCls} font-bold border-l border-white/10 ${
                    periodSum(totalUnits) > 0 ? "text-blue-200" : periodSum(totalUnits) < 0 ? "text-rose-300" : "text-white/25"
                  }`}
                >
                  {periodSum(totalUnits) !== 0 ? formatNumber(periodSum(totalUnits), "es-AR") : "-"}
                </td>
                <td
                  className={`${cellCls} font-bold ${
                    sum(totalUnits) > 0 ? "text-blue-200" : sum(totalUnits) < 0 ? "text-rose-300" : "text-white/25"
                  }`}
                >
                  {sum(totalUnits) !== 0 ? formatNumber(sum(totalUnits), "es-AR") : "-"}
                </td>
              </tr>

              {/* ─ Revenue ────────────────────────────────────────────── */}
              {showGrossSalesAndDiscount && <Row label="Gross Sales (sin IVA)" values={grossSales} />}
              {showGrossSalesAndDiscount && <Row label="Commercial Discount" values={commercialDiscount} negative indent />}
              <Row
                label="Sales Revenue"
                labelNode={
                  <span className="inline-flex items-center gap-2">
                    <span>Sales Revenue</span>
                    <button
                      type="button"
                      onClick={() => {
                        setExpandedSalesRevenue((v) => !v)
                      }}
                      className="p-0.5 text-white/70 hover:text-white"
                      aria-label="Alternar desglose Sales Revenue"
                    >
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${
                          expandedSalesRevenue ? "rotate-0" : "-rotate-90"
                        }`}
                      />
                    </button>
                  </span>
                }
                values={salesRevenue}
                bold
                prominent
                forceGray
                colorClass="text-white"
              />

              {/* ─ Cost of Sales (sin título) ─────────────────────────── */}
              {showCostOfSales && (
                <>
                  <Row label="Product Cost" values={productCost} negative indent />
                  <Row label="Kit Cost" values={kitCost} negative indent />
                  <Row label="Payment Fee Costs" values={paymentFee} negative indent />
                  <Row label="Blood Drawn & Sample Handling" values={bloodDraw} negative indent />
                  <Row label="Sanitary Permits to export blood" values={sanitary} negative indent />
                  <Row label="External Courier" values={extCourier} negative indent />
                  <Row label="Internal Courier" values={intCourier} negative indent />
                  <Row label="Physicians Fees" values={physiciansFees} negative indent />
                  <Row label="Sales Commission" values={salesCommission} negative indent />
                  <Row label="Total Cost of Sales" values={totalCOS} bold negative />
                </>
              )}

              {/* ─ Gross Profit (gris/neutral) ─────────────────────────── */}
              <Row
                label="Gross Profit"
                labelNode={
                  <span className="inline-flex items-center gap-2">
                    <span>Gross Profit</span>
                    <button
                      type="button"
                      onClick={() => {
                        setExpandedGrossProfit((v) => !v)
                      }}
                      className="p-0.5 text-white/70 hover:text-white"
                      aria-label="Alternar desglose Gross Profit"
                    >
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${
                          expandedGrossProfit ? "rotate-0" : "-rotate-90"
                        }`}
                      />
                    </button>
                  </span>
                }
                values={grossProfit}
                bold
                prominent
                forceGray
                colorClass="text-white"
              />

              {/* ─ SG&A (sin título) ──────────────────────────────────── */}
              {showSGAFields && (
                <>
                  {SGA_FIELDS.map(({ key, label }) => (
                    <SGARow key={key} field={key} label={label} />
                  ))}
                </>
              )}
              <Row
                label="SG&A"
                labelNode={
                  <span className="inline-flex items-center gap-2">
                    <span>SG&A</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (!financialEnabled) return
                        setExpandedSGA((v) => !v)
                      }}
                      className={`p-0.5 ${financialEnabled ? "text-white/70 hover:text-white" : "text-white/20 cursor-not-allowed"}`}
                      aria-label="Alternar desglose SG&A"
                    >
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${
                          financialEnabled && expandedSGA ? "rotate-0" : "-rotate-90"
                        }`}
                      />
                    </button>
                  </span>
                }
                values={totalSGA}
                bold
                prominent
                forceGray
                colorClass="text-white"
                cellTitle={(mi) => buildSgaTooltip(mi, "TOTAL")}
                formatValue={(v) => fmtSga(v)}
              />

              {/* ─ Taxes (sin título) ─────────────────────────────────── */}
              {showTaxRows && (
                <>
                  <TaxConfigRow field="iibb_pct" label="IIBB — tasa (% sobre revenue)" />
                  <Row label="IIBB (% sobre revenue)" values={iibbAmount} negative indent />
                  <TaxConfigRow field="income_tax_pct" label="Income tax — tasa (% sobre ganancia)" />
                  <Row label="Income tax (% sobre ganancia)" values={incomeTax} negative indent />
                </>
              )}

              {/* ─ Net Income (gris/neutral) ──────────────────────────── */}
              <Row
                label="Net Income"
                labelNode={
                  <span className="inline-flex items-center gap-2">
                    <span>Net Income</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (!financialEnabled) return
                        setExpandedNetIncome((v) => !v)
                      }}
                      className={`p-0.5 ${financialEnabled ? "text-white/70 hover:text-white" : "text-white/20 cursor-not-allowed"}`}
                      aria-label="Alternar desglose Net Income"
                    >
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${
                          financialEnabled && expandedNetIncome ? "rotate-0" : "-rotate-90"
                        }`}
                      />
                    </button>
                  </span>
                }
                values={netIncome}
                bold
                prominent
                forceGray
                colorClass="text-white"
              />
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-t border-white/10">
          <span className="text-xs text-white/40">
            Periodo = {MONTH_LABELS[startIndex]}–{MONTH_LABELS[endIndex]} {year} · Valores entre () = negativos
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDetail((v) => !v)}
            className="text-white/60 hover:text-white hover:bg-white/10 text-xs"
          >
            <Table2 className="h-3.5 w-3.5 mr-1.5" />
            {showDetail ? "Ocultar detalle" : "Ver detalle de productos"}
            {showDetail ? <ChevronDown className="h-3.5 w-3.5 ml-1" /> : <ChevronRight className="h-3.5 w-3.5 ml-1" />}
          </Button>
        </div>
      </div>

      {/* ── Detail panel ─────────────────────────────────────────────────── */}
      {showDetail && (
        <div className="mt-4 rounded-lg border border-white/20 bg-slate-800/60 backdrop-blur-sm shadow-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-slate-700/60 border-b border-white/20">
            <div className="flex items-center gap-3">
              <Table2 className="h-4 w-4 text-blue-300" />
              <span className="text-sm font-semibold text-white">
                Detalle de productos — {modelo === "budget" ? "Budget" : "Real"} {year}
              </span>
              <span className="text-xs text-white/50">
                ({Object.keys(detailData.qty).length} producto{Object.keys(detailData.qty).length !== 1 ? "s" : ""})
              </span>
            </div>
            <div className="flex items-center gap-1 flex-wrap justify-end">
              <button
                onClick={() => setDetailMonth(null)}
                className={`px-2 py-0.5 text-[11px] rounded transition-colors ${detailMonth === null ? "bg-blue-500 text-white" : "text-white/50 hover:text-white hover:bg-white/10"}`}
              >
                Todos
              </button>
              {monthIndices.map((i) => (
                <button
                  key={i}
                  onClick={() => setDetailMonth(detailMonth === i ? null : i)}
                  className={`px-2 py-0.5 text-[11px] rounded transition-colors ${detailMonth === i ? "bg-blue-500 text-white" : "text-white/50 hover:text-white hover:bg-white/10"}`}
                >
                  {SHORT_LABELS[i]}
                </button>
              ))}
            </div>
            {testMode && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-emerald-300/80">
                  Edita unidades de prueba por producto y mes
                </span>
              </div>
            )}
          </div>

          {Object.keys(detailData.qty).length === 0 ? (
            <div className="text-center py-8 text-white/40 text-sm">
              No hay datos para los filtros seleccionados
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-700/50 border-b border-white/20">
                    <th className="sticky left-0 bg-slate-700/95 px-3 py-2.5 text-left text-xs font-semibold text-white/70 min-w-[200px] z-20">
                      Producto
                    </th>
                    <th className="px-2 py-2.5 text-left text-xs font-semibold text-white/50 min-w-[110px]">
                      Categoría
                    </th>
                    {detailMonth !== null ? (
                      <th className="px-2 py-2.5 text-right text-xs font-semibold text-white min-w-[80px]">
                        {MONTH_LABELS[detailMonth]}
                      </th>
                    ) : (
                      <>
                        {monthIndices.map((i) => (
                          <th key={i} className="px-2 py-2.5 text-right text-xs font-semibold text-white min-w-[52px]">
                            {SHORT_LABELS[i]}
                          </th>
                        ))}
                        <th className="px-2 py-2.5 text-right text-xs font-semibold text-blue-300 min-w-[60px] border-l border-white/20">
                          YTD
                        </th>
                      </>
                    )}
                    {detailMonth === null && (
                      <th className="px-2 py-2.5 text-right text-xs font-semibold text-blue-300 min-w-[80px]">
                        Gross Sale
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {Object.entries(detailData.qty)
                    .sort(([a], [b]) => {
                      const keyA = ((name: string) => {
                        const s = displayProductLabelFromName(name, productAliases) || ""
                        const firstLetterIdx = s.search(/\p{L}/u)
                        if (firstLetterIdx < 0) return ""
                        const tail = s.slice(firstLetterIdx)
                        // Clave compuesta solo por letras (ignora números, símbolos y espacios)
                        return tail.replace(/[^\p{L}]+/gu, "")
                      })(a)
                      const keyB = ((name: string) => {
                        const s = displayProductLabelFromName(name, productAliases) || ""
                        const firstLetterIdx = s.search(/\p{L}/u)
                        if (firstLetterIdx < 0) return ""
                        const tail = s.slice(firstLetterIdx)
                        return tail.replace(/[^\p{L}]+/gu, "")
                      })(b)

                      return keyA.localeCompare(keyB, "es", { sensitivity: "base" })
                    })
                    .map(([name, qtArr]) => {
                      const cat = productCategories[name] || ""
                      const isKnownProduct = Object.prototype.hasOwnProperty.call(productCategories, name)
                      const rowTotal = monthIndices.reduce((s, i) => s + (qtArr[i] || 0), 0)
                      const totalGS = monthIndices.reduce((s, i) => s + ((detailData.grossSale?.[name]?.[i] || 0) as number), 0)
                      return (
                      <tr key={name} className="hover:bg-white/5 transition-colors">
                          <td className="sticky left-0 bg-slate-800/95 px-3 py-2 text-xs text-white/90 whitespace-nowrap z-10">
                          <div className="flex items-center gap-2">
                            <span>{displayProductLabelFromName(name, productAliases)}</span>
                            {!isKnownProduct && canEdit && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 p-0 text-green-300 hover:text-green-200 hover:bg-white/10"
                                title="Crear producto"
                                onClick={() =>
                                  openCreateProductDialog({
                                    defaultName: name,
                                    onCreated: async () => {
                                      // Refresca para que el nuevo producto aparezca en `products`.
                                      await fetchData()
                                    },
                                  })
                                }
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                          </td>
                          <td className="px-2 py-2 text-xs text-white/50 whitespace-nowrap">{cat}</td>
                          {detailMonth !== null ? (
                            <td className="px-2 py-2 text-right text-xs font-semibold text-white tabular-nums">
                              {testMode ? (
                                <input
                                  type="number"
                                  className="w-16 bg-white/10 border border-white/30 text-white text-right text-xs px-1 rounded focus:outline-none"
                                  value={qtArr[detailMonth] || 0}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value)
                                    setTestQuantities((prev) => {
                                      if (!prev) return prev
                                      const next = { ...prev }
                                      const arr = [...(next[name] || Array(12).fill(0))]
                                      arr[detailMonth] = isNaN(val) ? 0 : Math.max(0, val)
                                      next[name] = arr
                                      return next
                                    })
                                  }}
                                />
                              ) : (
                                qtArr[detailMonth] || 0
                              )}
                            </td>
                          ) : (
                            <>
                              {monthIndices.map((i) => {
                                const v = qtArr[i] || 0
                                const isBudgetEditing = editingBudgetUnit?.productName === name && editingBudgetUnit.monthIdx === i
                                const budgetEditableCell = canEditBudgetUnits && channels.length === 1 && countries.length === 1
                                return (
                                <td
                                  key={i}
                                  className={`px-2 py-2 text-right text-xs tabular-nums ${
                                    v > 0 ? "text-white/80 font-medium" : v < 0 ? "text-rose-300 font-medium" : "text-white/25"
                                  } ${budgetEditableCell ? "cursor-pointer hover:bg-white/10 rounded" : ""}`}
                                  onDoubleClick={() => {
                                    if (!budgetEditableCell) return
                                    startEditBudgetUnit(name, i, v)
                                  }}
                                >
                                  {isBudgetEditing ? (
                                    <input
                                      type="number"
                                      className="w-12 bg-white/10 border border-white/30 text-white text-right text-[11px] px-1 rounded focus:outline-none"
                                      value={budgetUnitEditValue}
                                      onChange={(e) => setBudgetUnitEditValue(e.target.value)}
                                      onBlur={commitEditBudgetUnit}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") commitEditBudgetUnit()
                                        if (e.key === "Escape") setEditingBudgetUnit(null)
                                      }}
                                      autoFocus
                                    />
                                  ) : testMode ? (
                                    <input
                                      type="number"
                                      className="w-12 bg-white/10 border border-white/30 text-white text-right text-[11px] px-1 rounded focus:outline-none"
                                      value={v || 0}
                                      onChange={(e) => {
                                        const val = parseFloat(e.target.value)
                                        setTestQuantities((prev) => {
                                          if (!prev) return prev
                                          const next = { ...prev }
                                          const arr = [...(next[name] || Array(12).fill(0))]
                                          arr[i] = isNaN(val) ? 0 : Math.max(0, val)
                                          next[name] = arr
                                          return next
                                        })
                                      }}
                                    />
                                  ) : (
                                    v !== 0 ? v : "-"
                                  )}
                                </td>
                                )
                              })}
                              <td className="px-2 py-2 text-right text-xs font-bold text-white tabular-nums border-l border-white/10">
                                {rowTotal}
                              </td>
                            </>
                          )}
                          {detailMonth === null && (
                            <td className="px-2 py-2 text-right text-xs text-blue-300 tabular-nums font-medium">
                              {totalGS !== 0 ? `$${formatNumber(totalGS, "es-AR", { maximumFractionDigits: 0 })}` : "-"}
                            </td>
                          )}
                        </tr>
                      )
                    })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-700/60 border-t border-white/20">
                    <td className="sticky left-0 bg-slate-700/95 px-3 py-2 text-xs font-bold text-white z-10">
                      TOTAL
                    </td>
                    <td className="px-2 py-2 text-xs text-white/40">
                      {Object.keys(detailData.qty).length} productos
                    </td>
                    {detailMonth !== null ? (
                      <td className="px-2 py-2 text-right text-xs font-bold text-white tabular-nums">
                        {Object.values(detailData.qty).reduce((s, arr) => s + (arr[detailMonth] || 0), 0)}
                      </td>
                    ) : (
                      <>
                        {monthIndices.map((i) => (
                          <td key={i} className="px-2 py-2 text-right text-xs font-bold text-white tabular-nums">
                            {(() => {
                              const v = Object.values(detailData.qty).reduce((s, arr) => s + (arr[i] || 0), 0)
                              return v !== 0 ? v : "-"
                            })()}
                          </td>
                        ))}
                        <td className="px-2 py-2 text-right text-xs font-bold text-white tabular-nums border-l border-white/10">
                          {Object.values(detailData.qty).reduce(
                            (s, arr) => s + monthIndices.reduce((a, i) => a + (arr[i] || 0), 0),
                            0
                          )}
                        </td>
                      </>
                    )}
                    {detailMonth === null && (
                      <td className="px-2 py-2 text-right text-xs font-bold text-blue-300 tabular-nums">
                        {(() => {
                          const total = Object.entries(detailData.qty).reduce((s, [name]) => {
                            const amt = detailData.grossSale?.[name]
                            if (!amt) return s
                            return s + monthIndices.reduce((a, i) => a + (amt[i] || 0), 0)
                          }, 0)
                          return total !== 0
                            ? `$${formatNumber(total, "es-AR", { maximumFractionDigits: 0 })}`
                            : "-"
                        })()}
                      </td>
                    )}
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}
    </>
  )
}
