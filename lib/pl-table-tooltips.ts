import { formatNumber } from "@/lib/utils"
import {
  getCosLineConfig,
  PL_COS_LINES,
  PL_COS_ODOO_LINES,
  sumOdooContableByLineForMonth,
  sumProductCosFromReconciliation,
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
  /** Vista filtro producto «Diferencia»: solo ajustes, no total Odoo. */
  diferenciaOnlyView?: boolean
  cosReconciliation: Partial<
    Record<
      CosCostLineKey,
      {
        hasRealData: boolean
        monthly?: number[]
        diferenciaMonthly?: number[]
        computedMonthly?: number[]
      }
    >
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
  | "carrierCost"
  | "kitCost"
  | "paymentFee"
  | "bloodDraw"
  | "sanitary"
  | "extCourier"
  | "intCourier"
  | "physiciansFees"
  | "salesCommission"
  | "totalCOS"
  | "otherIncome"
  | "grossProfit"
  | "iibb_pct"
  | "iibbAmount"
  | "income_tax_pct"
  | "incomeTax"
  | "netIncome"

const TOOLTIP_LINE_TO_COS: Partial<Record<PlTooltipLine, CosCostLineKey>> = {
  productCost: "product_cost",
  carrierCost: "carrier_cost",
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
  carrierCostUSD: "Carrier Cost",
  kitCostUSD: "Kit Cost",
  paymentFeeUSD: "Payment Fee",
  bloodDrawSampleUSD: "Blood Draw & Sample",
  sanitaryPermitsUSD: "Sanitary Permits",
  externalCourierUSD: "External Courier",
  internalCourierUSD: "Internal Courier",
  physiciansFeesUSD: "Physicians Fees",
  salesCommissionUSD: "Sales Commission",
}

const MAX_DETAIL_LINES = 8

function tooltipFmt(val: number): string {
  if (val === 0) return "0"
  return formatNumber(val, "es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function displayProduct(name: string, aliases: Record<string, string>): string {
  const a = aliases[name]
  return a && a !== name ? `${a} (${name})` : name
}

function joinLines(lines: string[]): string | undefined {
  if (!lines.length) return undefined
  return lines.join("\n")
}

/** Título + mes · modelo (2 líneas para el tooltip visual). */
function tooltipTitle(title: string, monthLabel: string, modelLabel: string): string[] {
  return [title, `${monthLabel} · ${modelLabel}`]
}

function fmtRow(label: string, amount: number, width = 22): string {
  const short =
    label.length > width ? `${label.slice(0, width - 1)}…` : label.padEnd(width, " ")
  return `${short} ${tooltipFmt(amount)}`
}

function appendAmountRows(
  lines: string[],
  items: { label: string; amount: number }[],
  opts?: { max?: number; totalLabel?: string }
): void {
  const max = opts?.max ?? MAX_DETAIL_LINES
  const sorted = items
    .filter((x) => x.amount !== 0)
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
  if (!sorted.length) {
    lines.push("  (sin importes)")
    return
  }
  for (const it of sorted.slice(0, max)) {
    lines.push(`  ${fmtRow(it.label, it.amount, 20)}`)
  }
  if (sorted.length > max) {
    lines.push(`  … +${sorted.length - max} más`)
  }
  if (opts?.totalLabel) {
    const total = sorted.reduce((s, x) => s + x.amount, 0)
    lines.push(`  ${fmtRow(opts.totalLabel, total, 20)}`)
  }
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
    lines.push("  (sin contribuciones)")
    return
  }
  let printed = 0
  for (const it of sorted) {
    if (printed >= MAX_DETAIL_LINES) break
    const extra = it.detail ? `  · ${it.detail}` : ""
    lines.push(`  ${fmtRow(it.label, it.amount, 18)}${extra}`)
    printed++
  }
  const total = sorted.reduce((s, x) => s + x.amount, 0)
  lines.push(`  ${fmtRow(totalLabel, total, 18)}`)
  if (sorted.length > MAX_DETAIL_LINES) {
    lines.push(`  … +${sorted.length - MAX_DETAIL_LINES} más`)
  }
}

const emptyOv = (): OverrideCostShape => ({
  grossSalesUSD: 0,
  commercialDiscountUSD: 0,
  productCostUSD: 0,
  carrierCostUSD: 0,
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
    diferenciaOnlyView = false,
    cosReconciliation,
    companyMonthlyCos,
    resolveSalesCompanies,
    productAliases,
    getMonthSnapshot,
    getTaxSnapshot,
    getLineValue,
  } = config

  const monthHeader = (monthIdx: number, title: string): string[] => {
    const snap = getMonthSnapshot(monthIdx)
    return tooltipTitle(title, monthLabels[monthIdx], snap.modelLabel)
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
    const lines = [...monthHeader(monthIdx, "Unidades"), ""]
    if (snap.isBudget && !testMode) {
      lines.push("Budget (producto × canal):")
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
      appendTopContributions(lines, items, "Total")
    } else {
      lines.push(snap.isReal ? "Ventas por producto:" : "Por producto:")
      const items = Object.entries(snap.quantities).map(([name, arr]) => ({
        label: displayProduct(name, productAliases),
        amount: arr[monthIdx] || 0,
      }))
      appendTopContributions(lines, items, "Total")
    }
    return joinLines(lines)
  }

  const buildGrossSales = (monthIdx: number): string | undefined => {
    const snap = getMonthSnapshot(monthIdx)
    const lines = [...monthHeader(monthIdx, "Gross Sales"), ""]

    if (snap.isBudget && !testMode) {
      lines.push("Budget × precio unitario:")
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
      lines.push("Odoo por producto:")
      const items = Object.entries(snap.odooAmounts).map(([name, arr]) => ({
        label: displayProduct(name, productAliases),
        amount: arr[monthIdx] || 0,
      }))
      appendTopContributions(lines, items)
      return joinLines(lines)
    }

    lines.push("Overrides × unidades:")
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
    const lines = [...monthHeader(monthIdx, label), ""]
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
    const plKey = Object.entries(TOOLTIP_LINE_TO_COS).find(([, v]) => v === cosLine)?.[0]
    const rowTotal = plKey ? getLineValue(plKey as PlTooltipLine, monthIdx) : 0

    if (reconcileCosEnabled && recon?.hasRealData && companyRows.length > 0) {
      lines.push(`Total en fila: ${tooltipFmt(rowTotal)}`)
      lines.push("")
      lines.push("Odoo por compañía:")
      const companyItems = companyRows
        .map((r) => ({ label: r.company, amount: Number(r.amount_usd || 0) }))
        .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
      appendAmountRows(lines, companyItems, { totalLabel: "Subtotal Odoo" })

      const diff = recon.diferenciaMonthly?.[monthIdx] ?? 0
      if (diff !== 0) {
        lines.push("")
        lines.push(`Ajuste Diferencia: ${tooltipFmt(diff)}`)
      }
      return joinLines(lines)
    }

    lines.push(`Total: ${tooltipFmt(rowTotal)}`)
    lines.push("")
    lines.push(snap.isBudget && !testMode ? "Budget × unidad:" : "Overrides × unidades:")
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

    const lines = [...monthHeader(monthIdx, label), ""]
    lines.push(snap.isBudget && !testMode ? "Budget × unidad:" : "Overrides × unidades:")
    appendTopContributions(lines, breakdownOverrideField(snap, monthIdx, field))
    return joinLines(lines)
  }

  const buildSalesRevenue = (monthIdx: number): string | undefined => {
    const gs = getLineValue("grossSales", monthIdx)
    const disc = getLineValue("commercialDiscount", monthIdx)
    const total = getLineValue("salesRevenue", monthIdx)
    return joinLines([
      ...monthHeader(monthIdx, "Sales Revenue"),
      "",
      fmtRow("Gross Sales", gs),
      fmtRow("− Descuento comercial", disc),
      fmtRow("= Total", total),
    ])
  }

  const sumOdooContableForMonth = (monthIdx: number): number => {
    const byLine = sumOdooContableByLineForMonth(
      companyMonthlyCos,
      year,
      monthIdx,
      resolveSalesCompanies()
    )
    let total = 0
    for (const v of byLine.values()) total += v
    return total
  }

  const COS_LINE_KEYS: PlTooltipLine[] = [
    "productCost",
    "carrierCost",
    "kitCost",
    "paymentFee",
    "bloodDraw",
    "sanitary",
    "extCourier",
    "intCourier",
    "physiciansFees",
    "salesCommission",
  ]

  const sumDiferenciaForMonth = (monthIdx: number): number =>
    PL_COS_LINES.reduce(
      (s, c) => s + (cosReconciliation?.[c.line]?.diferenciaMonthly?.[monthIdx] ?? 0),
      0
    )

  const COS_PL_LINE_PARTS: { key: PlTooltipLine; label: string }[] = [
    { key: "productCost", label: "Product Cost" },
    { key: "carrierCost", label: "Carrier Cost" },
    { key: "kitCost", label: "Kit Cost" },
    { key: "paymentFee", label: "Payment Fee" },
    { key: "bloodDraw", label: "Blood Draw" },
    { key: "sanitary", label: "Sanitary" },
    { key: "extCourier", label: "External Courier" },
    { key: "intCourier", label: "Internal Courier" },
    { key: "physiciansFees", label: "Physicians Fees" },
    { key: "salesCommission", label: "Sales Commission" },
  ]

  const buildTotalCOS = (monthIdx: number): string | undefined => {
    const lines = [...monthHeader(monthIdx, "Total Cost of Sales"), ""]
    const rowTotal = getLineValue("totalCOS", monthIdx)
    const odooContable = sumOdooContableForMonth(monthIdx)
    const ajuste = sumDiferenciaForMonth(monthIdx)
    const plProductos = sumProductCosFromReconciliation(cosReconciliation, monthIdx)
    const hasOdooContable =
      reconcileCosEnabled && Boolean(cosReconciliation) && odooContable !== 0

    if (diferenciaOnlyView && hasOdooContable) {
      lines.push(`Total ajuste (fila): ${tooltipFmt(rowTotal)}`)
      lines.push("")
      lines.push("Ajuste por línea COS:")
      const ajusteItems = PL_COS_LINES.map(({ line, label }) => ({
        label,
        amount: cosReconciliation?.[line]?.diferenciaMonthly?.[monthIdx] ?? 0,
      }))
      appendAmountRows(lines, ajusteItems, { totalLabel: "Total ajuste" })
      lines.push("")
      lines.push(`Contable Odoo (referencia): ${tooltipFmt(odooContable)}`)
      lines.push(`P&L productos (referencia): ${tooltipFmt(plProductos)}`)
      return joinLines(lines)
    }

    lines.push(`Total en fila: ${tooltipFmt(rowTotal)}`)

    if (hasOdooContable) {
      lines.push("")
      lines.push("Odoo por línea:")
      const odooByLine = sumOdooContableByLineForMonth(
        companyMonthlyCos,
        year,
        monthIdx,
        resolveSalesCompanies()
      )
      const odooItems = PL_COS_ODOO_LINES.map((line) => ({
        label: getCosLineConfig(line).label,
        amount: odooByLine.get(line) || 0,
      }))
      appendAmountRows(lines, odooItems, { totalLabel: "Subtotal Odoo" })

      lines.push("")
      lines.push(`P&L por producto (10 líneas): ${tooltipFmt(plProductos)}`)
      if (plProductos !== odooContable) {
        lines.push("(Incluye líneas sin dato Odoo en el mes.)")
      }

      lines.push("")
      lines.push(`Diferencia (P&L − Odoo): ${tooltipFmt(ajuste)}`)
    } else {
      lines.push("")
      lines.push("Por línea:")
      appendAmountRows(
        lines,
        COS_PL_LINE_PARTS.map((p) => ({
          label: p.label,
          amount: getLineValue(p.key, monthIdx),
        }))
      )
    }
    return joinLines(lines)
  }

  const buildOtherIncome = (monthIdx: number): string | undefined => {
    const total = getLineValue("otherIncome", monthIdx)
    const lines = [...monthHeader(monthIdx, "Other Income"), ""]
    if (total === 0) {
      lines.push("Sin montos en el mes.")
    } else {
      lines.push(`Total: ${tooltipFmt(total)}`)
    }
    return joinLines(lines)
  }

  const buildGrossProfit = (monthIdx: number): string | undefined => {
    const rev = getLineValue("salesRevenue", monthIdx)
    const cos = getLineValue("totalCOS", monthIdx)
    const oi = getLineValue("otherIncome", monthIdx)
    const total = getLineValue("grossProfit", monthIdx)
    const lines = [
      ...monthHeader(monthIdx, "Gross Profit"),
      "",
      fmtRow("Sales Revenue", rev),
      fmtRow("− Cost of Sales", cos),
    ]
    if (oi !== 0) lines.push(fmtRow("+ Other Income", oi))
    lines.push(fmtRow("= Gross Profit", total))
    return joinLines(lines)
  }

  const buildIibbPct = (monthIdx: number): string | undefined => {
    const t = getTaxSnapshot(monthIdx)
    return joinLines([
      ...monthHeader(monthIdx, "IIBB"),
      "",
      `Tasa: ${t.iibb_pct}%`,
      fmtRow("Base (revenue)", t.salesRevenue),
      fmtRow("= Importe", t.iibbAmount),
    ])
  }

  const buildIibbAmount = (monthIdx: number): string | undefined => buildIibbPct(monthIdx)

  const buildIncomeTaxPct = (monthIdx: number): string | undefined => {
    const t = getTaxSnapshot(monthIdx)
    const base = Math.max(0, t.grossProfit - t.totalSGA)
    return joinLines([
      ...monthHeader(monthIdx, "Income tax"),
      "",
      `Tasa: ${t.income_tax_pct}%`,
      fmtRow("Base (GP − SG&A)", base),
      fmtRow("= Importe", t.incomeTax),
    ])
  }

  const buildIncomeTax = (monthIdx: number): string | undefined => buildIncomeTaxPct(monthIdx)

  const buildNetIncome = (monthIdx: number): string | undefined => {
    const t = getTaxSnapshot(monthIdx)
    return joinLines([
      ...monthHeader(monthIdx, "Net Income"),
      "",
      fmtRow("Gross Profit", t.grossProfit),
      fmtRow("− SG&A", t.totalSGA),
      fmtRow("− IIBB", t.iibbAmount),
      fmtRow("− Income tax", t.incomeTax),
      fmtRow("= Net Income", t.netIncome),
    ])
  }

  const buildPeriodHint = (line: PlTooltipLine, monthIndices: number[]): string | undefined => {
    if (!monthIndices.length) return undefined
    const from = monthLabels[monthIndices[0]]
    const to = monthLabels[monthIndices[monthIndices.length - 1]]
    const total = monthIndices.reduce((s, mi) => s + (getLineValue(line, mi) || 0), 0)

    if (
      line === "totalCOS" &&
      reconcileCosEnabled &&
      cosReconciliation &&
      monthIndices.some((mi) => sumOdooContableForMonth(mi) !== 0)
    ) {
      const plProductos = monthIndices.reduce(
        (s, mi) => s + sumProductCosFromReconciliation(cosReconciliation, mi),
        0
      )
      const ajuste = monthIndices.reduce((s, mi) => s + sumDiferenciaForMonth(mi), 0)
      const periodLines = [
        `PERIODO ${from}–${to}`,
        "",
        `Total en fila: ${tooltipFmt(total)}`,
      ]
      if (plProductos !== total) {
        periodLines.push(`P&L por producto: ${tooltipFmt(plProductos)}`)
      }
      if (ajuste !== 0) {
        periodLines.push(`Diferencia (P&L − Odoo): ${tooltipFmt(ajuste)}`)
      }
      periodLines.push("", "Detalle por mes al pasar el mouse.")
      return joinLines(periodLines)
    }

    return joinLines([
      `PERIODO ${from}–${to}`,
      "",
      `Total: ${tooltipFmt(total)}`,
      "",
      "Detalle por mes al pasar el mouse.",
    ])
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
      case "carrierCost":
        return (mi) => buildOverrideLine(mi, "carrierCostUSD")
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
      case "otherIncome":
        return buildOtherIncome
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
