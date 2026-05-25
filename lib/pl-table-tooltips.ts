import { formatNumber } from "@/lib/utils"
import {
  getCosLineConfig,
  PL_COS_LINES,
  type CosCostLineKey,
  type MonthlyCosRow,
  type OverrideCostShape,
} from "@/lib/pl-cost-reconciliation"

export type OverrideFieldKey = keyof OverrideCostShape

export type PlMonthSnapshot = {
  modelLabel: string
  isBudget: boolean
  isReal: boolean
  quantities: Record<string, number[]>
  overrides: Record<string, OverrideCostShape>
  odooAmounts: Record<string, number[]>
  budgetRows: Record<string, unknown>[]
  budgetOverrides: Record<string, OverrideCostShape>
  pickBudgetOv: (row: Record<string, unknown>) => OverrideCostShape
}

export type PlTooltipConfig = {
  monthLabels: string[]
  monthKeys: readonly string[]
  year: number
  combineEnabled: boolean
  testMode: boolean
  modelo: "budget" | "real"
  reconcileCosEnabled: boolean
  cosReconciliation: Partial<
    Record<CosCostLineKey, { hasRealData: boolean; diferenciaMonthly?: number[] }>
  > | null
  companyMonthlyCos: MonthlyCosRow[]
  resolveSalesCompanies: () => string[] | null
  productAliases: Record<string, string>
  getMonthSnapshot: (monthIdx: number) => PlMonthSnapshot
  /** Tasas e importes del mes (para impuestos / Net Income). */
  getTaxSnapshot: (monthIdx: number) => {
    iibb_pct: number
    income_tax_pct: number
    salesRevenue: number
    grossProfit: number
    totalSGA: number
    iibbAmount: number
    incomeTax: number
    netIncome: number
  }
  /** Valores ya mergeados por mes (fila visible). */
  getLineValue: (line: PlTooltipLine, monthIdx: number) => number
}

export type PlTooltipLine =
  | "units"
  | "grossSales"
  | "commercialDiscount"
  | "salesRevenue"
  | "productCost"
  | "kitCost"
  | "paymentFee"
  | "bloodDraw"
  | "sanitary"
  | "extCourier"
  | "intCourier"
  | "physiciansFees"
  | "salesCommission"
  | "totalCOS"
  | "grossProfit"
  | "iibb_pct"
  | "iibbAmount"
  | "income_tax_pct"
  | "incomeTax"
  | "netIncome"

const TOOLTIP_LINE_TO_COS: Partial<Record<PlTooltipLine, CosCostLineKey>> = {
  productCost: "product_cost",
  kitCost: "kit_cost",
  paymentFee: "payment_fee",
  bloodDraw: "blood_draw",
  sanitary: "sanitary",
  extCourier: "external_courier",
  intCourier: "internal_courier",
  physiciansFees: "physicians_fees",
  salesCommission: "sales_commission",
}

const OVERRIDE_LABELS: Record<OverrideFieldKey, string> = {
  grossSalesUSD: "Gross Sales",
  commercialDiscountUSD: "Commercial Discount",
  productCostUSD: "Product Cost",
  kitCostUSD: "Kit Cost",
  paymentFeeUSD: "Payment Fee",
  bloodDrawSampleUSD: "Blood Draw & Sample",
  sanitaryPermitsUSD: "Sanitary Permits",
  externalCourierUSD: "External Courier",
  internalCourierUSD: "Internal Courier",
  physiciansFeesUSD: "Physicians Fees",
  salesCommissionUSD: "Sales Commission",
}

const MAX_LINES = 16

function tooltipFmt(val: number): string {
  if (val === 0) return "0"
  return formatNumber(val, "es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function displayProduct(name: string, aliases: Record<string, string>): string {
  const a = aliases[name]
  return a && a !== name ? `${a} (${name})` : name
}

function joinLines(lines: string[]): string | undefined {
  const trimmed = lines.filter(Boolean)
  if (!trimmed.length) return undefined
  return trimmed.join("\n")
}

function appendTopContributions(
  lines: string[],
  items: { label: string; amount: number; detail?: string }[],
  totalLabel = "Total"
): void {
  const sorted = items
    .filter((x) => x.amount !== 0)
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
  if (!sorted.length) {
    lines.push("(sin contribuciones)")
    return
  }
  let printed = 0
  for (const it of sorted) {
    if (printed >= MAX_LINES) break
    const extra = it.detail ? ` — ${it.detail}` : ""
    lines.push(`- ${it.label}: ${tooltipFmt(it.amount)}${extra}`)
    printed++
  }
  const total = sorted.reduce((s, x) => s + x.amount, 0)
  lines.push(`${totalLabel}: ${tooltipFmt(total)}`)
  if (sorted.length > MAX_LINES) lines.push(`(mostrando top ${MAX_LINES})`)
}

const emptyOv = (): OverrideCostShape => ({
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

export function createPlTooltipBuilders(config: PlTooltipConfig) {
  const {
    monthLabels,
    monthKeys,
    year,
    combineEnabled,
    testMode,
    modelo,
    reconcileCosEnabled,
    cosReconciliation,
    companyMonthlyCos,
    resolveSalesCompanies,
    productAliases,
    getMonthSnapshot,
    getTaxSnapshot,
    getLineValue,
  } = config

  const monthHeader = (monthIdx: number, title: string) => {
    const snap = getMonthSnapshot(monthIdx)
    return `${title} — ${monthLabels[monthIdx]} · ${snap.modelLabel}`
  }

  const breakdownOverrideField = (
    snap: PlMonthSnapshot,
    monthIdx: number,
    field: OverrideFieldKey,
    opts?: { excludeProduct?: string }
  ): { label: string; amount: number; detail: string }[] => {
    const items: { label: string; amount: number; detail: string }[] = []
    if (snap.isBudget && !testMode) {
      for (const row of snap.budgetRows) {
        const name = String((row as { product_name?: string }).product_name || "")
        if (!name) continue
        if (opts?.excludeProduct && name === opts.excludeProduct) continue
        const ov = snap.pickBudgetOv(row)
        const units = Number((row as Record<string, unknown>)[monthKeys[monthIdx] as string] || 0)
        const unit = ov[field] ?? 0
        const amount = unit * units
        if (amount === 0) continue
        const channel = String((row as { channel?: string }).channel || "")
        items.push({
          label: displayProduct(name, productAliases),
          amount,
          detail: `${units} u × ${tooltipFmt(unit)}${channel ? ` · ${channel}` : ""}`,
        })
      }
      return items
    }

    for (const [name, qtArr] of Object.entries(snap.quantities)) {
      if (opts?.excludeProduct && name === opts.excludeProduct) continue
      const ov = snap.overrides[name] || emptyOv()
      const units = qtArr[monthIdx] || 0
      const unit = ov[field] ?? 0
      const amount = unit * units
      if (amount === 0) continue
      items.push({
        label: displayProduct(name, productAliases),
        amount,
        detail: `${units} u × ${tooltipFmt(unit)}`,
      })
    }
    return items
  }

  const buildUnits = (monthIdx: number): string | undefined => {
    const snap = getMonthSnapshot(monthIdx)
    const lines = [monthHeader(monthIdx, "Unidades"), "Fuente: unidades del modelo del mes"]
    if (snap.isBudget && !testMode) {
      lines.push("Tabla budget (por producto × canal):")
      const items = snap.budgetRows
        .map((row) => {
          const name = String((row as { product_name?: string }).product_name || "")
          const units = Number((row as Record<string, unknown>)[monthKeys[monthIdx] as string] || 0)
          const channel = String((row as { channel?: string }).channel || "")
          return units
            ? {
                label: displayProduct(name, productAliases),
                amount: units,
                detail: channel || undefined,
              }
            : null
        })
        .filter(Boolean) as { label: string; amount: number; detail?: string }[]
      appendTopContributions(lines, items, "Total unidades")
    } else {
      lines.push(
        snap.isReal
          ? "Ventas reales agregadas por producto (ventas_mensuales_view):"
          : "Cantidades activas por producto:"
      )
      const items = Object.entries(snap.quantities).map(([name, arr]) => ({
        label: displayProduct(name, productAliases),
        amount: arr[monthIdx] || 0,
      }))
      appendTopContributions(lines, items, "Total unidades")
    }
    return joinLines(lines)
  }

  const buildGrossSales = (monthIdx: number): string | undefined => {
    const snap = getMonthSnapshot(monthIdx)
    const lines = [monthHeader(monthIdx, "Gross Sales (sin IVA)")]

    if (snap.isBudget && !testMode) {
      lines.push("Fuente: budget × override grossSalesUSD (product_country_overrides / budget)")
      appendTopContributions(
        lines,
        breakdownOverrideField(snap, monthIdx, "grossSalesUSD").map((x) => ({
          ...x,
          detail: x.detail,
        }))
      )
      return joinLines(lines)
    }

    if (snap.isReal || testMode) {
      lines.push("Fuente: ventas_mensuales_view — monto_total Odoo por producto:")
      const items = Object.entries(snap.odooAmounts).map(([name, arr]) => ({
        label: displayProduct(name, productAliases),
        amount: arr[monthIdx] || 0,
      }))
      appendTopContributions(lines, items)
      return joinLines(lines)
    }

    lines.push("Fuente: overrides × unidades")
    appendTopContributions(lines, breakdownOverrideField(snap, monthIdx, "grossSalesUSD"))
    return joinLines(lines)
  }

  const buildCosContable = (
    monthIdx: number,
    cosLine: CosCostLineKey,
    label: string,
    field: OverrideFieldKey
  ): string | undefined => {
    const snap = getMonthSnapshot(monthIdx)
    const cfg = getCosLineConfig(cosLine)
    const lines = [monthHeader(monthIdx, label)]
    const monthNumber = monthIdx + 1
    const companies = resolveSalesCompanies()
    const companySet =
      companies && companies.length > 0 ? new Set(companies.map((c) => c.trim())) : null

    const companyRows = companyMonthlyCos.filter((r) => {
      if (r.cost_line !== cosLine) return false
      if (r.year !== year || r.month !== monthNumber) return false
      if (companySet && !companySet.has(String(r.company || "").trim())) return false
      return true
    })

    const recon = cosReconciliation?.[cosLine]
    if (reconcileCosEnabled && recon?.hasRealData && companyRows.length > 0) {
      lines.push(`Fuente total: pl_company_monthly_cos · ${cosLine} (contabilidad / Odoo)`)
      const companyItems = companyRows
        .map((r) => ({ label: r.company, amount: Number(r.amount_usd || 0) }))
        .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
      appendTopContributions(lines, companyItems, "Total contable")

      lines.push("Suma por producto (overrides × unidades, sin Diferencia):")
      appendTopContributions(
        lines,
        breakdownOverrideField(snap, monthIdx, field, {
          excludeProduct: cfg.diferenciaName,
        })
      )

      const diff = recon.diferenciaMonthly?.[monthIdx] ?? 0
      if (diff !== 0) {
        lines.push(`${cfg.diferenciaName} (ajuste): ${tooltipFmt(diff)}`)
      }
      const plKey = Object.entries(TOOLTIP_LINE_TO_COS).find(([, v]) => v === cosLine)?.[0]
      if (plKey) {
        lines.push(`Total fila P&L: ${tooltipFmt(getLineValue(plKey as PlTooltipLine, monthIdx))}`)
      }
      return joinLines(lines)
    }

    lines.push(
      snap.isBudget && !testMode
        ? `Fuente: budget × override ${field}`
        : `Fuente: product_country_overrides.${field} × unidades`
    )
    appendTopContributions(lines, breakdownOverrideField(snap, monthIdx, field))
    return joinLines(lines)
  }

  const buildOverrideLine = (monthIdx: number, field: OverrideFieldKey): string | undefined => {
    const label = OVERRIDE_LABELS[field]
    const snap = getMonthSnapshot(monthIdx)
    const cosKeyForField = PL_COS_LINES.find((c) => c.overrideField === field)?.line

    if (cosKeyForField) {
      return buildCosContable(monthIdx, cosKeyForField, label, field)
    }

    const lines = [monthHeader(monthIdx, label)]
    if (snap.isBudget && !testMode) {
      lines.push(`Fuente: budget × override ${field}`)
    } else if (snap.isReal) {
      lines.push(
        `Fuente: product_country_overrides.${field} × unidades (canal Paciente agregado por producto)`
      )
    } else {
      lines.push(`Fuente: overrides × unidades`)
    }
    appendTopContributions(lines, breakdownOverrideField(snap, monthIdx, field))
    return joinLines(lines)
  }

  const buildSalesRevenue = (monthIdx: number): string | undefined => {
    const gs = getLineValue("grossSales", monthIdx)
    const disc = getLineValue("commercialDiscount", monthIdx)
    const total = getLineValue("salesRevenue", monthIdx)
    const lines = [
      monthHeader(monthIdx, "Sales Revenue"),
      "Fórmula: Gross Sales − Commercial Discount",
      `Gross Sales: ${tooltipFmt(gs)}`,
      `Commercial Discount: ${tooltipFmt(disc)}`,
      `Total: ${tooltipFmt(total)}`,
    ]
    return joinLines(lines)
  }

  const buildTotalCOS = (monthIdx: number): string | undefined => {
    const parts: { key: PlTooltipLine; label: string }[] = [
      { key: "productCost", label: "Product Cost" },
      { key: "kitCost", label: "Kit Cost" },
      { key: "paymentFee", label: "Payment Fee" },
      { key: "bloodDraw", label: "Blood Draw" },
      { key: "sanitary", label: "Sanitary Permits" },
      { key: "extCourier", label: "External Courier" },
      { key: "intCourier", label: "Internal Courier" },
      { key: "physiciansFees", label: "Physicians Fees" },
      { key: "salesCommission", label: "Sales Commission" },
    ]
    const lines = [monthHeader(monthIdx, "Total Cost of Sales"), "Suma de líneas COS:"]
    for (const p of parts) {
      const v = getLineValue(p.key, monthIdx)
      if (v !== 0) lines.push(`- ${p.label}: ${tooltipFmt(v)}`)
    }
    lines.push(`Total: ${tooltipFmt(getLineValue("totalCOS", monthIdx))}`)
    lines.push("(Pase el mouse en cada línea COS para detalle por producto)")
    return joinLines(lines)
  }

  const buildGrossProfit = (monthIdx: number): string | undefined => {
    const rev = getLineValue("salesRevenue", monthIdx)
    const cos = getLineValue("totalCOS", monthIdx)
    const lines = [
      monthHeader(monthIdx, "Gross Profit"),
      "Fórmula: Sales Revenue − Total Cost of Sales",
      `Sales Revenue: ${tooltipFmt(rev)}`,
      `Total Cost of Sales: ${tooltipFmt(cos)}`,
      `Total: ${tooltipFmt(getLineValue("grossProfit", monthIdx))}`,
    ]
    return joinLines(lines)
  }

  const buildIibbPct = (monthIdx: number): string | undefined => {
    const t = getTaxSnapshot(monthIdx)
    return joinLines([
      monthHeader(monthIdx, "IIBB — tasa"),
      "Fuente: pl_sga (fila país, product_name y channel vacíos)",
      `Tasa configurada: ${t.iibb_pct}%`,
      `Base: Sales Revenue del mes = ${tooltipFmt(t.salesRevenue)}`,
      `Importe IIBB = base × tasa → ${tooltipFmt(t.iibbAmount)}`,
    ])
  }

  const buildIibbAmount = (monthIdx: number): string | undefined => buildIibbPct(monthIdx)

  const buildIncomeTaxPct = (monthIdx: number): string | undefined => {
    const t = getTaxSnapshot(monthIdx)
    return joinLines([
      monthHeader(monthIdx, "Income tax — tasa"),
      "Fuente: pl_sga (fila país, product_name y channel vacíos)",
      `Tasa configurada: ${t.income_tax_pct}%`,
      `Base: max(0, Gross Profit − SG&A) = ${tooltipFmt(Math.max(0, t.grossProfit - t.totalSGA))}`,
      `Importe = base × tasa → ${tooltipFmt(t.incomeTax)}`,
    ])
  }

  const buildIncomeTax = (monthIdx: number): string | undefined => buildIncomeTaxPct(monthIdx)

  const buildNetIncome = (monthIdx: number): string | undefined => {
    const t = getTaxSnapshot(monthIdx)
    return joinLines([
      monthHeader(monthIdx, "Net Income"),
      "Fórmula: Gross Profit − SG&A − IIBB − Income tax",
      `Gross Profit: ${tooltipFmt(t.grossProfit)}`,
      `SG&A: ${tooltipFmt(t.totalSGA)}`,
      `IIBB: ${tooltipFmt(t.iibbAmount)}`,
      `Income tax: ${tooltipFmt(t.incomeTax)}`,
      `Total: ${tooltipFmt(t.netIncome)}`,
      "(SG&A: pase el mouse en filas SG&A para desglose por producto/canal)",
    ])
  }

  const buildPeriodHint = (line: PlTooltipLine, monthIndices: number[]): string | undefined => {
    if (!monthIndices.length) return undefined
    const from = monthLabels[monthIndices[0]]
    const to = monthLabels[monthIndices[monthIndices.length - 1]]
    const total = monthIndices.reduce((s, mi) => s + (getLineValue(line, mi) || 0), 0)
    return `PERIODO (${from}–${to}): ${tooltipFmt(total)}\nSuma de los meses visibles. Pase el mouse en cada mes para el desglose.`
  }

  const forLine = (line: PlTooltipLine): ((monthIdx: number) => string | undefined) => {
    switch (line) {
      case "units":
        return buildUnits
      case "grossSales":
        return buildGrossSales
      case "commercialDiscount":
        return (mi) => buildOverrideLine(mi, "commercialDiscountUSD")
      case "productCost":
        return (mi) => buildOverrideLine(mi, "productCostUSD")
      case "kitCost":
        return (mi) => buildOverrideLine(mi, "kitCostUSD")
      case "paymentFee":
        return (mi) => buildOverrideLine(mi, "paymentFeeUSD")
      case "bloodDraw":
        return (mi) => buildOverrideLine(mi, "bloodDrawSampleUSD")
      case "sanitary":
        return (mi) => buildOverrideLine(mi, "sanitaryPermitsUSD")
      case "extCourier":
        return (mi) => buildOverrideLine(mi, "externalCourierUSD")
      case "intCourier":
        return (mi) => buildOverrideLine(mi, "internalCourierUSD")
      case "physiciansFees":
        return (mi) => buildOverrideLine(mi, "physiciansFeesUSD")
      case "salesCommission":
        return (mi) => buildOverrideLine(mi, "salesCommissionUSD")
      case "salesRevenue":
        return buildSalesRevenue
      case "totalCOS":
        return buildTotalCOS
      case "grossProfit":
        return buildGrossProfit
      case "iibb_pct":
        return buildIibbPct
      case "iibbAmount":
        return buildIibbAmount
      case "income_tax_pct":
        return buildIncomeTaxPct
      case "incomeTax":
        return buildIncomeTax
      case "netIncome":
        return buildNetIncome
      default:
        return () => undefined
    }
  }

  return { forLine, buildPeriodHint }
}
