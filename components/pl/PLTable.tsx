"use client"

import { useEffect, useState, useCallback } from "react"
import { supabase } from "@/lib/supabase"

// ─── Types ────────────────────────────────────────────────────────────────────

interface PLTableProps {
  modelo: "budget" | "real"
  year: number
  country: string
  category: string
  product: string
  channel: string
  canEdit: boolean
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
}

const MONTH_KEYS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"] as const
const MONTH_LABELS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
const SHORT_LABELS = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"]

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
  iibb_pct: 0,
  income_tax_pct: 0,
})

// ─── Formatting helpers ───────────────────────────────────────────────────────

function fmt(val: number): string {
  if (val === 0) return "-"
  return val.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function fmtPct(val: number): string {
  if (val === 0) return "-"
  return `${val.toFixed(1)}%`
}

// Current month index (0-based) for YTD calculation
const NOW_MONTH = new Date().getMonth() // 0-based

// ─── Main component ───────────────────────────────────────────────────────────

export function PLTable({ modelo, year, country, category, product, channel, canEdit }: PLTableProps) {
  const [loading, setLoading] = useState(true)
  // Monthly quantities per product: productName → [jan..dec]
  const [quantities, setQuantities] = useState<Record<string, number[]>>({})
  // Overrides per product: productName → OverrideData
  const [overrides, setOverrides] = useState<Record<string, OverrideData>>({})
  // SGA data per month index (0-11)
  const [sga, setSga] = useState<SGAData[]>(Array.from({ length: 12 }, emptySGA))
  // Editing state
  const [editingCell, setEditingCell] = useState<{ field: keyof SGAData; month: number } | null>(null)
  const [editValue, setEditValue] = useState<string>("")

  // ── Data fetching ─────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      await Promise.all([fetchQuantities(), fetchOverrides(), fetchSGA()])
    } finally {
      setLoading(false)
    }
  }, [modelo, year, country, category, product, channel])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Fetch quantities (budget or real) per product per month
  const fetchQuantities = async () => {
    const qtys: Record<string, number[]> = {}

    if (modelo === "budget") {
      let q = supabase.from("budget").select("product_name, jan,feb,mar,apr,may,jun,jul,aug,sep,oct,nov,dec").eq("year", year)
      if (country !== "all") q = q.eq("country_code", country)
      if (product !== "all") q = q.eq("product_name", product)

      const { data } = await q
      if (!data) return

      // Filter by category if needed
      let allowedProducts: Set<string> | null = null
      if (category !== "all") {
        const { data: prods } = await supabase.from("products").select("name").eq("category", category)
        allowedProducts = new Set(prods?.map((p: { name: string }) => p.name) || [])
      }

      for (const row of data as Record<string, unknown>[]) {
        const name = row.product_name as string
        if (allowedProducts && !allowedProducts.has(name)) continue
        const arr = MONTH_KEYS.map((k) => Number(row[k] || 0))
        if (qtys[name]) {
          // Sum if same product appears in multiple countries (when country=all)
          qtys[name] = qtys[name].map((v, i) => v + arr[i])
        } else {
          qtys[name] = arr
        }
      }
    } else {
      // Real: from ventas_mensuales_view
      const companies = COUNTRY_TO_COMPANIES[country] || []
      if (companies.length === 0) {
        setQuantities({})
        return
      }

      let q = supabase
        .from("ventas_mensuales_view")
        .select("producto, mes, cantidad_ventas")
        .eq("año", year)
        .in("compañia", companies)

      if (product !== "all") q = q.eq("producto", product)

      const { data } = await q
      if (!data) return

      // Filter by category if needed
      let allowedProducts: Set<string> | null = null
      if (category !== "all") {
        const { data: prods } = await supabase.from("products").select("name").eq("category", category)
        allowedProducts = new Set(prods?.map((p: { name: string }) => p.name) || [])
      }

      for (const row of data as { producto: string; mes: number; cantidad_ventas: number }[]) {
        const name = row.producto
        if (allowedProducts && !allowedProducts.has(name)) continue
        if (!qtys[name]) qtys[name] = Array(12).fill(0)
        const mIdx = row.mes - 1
        if (mIdx >= 0 && mIdx < 12) {
          qtys[name][mIdx] += row.cantidad_ventas
        }
      }
    }

    setQuantities(qtys)
  }

  // Fetch cost overrides per product for the selected country + channel
  const fetchOverrides = async () => {
    const ovs: Record<string, OverrideData> = {}

    let q = supabase
      .from("product_country_overrides")
      .select("overrides, product_id")
      .eq("country_code", country)

    if (channel !== "all") {
      q = q.eq("channel", channel)
    }

    const { data: overrideRows } = await q
    if (!overrideRows) return

    // Also fetch product names
    const productIds = overrideRows.map((r: { product_id: string }) => r.product_id).filter(Boolean)
    if (productIds.length === 0) return

    const { data: productRows } = await supabase
      .from("products")
      .select("id, name, category")
      .in("id", productIds)

    const idToName: Record<string, string> = {}
    const idToCategory: Record<string, string> = {}
    for (const p of productRows || []) {
      idToName[p.id] = p.name
      idToCategory[p.id] = p.category || ""
    }

    for (const row of overrideRows as { product_id: string; overrides: Record<string, number> }[]) {
      const name = idToName[row.product_id]
      if (!name) continue
      if (category !== "all" && idToCategory[row.product_id] !== category) continue
      if (product !== "all" && name !== product) continue

      const o = row.overrides || {}
      ovs[name] = {
        grossSalesUSD: o.grossSalesUSD || 0,
        commercialDiscountUSD: o.commercialDiscountUSD || 0,
        productCostUSD: o.productCostUSD || 0,
        kitCostUSD: o.kitCostUSD || 0,
        paymentFeeUSD: o.paymentFeeUSD || 0,
        bloodDrawSampleUSD: o.bloodDrawSampleUSD || 0,
        sanitaryPermitsUSD: o.sanitaryPermitsUSD || 0,
        externalCourierUSD: o.externalCourierUSD || 0,
        internalCourierUSD: o.internalCourierUSD || 0,
        physiciansFeesUSD: o.physiciansFeesUSD || 0,
        salesCommissionUSD: o.salesCommissionUSD || 0,
      }
    }

    setOverrides(ovs)
  }

  // Fetch SG&A from pl_sga table
  const fetchSGA = async () => {
    const { data } = await supabase
      .from("pl_sga")
      .select("*")
      .eq("year", year)
      .eq("country_code", country)

    const sgaArr: SGAData[] = Array.from({ length: 12 }, emptySGA)
    if (data) {
      for (const row of data as (SGAData & { month: number })[]) {
        const idx = row.month - 1
        if (idx >= 0 && idx < 12) {
          sgaArr[idx] = {
            salaries_wages: Number(row.salaries_wages || 0),
            professional_fees: Number(row.professional_fees || 0),
            contracted_services: Number(row.contracted_services || 0),
            travel_lodging_meals: Number(row.travel_lodging_meals || 0),
            rent_expenses: Number(row.rent_expenses || 0),
            advertising_promotion: Number(row.advertising_promotion || 0),
            financial_expenses: Number(row.financial_expenses || 0),
            other_expenses: Number(row.other_expenses || 0),
            iibb_pct: Number(row.iibb_pct || 0),
            income_tax_pct: Number(row.income_tax_pct || 0),
          }
        }
      }
    }
    setSga(sgaArr)
  }

  // ── Computed P&L values ───────────────────────────────────────────────────

  const computeMonthly = (field: keyof OverrideData): number[] => {
    return Array.from({ length: 12 }, (_, mIdx) => {
      let total = 0
      for (const [name, qtArr] of Object.entries(quantities)) {
        const ov = overrides[name] || emptyOverride()
        total += ov[field] * (qtArr[mIdx] || 0)
      }
      return total
    })
  }

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

  const totalCOS = salesRevenue.map(
    (_, i) =>
      productCost[i] + kitCost[i] + paymentFee[i] + bloodDraw[i] + sanitary[i] +
      extCourier[i] + intCourier[i] + physiciansFees[i] + salesCommission[i]
  )
  const grossProfit = salesRevenue.map((v, i) => v - totalCOS[i])

  const sgaMonthly: Record<keyof SGAData, number[]> = {
    salaries_wages: sga.map((s) => s.salaries_wages),
    professional_fees: sga.map((s) => s.professional_fees),
    contracted_services: sga.map((s) => s.contracted_services),
    travel_lodging_meals: sga.map((s) => s.travel_lodging_meals),
    rent_expenses: sga.map((s) => s.rent_expenses),
    advertising_promotion: sga.map((s) => s.advertising_promotion),
    financial_expenses: sga.map((s) => s.financial_expenses),
    other_expenses: sga.map((s) => s.other_expenses),
    iibb_pct: sga.map((s) => s.iibb_pct),
    income_tax_pct: sga.map((s) => s.income_tax_pct),
  }

  const totalSGA = Array.from({ length: 12 }, (_, i) =>
    SGA_FIELDS.reduce((sum, f) => sum + sgaMonthly[f.key][i], 0)
  )

  const iibbAmount = salesRevenue.map((v, i) => v * (sgaMonthly.iibb_pct[i] / 100))
  const incomeTaxBase = grossProfit.map((v, i) => v - totalSGA[i])
  const incomeTax = incomeTaxBase.map((v, i) => Math.max(0, v) * (sgaMonthly.income_tax_pct[i] / 100))
  const netIncome = grossProfit.map((v, i) => v - totalSGA[i] - iibbAmount[i] - incomeTax[i])

  // ── YTD and TOTAL helpers ─────────────────────────────────────────────────

  const ytd = (arr: number[]) => arr.slice(0, NOW_MONTH + 1).reduce((a, b) => a + b, 0)
  const total = (arr: number[]) => arr.reduce((a, b) => a + b, 0)

  // ── SGA editing ───────────────────────────────────────────────────────────

  const startEdit = (field: keyof SGAData, monthIdx: number) => {
    if (!canEdit) return
    setEditingCell({ field, month: monthIdx })
    setEditValue(String(sga[monthIdx][field]))
  }

  const commitEdit = async () => {
    if (!editingCell) return
    const { field, month } = editingCell
    const newVal = parseFloat(editValue) || 0

    const newSga = sga.map((s, i) => (i === month ? { ...s, [field]: newVal } : s))
    setSga(newSga)
    setEditingCell(null)

    // Upsert to pl_sga
    await supabase.from("pl_sga").upsert(
      {
        year,
        country_code: country,
        month: month + 1,
        [field]: newVal,
      },
      { onConflict: "year,country_code,month" }
    )
  }

  const cancelEdit = () => setEditingCell(null)

  // ── Render helpers ────────────────────────────────────────────────────────

  const cellClass = "text-right px-2 py-1.5 text-xs whitespace-nowrap tabular-nums"
  const labelClass = "sticky left-0 bg-slate-800/95 px-3 py-1.5 text-xs text-white/80 whitespace-nowrap z-10 min-w-[220px]"
  const boldLabelClass = "sticky left-0 bg-slate-700/95 px-3 py-1.5 text-xs font-bold text-white whitespace-nowrap z-10 min-w-[220px]"
  const sectionHeaderClass = "sticky left-0 bg-slate-600/95 px-3 py-1 text-xs font-semibold text-white/60 uppercase tracking-wider whitespace-nowrap z-10 min-w-[220px]"

  const renderRow = (
    label: string,
    values: number[],
    opts: { bold?: boolean; section?: boolean; green?: boolean; red?: boolean; indent?: boolean } = {}
  ) => {
    const ytdVal = ytd(values)
    const totalVal = total(values)
    const baseRowClass = opts.section
      ? "bg-slate-600/40 border-t border-white/20"
      : opts.bold
      ? "bg-slate-700/50 border-t border-white/10"
      : "hover:bg-white/5"
    const valueColor = opts.green ? "text-emerald-300" : opts.red ? "text-red-300" : "text-white/80"
    const boldClass = opts.bold || opts.section ? "font-bold text-white" : ""

    return (
      <tr className={`${baseRowClass} transition-colors`}>
        <td className={opts.bold || opts.section ? boldLabelClass : labelClass}>
          {opts.indent ? <span className="ml-4">{label}</span> : label}
        </td>
        {values.map((v, i) => (
          <td key={i} className={`${cellClass} ${valueColor} ${boldClass}`}>
            {fmt(v)}
          </td>
        ))}
        <td className={`${cellClass} ${valueColor} ${boldClass} border-l border-white/10`}>{fmt(ytdVal)}</td>
        <td className={`${cellClass} ${valueColor} ${boldClass}`}>{fmt(totalVal)}</td>
      </tr>
    )
  }

  // Pct config rows (editable)
  const renderPctConfigRow = (field: "iibb_pct" | "income_tax_pct", label: string) => {
    return (
      <tr className="hover:bg-white/5 transition-colors">
        <td className={labelClass}>
          <span className="ml-4 text-white/60 italic text-[11px]">{label}</span>
        </td>
        {sga.map((s, mIdx) => {
          const v = s[field]
          const isEditing = editingCell?.field === field && editingCell.month === mIdx
          return (
            <td
              key={mIdx}
              className={`${cellClass} text-amber-400/70 text-[11px] ${canEdit ? "cursor-pointer hover:bg-white/10" : ""}`}
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
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitEdit()
                    if (e.key === "Escape") cancelEdit()
                  }}
                  autoFocus
                />
              ) : (
                `${v}%`
              )}
            </td>
          )
        })}
        <td className={`${cellClass} text-amber-400/70 text-[11px] border-l border-white/10`}>
          —
        </td>
        <td className={`${cellClass} text-amber-400/70 text-[11px]`}>—</td>
      </tr>
    )
  }

  // ── Loading ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-white/60 text-sm">
        Cargando datos...
      </div>
    )
  }

  const hasData = Object.keys(quantities).length > 0 || Object.keys(overrides).length > 0

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="rounded-lg border border-white/20 bg-slate-800/60 backdrop-blur-sm shadow-xl overflow-hidden">
      {!hasData && modelo === "real" && (
        <div className="px-6 py-3 bg-amber-900/30 border-b border-amber-500/20">
          <p className="text-xs text-amber-300">
            No se encontraron ventas reales para los filtros seleccionados.
          </p>
        </div>
      )}
      {canEdit && (
        <div className="px-6 py-2 bg-white/5 border-b border-white/10">
          <p className="text-xs text-white/50">
            Doble clic en las celdas de SG&A para editar los valores mensuales.
          </p>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-700/80 border-b border-white/20">
              <th className="sticky left-0 bg-slate-700/95 px-3 py-2.5 text-left text-xs font-semibold text-white/70 min-w-[220px] z-20">
                Concepto
              </th>
              {SHORT_LABELS.map((m, i) => (
                <th
                  key={i}
                  className={`px-2 py-2.5 text-right text-xs font-semibold min-w-[72px] ${
                    i <= NOW_MONTH ? "text-white" : "text-white/50"
                  }`}
                >
                  {m}
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
            {/* ─ Revenue ─────────────────────────────────────────────────── */}
            {renderRow("Gross Sales (sin IVA)", grossSales)}
            {renderRow("Commercial Discount", commercialDiscount, { indent: true })}
            {renderRow("Sales Revenue", salesRevenue, { bold: true })}

            {/* ─ Cost of Sales ─────────────────────────────────────────── */}
            <tr className="bg-slate-600/30">
              <td colSpan={15} className={`${sectionHeaderClass} py-1.5`}>
                Cost of Sales
              </td>
            </tr>
            {renderRow("Product Cost", productCost, { indent: true })}
            {renderRow("Kit Cost", kitCost, { indent: true })}
            {renderRow("Payment Fee Costs", paymentFee, { indent: true })}
            {renderRow("Blood Drawn & Sample Handling", bloodDraw, { indent: true })}
            {renderRow("Sanitary Permits to export blood", sanitary, { indent: true })}
            {renderRow("External Courier", extCourier, { indent: true })}
            {renderRow("Internal Courier", intCourier, { indent: true })}
            {renderRow("Physicians Fees", physiciansFees, { indent: true })}
            {renderRow("Sales Commission", salesCommission, { indent: true })}
            {renderRow("Total Cost of Sales", totalCOS, { bold: true })}

            {/* ─ Gross Profit ──────────────────────────────────────────── */}
            {renderRow("Gross Profit", grossProfit, { bold: true, green: true })}

            {/* ─ SG&A ──────────────────────────────────────────────────── */}
            <tr className="bg-slate-600/30">
              <td colSpan={15} className={`${sectionHeaderClass} py-1.5`}>
                SG&A
              </td>
            </tr>
            {SGA_FIELDS.map(({ key, label }) => {
              const values = sgaMonthly[key]
              const ytdVal = ytd(values)
              const totalVal = total(values)
              return (
                <tr key={key} className="hover:bg-white/5 transition-colors">
                  <td className={labelClass}>
                    <span className="ml-4">{label}</span>
                  </td>
                  {values.map((v, mIdx) => {
                    const isEditing = editingCell?.field === key && editingCell.month === mIdx
                    return (
                      <td
                        key={mIdx}
                        className={`${cellClass} text-white/80 ${canEdit ? "cursor-pointer hover:bg-white/10 rounded" : ""}`}
                        onDoubleClick={() => startEdit(key, mIdx)}
                      >
                        {isEditing ? (
                          <input
                            type="number"
                            className="w-16 bg-white/20 text-white text-xs text-right px-1 rounded border border-white/30 focus:outline-none"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={commitEdit}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") commitEdit()
                              if (e.key === "Escape") cancelEdit()
                            }}
                            autoFocus
                          />
                        ) : (
                          fmt(v)
                        )}
                      </td>
                    )
                  })}
                  <td className={`${cellClass} text-white/80 border-l border-white/10`}>{fmt(ytdVal)}</td>
                  <td className={`${cellClass} text-white/80`}>{fmt(totalVal)}</td>
                </tr>
              )
            })}
            {renderRow("SG&A", totalSGA, { bold: true })}

            {/* ─ Taxes ─────────────────────────────────────────────────── */}
            <tr className="bg-slate-600/30">
              <td colSpan={15} className={`${sectionHeaderClass} py-1.5`}>
                Impuestos
              </td>
            </tr>
            {/* IIBB config row (editable %) */}
            {renderPctConfigRow("iibb_pct", "IIBB — tasa (% sobre revenue)")}
            {/* IIBB calculated amount */}
            {renderRow("IIBB (% sobre revenue)", iibbAmount, { indent: true })}
            {/* Income tax config row */}
            {renderPctConfigRow("income_tax_pct", "Income tax — tasa (% sobre ganancia)")}
            {/* Income tax calculated amount */}
            {renderRow("Income tax (% sobre ganancia)", incomeTax, { indent: true })}

            {/* ─ Net Income ────────────────────────────────────────────── */}
            {renderRow(
              "Net Income",
              netIncome,
              { bold: true, green: total(netIncome) >= 0, red: total(netIncome) < 0 }
            )}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 px-4 py-2 bg-white/5 border-t border-white/10">
        <span className="text-xs text-white/40">
          YTD = acumulado hasta {MONTH_LABELS[NOW_MONTH]} {year}
        </span>
        {canEdit && (
          <span className="text-xs text-white/40">
            · Doble clic en celdas de SG&A e Impuestos para editar
          </span>
        )}
      </div>
    </div>
  )
}
