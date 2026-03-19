"use client"

import { useEffect, useState, useCallback, type ReactNode } from "react"
import { supabase } from "@/lib/supabase"
import { ChevronDown, ChevronRight, Plus, Table2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { displayProductName, formatNumber } from "@/lib/utils"
import { useProductCreateDialog } from "@/components/products/ProductCreateDialogProvider"

// ─── Types ────────────────────────────────────────────────────────────────────

interface PLTableProps {
  modelo: "budget" | "real"
  year: number
  countries: string[]
  categories: string[]
  /** Array vacío = todos. */
  products: string[]
  channels: string[]
  canEdit: boolean
  /** Mes hasta el cual calcular el YTD (1-12) */
  ytdMonth: number
  /** Modo test: permite simular unidades manualmente */
  testMode?: boolean
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
  CL: ["SouthGenetics LLC Chile", "Southgenetics LLC Chile", "Southgenetics LTDA"],
  CO: ["SouthGenetics LLC Colombia"],
  MX: ["SouthGenetics LLC México"],
  UY: ["SouthGenetics LLC", "SouthGenetics LLC Uruguay"],
  VE: ["SouthGenetics LLC Venezuela"],
  // \"Todos los países\": unión de todas las compañías conocidas
  all: [
    "SouthGenetics LLC Argentina",
    "SouthGenetics LLC Arge",
    "SouthGenetics LLC Chile",
    "Southgenetics LLC Chile",
    "Southgenetics LTDA",
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

// ─── Component ────────────────────────────────────────────────────────────────

export function PLTable({ modelo, year, countries, categories, products, channels, canEdit, ytdMonth, testMode }: PLTableProps) {
  const [loading, setLoading] = useState(true)
  const [quantities, setQuantities] = useState<Record<string, number[]>>({})
  const [productCategories, setProductCategories] = useState<Record<string, string>>({})
  const [overrides, setOverrides] = useState<Record<string, OverrideData>>({})
  // Budget-mode raw rows (product_id, product_name, channel, months) to compute precio * unidades por canal
  const [budgetRows, setBudgetRows] = useState<Record<string, unknown>[]>([])
  // Budget-mode overrides por producto(+canal). Claves típicas: `${product_id}|${channel}` o `${product_id}|`.
  const [budgetOverrides, setBudgetOverrides] = useState<Record<string, OverrideData>>({})
  // SGA per month (summed if viewing "all", specific if product+channel selected)
  const [sga, setSga] = useState<SGAData[]>(Array.from({ length: 12 }, emptySGA))
  // Tax rates: country-level, stored with product_name='' and channel=''
  const [taxRates, setTaxRates] = useState<TaxData[]>(Array.from({ length: 12 }, emptyTax))
  // Editing state
  const [editingCell, setEditingCell] = useState<{ field: keyof SGAData | keyof TaxData; month: number } | null>(null)
  const [editValue, setEditValue] = useState<string>("")
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

  // Dropdowns independientes por fila de totales.
  // Al expandir una fila, se muestra el desglose correspondiente (y dependencias),
  // pero al expandir otra no se cierra esta.
  const [expandedSalesRevenue, setExpandedSalesRevenue] = useState(false)
  const [expandedGrossProfit, setExpandedGrossProfit] = useState(false)
  const [expandedSGA, setExpandedSGA] = useState(false)
  const [expandedNetIncome, setExpandedNetIncome] = useState(false)

  const financialEnabled = modelo === "budget"
  // Can edit SGA amounts only when both product AND channel are specific (exactly one product)
  // En multi-selección: podemos editar solo cuando se seleccionó un único canal.
  const canEditSGA = canEdit && financialEnabled && products.length === 1 && channels.length === 1 && countries.length === 1
  // Taxes are stored at country-level (one country_code row), so allow editing only when a single country is selected.
  const canEditTax = canEdit && financialEnabled && countries.length === 1

  // Mes índice (0-11) hasta el cual se calcula el YTD
  const ytdIndex = Math.min(Math.max(ytdMonth - 1, 0), 11)
  const monthIndices = Array.from({ length: ytdIndex + 1 }, (_, i) => i)

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
    // En Real queremos "limpiar" únicamente SG&A/Impuestos (no el resto).
    // Los costos de producto (Gross Sales / Gross Profit) se calculan desde overrides + cantidades,
    // por eso NO debemos tocarlos.
    setSga(Array.from({ length: 12 }, emptySGA))
    setTaxRates(Array.from({ length: 12 }, emptyTax))
    try {
      if (modelo === "budget") {
        if (testMode) {
          // En modo Test usamos overrides agregados por producto, igual que en REAL
          await Promise.all([fetchQuantities(), fetchOverrides(), fetchSGA()])
        } else {
          await Promise.all([fetchQuantities(), fetchBudgetOverrides(), fetchSGA()])
        }
      } else {
        // En modo REAL dejamos SG&A e impuestos en blanco (zeros) hasta que se carguen/validen.
        await Promise.all([fetchQuantities(), fetchOverrides(), fetchTaxes()])
      }
    } finally {
      setLoading(false)
    }
  }, [modelo, year, countries, categories, products, channels, testMode])

  useEffect(() => { fetchData() }, [fetchData])

  const fetchQuantities = async () => {
    const qtys: Record<string, number[]> = {}
    const cats: Record<string, string> = {}

    const { data: allProds } = await supabase.from("products").select("name, category")
    for (const p of allProds || []) cats[p.name] = p.category || ""

    if (modelo === "budget") {
      let q = supabase
        .from("budget")
        .select("product_id, product_name, jan,feb,mar,apr,may,jun,jul,aug,sep,oct,nov,dec, channel, country_code")
        .eq("year", year)

      if (countries.length) q = q.in("country_code", countries)
      if (products.length > 0) {
        q = q.in("product_name", products)
      }
      // Si se selecciona un canal específico, las unidades deben provenir solo de ese canal.
      // Si el canal es "all", sumamos las unidades de todos los canales.
      if (channels.length) q = q.in("channel", channels)

      const { data } = await q
      if (!data) { setProductCategories(cats); setBudgetRows([]); return }

      const categorySet = shouldFilterCategories ? categoriesSet : null
      const allowedProds = categorySet
        ? new Set(Object.entries(cats).filter(([, c]) => categorySet.has(c)).map(([n]) => n))
        : null

      const rowsForBudget: Record<string, unknown>[] = []

      for (const row of data as Record<string, unknown>[]) {
        const name = row.product_name as string
        if (allowedProds && !allowedProds.has(name)) continue
        rowsForBudget.push(row)
        const arr = MONTH_KEYS.map((k) => Number(row[k] || 0))
        qtys[name] = qtys[name] ? qtys[name].map((v, i) => v + arr[i]) : arr
      }

      setBudgetRows(rowsForBudget)
    } else {
      // Modo REAL: no usamos budgetRows
      setBudgetRows([])
      const companies = countries.flatMap((c) => COUNTRY_TO_COMPANIES[c] || [])
      if (!companies.length) { setQuantities({}); setProductCategories(cats); return }

      let q = supabase
        .from("ventas_mensuales_view")
        .select("producto, mes, cantidad_ventas")
        .eq("año", year)
        .in("compañia", companies)
      if (products.length > 0) q = q.in("producto", products)

      const { data } = await q
      if (!data) { setProductCategories(cats); return }

      // IMPORTANTE (Real):
      // Si el producto no existe en `public.products` (no está en `cats`),
      // NO lo descartamos. Así mostramos las ventas aunque falte el match.
      const categorySet = shouldFilterCategories ? categoriesSet : null

      for (const row of data as { producto: string; mes: number; cantidad_ventas: number }[]) {
        const name = row.producto
        if (categorySet) {
          const knownCategory = cats[name]
          // Solo excluimos si es un producto CON categoría conocida y NO coincide.
          // Si `knownCategory` es undefined/"" (producto faltante), lo dejamos pasar.
          if (knownCategory && !categorySet.has(knownCategory)) continue
        }
        if (!qtys[name]) qtys[name] = Array(12).fill(0)
        const mIdx = row.mes - 1
        if (mIdx >= 0 && mIdx < 12) qtys[name][mIdx] += row.cantidad_ventas
      }
    }

    setQuantities(qtys)
    setProductCategories(cats)
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

    setBudgetOverrides(ovs)
  }

  const fetchOverrides = async () => {
    const ovs: Record<string, OverrideData> = {}

    let q = supabase
      .from("product_country_overrides")
      .select("overrides, product_id, country_code")
    if (countries.length) q = q.in("country_code", countries)
    if (channels.length) q = q.in("channel", channels)

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
    // Taxes + SG&A suelen vivir en el mismo recurso `pl_sga`,
    // pero en modo REAL solo queremos limpiar SG&A y mantener impuestos.
    // Por eso, `fetchSGA` carga ambos; en REAL llamamos solo a `fetchTaxes`.
    await fetchTaxes()

    // Fetch SGA amounts
    let sgaQuery = supabase
      .from("pl_sga")
      .select("month, salaries_wages, professional_fees, contracted_services, travel_lodging_meals, rent_expenses, advertising_promotion, financial_expenses, other_expenses, product_name, channel, country_code")
      .eq("year", year)
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
    for (const row of sgaData || []) {
      const idx = row.month - 1
      if (idx < 0 || idx >= 12) continue
      for (const f of SGA_FIELDS) {
        // Normalizamos SG&A como costos positivos (se muestran en negativo, y deben restar en Net Income)
        sgaArr[idx][f.key] += Math.abs(Number(row[f.key] || 0))
      }
    }
    setSga(sgaArr)
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

  const grossSales = computeMonthly("grossSalesUSD")
  const commercialDiscount = computeMonthly("commercialDiscountUSD")
  const salesRevenue = grossSales.map((v, i) => v - commercialDiscount[i])
  const productCost = computeMonthly("productCostUSD")
  const kitCost = computeMonthly("kitCostUSD")
  const paymentFee = computeMonthly("paymentFeeUSD")
  const bloodDraw = computeMonthly("bloodDrawSampleUSD")
  const sanitary = computeMonthly("sanitaryPermitsUSD")
  const extCourier = computeMonthly("externalCourierUSD")
  const intCourier = computeMonthly("internalCourierUSD")
  const physiciansFees = computeMonthly("physiciansFeesUSD")
  const salesCommission = computeMonthly("salesCommissionUSD")

  const totalCOS = Array.from({ length: 12 }, (_, i) =>
    productCost[i] + kitCost[i] + paymentFee[i] + bloodDraw[i] + sanitary[i] +
    extCourier[i] + intCourier[i] + physiciansFees[i] + salesCommission[i]
  )
  const grossProfit = salesRevenue.map((v, i) => v - totalCOS[i])

  const sgaMonthly: Record<keyof SGAData, number[]> = Object.fromEntries(
    SGA_FIELDS.map(({ key }) => [key, sga.map((s) => s[key])])
  ) as Record<keyof SGAData, number[]>

  const totalSGA = Array.from({ length: 12 }, (_, i) =>
    SGA_FIELDS.reduce((s, f) => s + sgaMonthly[f.key][i], 0)
  )

  const iibbAmount = salesRevenue.map((v, i) => v * (taxRates[i].iibb_pct / 100))
  const incomeTaxBase = grossProfit.map((v, i) => v - totalSGA[i])
  const incomeTax = incomeTaxBase.map((v, i) => Math.max(0, v) * (taxRates[i].income_tax_pct / 100))
  const netIncome = grossProfit.map((v, i) => v - totalSGA[i] - iibbAmount[i] - incomeTax[i])

  const ytd = (arr: number[]) => arr.slice(0, ytdIndex + 1).reduce((a, b) => a + b, 0)
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
        { year, country_code: countries[0], month: month + 1, product_name: "", channel: "", [field]: normalized },
        { onConflict: "year,country_code,month,product_name,channel" }
      )
    } else {
      const normalized = Math.abs(newVal)
      setSga((prev) => prev.map((s, i) => i === month ? { ...s, [field]: normalized } : s))
      await supabase.from("pl_sga").upsert(
        { year, country_code: countries[0], month: month + 1, product_name: product, channel: channels[0], [field]: normalized },
        { onConflict: "year,country_code,month,product_name,channel" }
      )
    }
    setEditingCell(null)
  }

  const cancelEdit = () => setEditingCell(null)

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
  }) => {
    const ytdVal = ytd(values)
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
              {fmtFn(v)}
            </td>
          )
        })}
        <td className={`${cellCls} ${cellSizeCls} ${numColor} ${bold || prominent ? "font-semibold" : ""} border-l border-white/10`}>
          {fmtFn(ytdVal)}
        </td>
        <td className={`${cellCls} ${cellSizeCls} ${numColor} ${bold || prominent ? "font-semibold" : ""}`}>
          {fmtFn(totalVal)}
        </td>
      </tr>
    )
  }

  // Render an editable SGA row (negative display)
  const SGARow = ({ field, label }: { field: keyof SGAData; label: string }) => {
    const values = sgaMonthly[field]
    const ytdVal = ytd(values)
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
          return (
            <td
              key={mIdx}
              className={`${cellCls} text-rose-300 ${canEditSGA ? "cursor-pointer hover:bg-white/10 rounded" : ""}`}
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
              ) : fmtNeg(v)}
            </td>
          )
        })}
        <td className={`${cellCls} text-rose-300 border-l border-white/10`}>{fmtNeg(ytdVal)}</td>
        <td className={`${cellCls} text-rose-300`}>{fmtNeg(totalVal)}</td>
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

  // Booleans del desglose según filas expandidas (independientes).
  const zero12 = Array.from({ length: 12 }, () => 0)

  const showGrossSalesAndDiscount =
    expandedSalesRevenue || expandedGrossProfit || expandedNetIncome
  const showCostOfSales = expandedGrossProfit || expandedNetIncome
  const showSGAFields = financialEnabled && (expandedSGA || expandedNetIncome)
  const showTaxRows = financialEnabled && expandedNetIncome

  // ── Loading ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-white/60 text-sm">
        Cargando datos...
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
                  className={`px-2 py-2.5 text-right text-xs font-semibold min-w-[72px] ${
                    i <= ytdIndex ? "text-white" : "text-white/40"
                  }`}
                >
                  {SHORT_LABELS[i]}
                </th>
              ))}
                <th className="px-2 py-2.5 text-right text-xs font-semibold text-blue-300 min-w-[80px] border-l border-white/20">
                  YTD
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
                    <td key={i} className={`${cellCls} font-bold ${v > 0 ? "text-blue-200" : "text-white/25"}`}>
                      {v > 0 ? formatNumber(v, "es-AR") : "-"}
                    </td>
                  )
                })}
                <td className={`${cellCls} font-bold text-blue-200 border-l border-white/10`}>
                  {formatNumber(ytd(totalUnits), "es-AR") || "-"}
                </td>
                <td className={`${cellCls} font-bold text-blue-200`}>
                  {formatNumber(sum(totalUnits), "es-AR") || "-"}
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
                negative
                prominent
                forceGray
                colorClass="text-white"
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
            YTD = acumulado hasta {MONTH_LABELS[ytdIndex]} {year} · Valores entre () = negativos
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
                ({Object.keys(quantities).length} producto{Object.keys(quantities).length !== 1 ? "s" : ""})
              </span>
            </div>
            <div className="flex items-center gap-1 flex-wrap justify-end">
              <button
                onClick={() => setDetailMonth(null)}
                className={`px-2 py-0.5 text-[11px] rounded transition-colors ${detailMonth === null ? "bg-blue-500 text-white" : "text-white/50 hover:text-white hover:bg-white/10"}`}
              >
                Todos
              </button>
              {SHORT_LABELS.map((lbl, i) => (
                <button
                  key={i}
                  onClick={() => setDetailMonth(detailMonth === i ? null : i)}
                  className={`px-2 py-0.5 text-[11px] rounded transition-colors ${detailMonth === i ? "bg-blue-500 text-white" : "text-white/50 hover:text-white hover:bg-white/10"}`}
                >
                  {lbl}
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

          {Object.keys(quantities).length === 0 ? (
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
                        {SHORT_LABELS.map((m, i) => (
                          <th key={i} className={`px-2 py-2.5 text-right text-xs font-semibold min-w-[52px] ${i <= ytdIndex ? "text-white" : "text-white/40"}`}>
                            {m}
                          </th>
                        ))}
                        <th className="px-2 py-2.5 text-right text-xs font-semibold text-blue-300 min-w-[60px] border-l border-white/20">
                          TOTAL
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
                  {Object.entries(activeQuantities)
                    .sort(([a], [b]) => {
                      const keyA = ((name: string) => {
                        const s = displayProductName(name) || ""
                        const firstLetterIdx = s.search(/\p{L}/u)
                        if (firstLetterIdx < 0) return ""
                        const tail = s.slice(firstLetterIdx)
                        // Clave compuesta solo por letras (ignora números, símbolos y espacios)
                        return tail.replace(/[^\p{L}]+/gu, "")
                      })(a)
                      const keyB = ((name: string) => {
                        const s = displayProductName(name) || ""
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
                      const rowTotal = qtArr.reduce((s, v) => s + v, 0)
                      const ov = overrides[name]
                      const totalGS = rowTotal * (ov?.grossSalesUSD || 0)
                      return (
                      <tr key={name} className="hover:bg-white/5 transition-colors">
                          <td className="sticky left-0 bg-slate-800/95 px-3 py-2 text-xs text-white/90 whitespace-nowrap z-10">
                          <div className="flex items-center gap-2">
                            <span>{displayProductName(name)}</span>
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
                              {qtArr.map((v, i) => (
                                <td key={i} className={`px-2 py-2 text-right text-xs tabular-nums ${v > 0 ? "text-white/80 font-medium" : "text-white/25"}`}>
                                  {testMode ? (
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
                                    v > 0 ? v : "-"
                                  )}
                                </td>
                              ))}
                              <td className="px-2 py-2 text-right text-xs font-bold text-white tabular-nums border-l border-white/10">
                                {rowTotal}
                              </td>
                            </>
                          )}
                          {detailMonth === null && (
                            <td className="px-2 py-2 text-right text-xs text-blue-300 tabular-nums font-medium">
                              {totalGS > 0 ? `$${formatNumber(totalGS, "es-AR", { maximumFractionDigits: 0 })}` : "-"}
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
                      {Object.keys(quantities).length} productos
                    </td>
                    {detailMonth !== null ? (
                      <td className="px-2 py-2 text-right text-xs font-bold text-white tabular-nums">
                        {Object.values(activeQuantities).reduce((s, arr) => s + (arr[detailMonth] || 0), 0)}
                      </td>
                    ) : (
                      <>
                        {Array.from({ length: 12 }, (_, i) => (
                          <td key={i} className="px-2 py-2 text-right text-xs font-bold text-white tabular-nums">
                            {Object.values(activeQuantities).reduce((s, arr) => s + (arr[i] || 0), 0) || "-"}
                          </td>
                        ))}
                        <td className="px-2 py-2 text-right text-xs font-bold text-white tabular-nums border-l border-white/10">
                          {Object.values(activeQuantities).reduce(
                            (s, arr) => s + arr.reduce((a, b) => a + b, 0),
                            0
                          )}
                        </td>
                      </>
                    )}
                    {detailMonth === null && (
                      <td className="px-2 py-2 text-right text-xs font-bold text-blue-300 tabular-nums">
                        ${formatNumber(Object.entries(quantities).reduce((s, [name, arr]) => {
                          const gs = overrides[name]?.grossSalesUSD || 0
                          return s + arr.reduce((a, b) => a + b, 0) * gs
                        }, 0), "es-AR", { maximumFractionDigits: 0 })}
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
