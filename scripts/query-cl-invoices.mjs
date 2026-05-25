import fs from "fs"
import path from "path"
import { createClient } from "@supabase/supabase-js"

const envPath = path.join(process.cwd(), ".env.local")
const env = {}
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "")
  }
}

const url = env.NEXT_PUBLIC_SUPABASE_URL
const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (!url || !key) {
  console.error("Missing SUPABASE env")
  process.exit(1)
}

const supabase = createClient(url, key)

function normalizeCountry(companyName) {
  const raw = (companyName ?? "").trim()
  if (!raw) return "Sin país"
  const n = raw.toLowerCase()
  if (n.includes("uruguay")) return "Uruguay"
  if (n.includes("chile")) return "Chile"
  if (n.includes("méxico") || n.includes("mexico")) return "México"
  if (n.includes("colombia")) return "Colombia"
  if (n.includes("argentina")) return "Argentina"
  if (n.includes("venezuela")) return "Venezuela"
  return "Sin país"
}

function monthKey(dateValue) {
  if (!dateValue) return null
  const parts = dateValue.split("-").map(Number)
  if (parts.length !== 3 || parts.some((p) => !Number.isFinite(p))) return null
  return `${String(parts[0]).padStart(4, "0")}-${String(parts[1]).padStart(2, "0")}`
}

const chunkSize = 1000
let from = 0
const all = []

while (true) {
  const { data, error } = await supabase
    .from("invoices")
    .select("invoice_date, company_name, payment_state, total_Amount")
    .range(from, from + chunkSize - 1)

  if (error) {
    console.error("Query error:", error.message)
    process.exit(1)
  }

  const rows = data || []
  all.push(...rows)
  if (rows.length < chunkSize) break
  from += chunkSize
}

const chile = all.filter((r) => normalizeCountry(r.company_name) === "Chile")
const byMonth = new Map()

for (const row of chile) {
  const mk = monthKey(row.invoice_date)
  if (!mk) continue

  if (!byMonth.has(mk)) {
    byMonth.set(mk, {
      billedAmount: 0,
      collectedAmount: 0,
      paidOnlyAmount: 0,
      inProcessAmount: 0,
      totalCount: 0,
      paidCount: 0,
      notPaidCount: 0,
      inPaymentCount: 0,
      otherCount: 0,
      companies: new Set(),
    })
  }

  const b = byMonth.get(mk)
  const amt = row.total_Amount ?? 0
  b.totalCount += 1
  b.billedAmount += amt
  if (row.company_name) b.companies.add(row.company_name)

  if (row.payment_state === "paid") {
    b.paidCount += 1
    b.paidOnlyAmount += amt
    b.collectedAmount += amt
  } else if (row.payment_state === "in_payment") {
    b.inPaymentCount += 1
    b.inProcessAmount += amt
    b.collectedAmount += amt
  } else if (row.payment_state === "not_paid") {
    b.notPaidCount += 1
  } else {
    b.otherCount += 1
  }
}

const summary = [...byMonth.keys()].sort().map((mk) => {
  const b = byMonth.get(mk)
  const pct = b.billedAmount > 0 ? (b.collectedAmount / b.billedAmount) * 100 : 0
  return {
    month: mk,
    facturado_monto: b.billedAmount,
    cobrado_monto_paid_plus_in_payment: b.collectedAmount,
    cobrado_solo_paid: b.paidOnlyAmount,
    en_proceso_monto: b.inProcessAmount,
    pct_app: Math.round(pct * 100) / 100,
    facturas_total: b.totalCount,
    facturas_paid: b.paidCount,
    facturas_in_payment: b.inPaymentCount,
    facturas_not_paid: b.notPaidCount,
    facturas_otros: b.otherCount,
    empresas: [...b.companies],
  }
})

const totals = summary.reduce(
  (acc, s) => {
    acc.facturado_monto += s.facturado_monto
    acc.cobrado_monto += s.cobrado_monto_paid_plus_in_payment
    acc.facturas_total += s.facturas_total
    acc.facturas_paid += s.facturas_paid
    acc.facturas_in_payment += s.facturas_in_payment
    acc.facturas_not_paid += s.facturas_not_paid
    return acc
  },
  {
    facturado_monto: 0,
    cobrado_monto: 0,
    facturas_total: 0,
    facturas_paid: 0,
    facturas_in_payment: 0,
    facturas_not_paid: 0,
  }
)

console.log(
  JSON.stringify(
    {
      total_filas_chile: chile.length,
      filas_sin_fecha_valida: chile.filter((r) => !monthKey(r.invoice_date)).length,
      marzo_2026: summary.find((s) => s.month === "2026-03") || null,
      todos_los_meses_chile: summary,
      totales_chile_historico: {
        ...totals,
        pct:
          totals.facturado_monto > 0
            ? Math.round((totals.cobrado_monto / totals.facturado_monto) * 10000) / 100
            : 0,
      },
    },
    null,
    2
  )
)
