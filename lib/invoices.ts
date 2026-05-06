import { format } from "date-fns"
import { supabase } from "@/lib/supabase"

export type InvoicePaymentState =
  | "paid"
  | "not_paid"
  | "in_payment"
  | "partial"
  | "reversed"
  | string

export interface InvoiceRow {
  id: number
  company_id: number | null
  company_name: string | null
  payment_state: InvoicePaymentState | null
  invoice_date: string | null
  invoice_partner_display_name: string | null
  x_studio_pms_en_ficha: string | null
  name: string | null
  created_at: string | null
}

export interface InvoiceMetrics {
  total: number
  paid: number
  notPaid: number
  inPayment: number
  billedAmount: number
  collectedAmount: number
  inProcessAmount: number
}

export interface InvoiceMonthlyPoint {
  month: string
  paid: number
  notPaid: number
  inPayment: number
}

export interface InvoiceCountryMonthAmounts {
  months: string[]
  rows: Array<{
    country: string
    values: Record<string, number>
    total: number
  }>
  totalsByMonth: Record<string, number>
  grandTotal: number
}

export interface InvoiceCountryMonthPercentages {
  months: string[]
  rows: Array<{
    country: string
    values: Record<string, number>
  }>
}

export interface InvoicePageResult {
  rows: InvoiceRow[]
  total: number
}

function normalizeCountryFromCompany(companyName: string | null): string {
  const raw = (companyName ?? "").trim()
  if (!raw) return "Sin país"

  const normalized = raw.toLowerCase()
  if (normalized.includes("uruguay")) return "Uruguay"
  if (normalized.includes("chile")) return "Chile"
  if (normalized.includes("méxico") || normalized.includes("mexico")) return "México"
  if (normalized.includes("colombia")) return "Colombia"
  if (normalized.includes("argentina")) return "Argentina"
  if (normalized.includes("venezuela")) return "Venezuela"
  return "Sin país"
}

function monthKeyFromDate(dateValue: string | null): string | null {
  const date = parseInvoiceDate(dateValue)
  if (!date || Number.isNaN(date.getTime())) return null
  return format(date, "yyyy-MM")
}

function parseInvoiceDate(dateValue: string | null): Date | null {
  if (!dateValue) return null
  const parts = dateValue.split("-").map((part) => Number(part))
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) return null
  const [year, month, day] = parts
  return new Date(year, month - 1, day)
}

async function fetchAllInvoices<T>(selectClause: string): Promise<T[]> {
  const chunkSize = 1000
  let from = 0
  const allRows: T[] = []

  while (true) {
    const { data, error } = await supabase
      .from("invoices")
      .select(selectClause)
      .range(from, from + chunkSize - 1)

    if (error) throw error

    const rows = (data || []) as T[]
    allRows.push(...rows)

    if (rows.length < chunkSize) break
    from += chunkSize
  }

  return allRows
}

export async function getInvoiceMetrics(): Promise<InvoiceMetrics> {
  const data = await fetchAllInvoices<{ payment_state: string | null; total_Amount: number | null }>(
    "payment_state, total_Amount"
  )

  let total = 0
  let paid = 0
  let notPaid = 0
  let inPayment = 0
  let billedAmount = 0
  let collectedAmount = 0
  let inProcessAmount = 0

  for (const row of data) {
    total += 1
    const amount = row.total_Amount ?? 0
    billedAmount += amount

    if (row.payment_state === "paid") {
      paid += 1
      collectedAmount += amount
    }
    if (row.payment_state === "not_paid") {
      notPaid += 1
    }
    if (row.payment_state === "in_payment") {
      inPayment += 1
      inProcessAmount += amount
    }
  }

  return {
    total,
    paid,
    notPaid,
    inPayment,
    billedAmount,
    collectedAmount,
    inProcessAmount,
  }
}

export async function getInvoiceCompanies(): Promise<string[]> {
  const data = await fetchAllInvoices<{ company_name: string | null }>("company_name")
  return Array.from(
    new Set(
      data
        .map((row) => row.company_name?.trim())
        .filter((value): value is string => Boolean(value))
    )
  ).sort((a, b) => a.localeCompare(b))
}

export async function getMonthlyInvoicesSummary(): Promise<InvoiceMonthlyPoint[]> {
  const data = await fetchAllInvoices<{ invoice_date: string | null; payment_state: string | null }>(
    "invoice_date, payment_state"
  )

  const monthly = new Map<string, InvoiceMonthlyPoint>()

  for (const row of data) {
    const date = parseInvoiceDate(row.invoice_date)
    if (!date || Number.isNaN(date.getTime())) continue
    const monthKey = format(date, "yyyy-MM")
    const monthLabel = format(date, "MMM yyyy")

    if (!monthly.has(monthKey)) {
      monthly.set(monthKey, { month: monthLabel, paid: 0, notPaid: 0, inPayment: 0 })
    }

    const point = monthly.get(monthKey)!
    if (row.payment_state === "paid") point.paid += 1
    if (row.payment_state === "not_paid") point.notPaid += 1
    if (row.payment_state === "in_payment") point.inPayment += 1
  }

  return [...monthly.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map((entry) => entry[1])
}

export async function getCountryMonthAmounts(): Promise<InvoiceCountryMonthAmounts> {
  const data = await fetchAllInvoices<{
    invoice_date: string | null
    company_name: string | null
    total_Amount: number | null
  }>("invoice_date, company_name, total_Amount")

  const monthSet = new Set<string>()
  const matrix = new Map<string, Map<string, number>>()

  for (const row of data) {
    const monthKey = monthKeyFromDate(row.invoice_date)
    if (!monthKey) continue

    const country = normalizeCountryFromCompany(row.company_name)
    const amount = row.total_Amount ?? 0

    monthSet.add(monthKey)
    if (!matrix.has(country)) matrix.set(country, new Map<string, number>())
    const monthMap = matrix.get(country)!
    monthMap.set(monthKey, (monthMap.get(monthKey) ?? 0) + amount)
  }

  const months = [...monthSet].sort((a, b) => a.localeCompare(b))
  const totalsByMonth: Record<string, number> = {}
  for (const month of months) totalsByMonth[month] = 0

  const rows = [...matrix.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([country, monthMap]) => {
      const values: Record<string, number> = {}
      let total = 0
      for (const month of months) {
        const value = monthMap.get(month) ?? 0
        values[month] = value
        totalsByMonth[month] += value
        total += value
      }
      return { country, values, total }
    })

  const grandTotal = Object.values(totalsByMonth).reduce((acc, value) => acc + value, 0)

  return {
    months,
    rows,
    totalsByMonth,
    grandTotal,
  }
}

export async function getCountryMonthCollectionPercentages(): Promise<InvoiceCountryMonthPercentages> {
  const data = await fetchAllInvoices<{
    invoice_date: string | null
    company_name: string | null
    payment_state: string | null
    total_Amount: number | null
  }>("invoice_date, company_name, payment_state, total_Amount")

  const monthSet = new Set<string>()
  const billed = new Map<string, Map<string, number>>()
  const collected = new Map<string, Map<string, number>>()

  for (const row of data) {
    const monthKey = monthKeyFromDate(row.invoice_date)
    if (!monthKey) continue

    const country = normalizeCountryFromCompany(row.company_name)
    const amount = row.total_Amount ?? 0

    monthSet.add(monthKey)
    if (!billed.has(country)) billed.set(country, new Map<string, number>())
    if (!collected.has(country)) collected.set(country, new Map<string, number>())

    billed.get(country)!.set(monthKey, (billed.get(country)!.get(monthKey) ?? 0) + amount)
    if (row.payment_state === "paid" || row.payment_state === "in_payment") {
      collected.get(country)!.set(monthKey, (collected.get(country)!.get(monthKey) ?? 0) + amount)
    }
  }

  const months = [...monthSet].sort((a, b) => a.localeCompare(b))
  const countries = Array.from(new Set([...billed.keys(), ...collected.keys()])).sort((a, b) => a.localeCompare(b))

  const rows = countries.map((country) => {
    const values: Record<string, number> = {}
    for (const month of months) {
      const billedAmount = billed.get(country)?.get(month) ?? 0
      const collectedAmount = collected.get(country)?.get(month) ?? 0
      values[month] = billedAmount > 0 ? (collectedAmount / billedAmount) * 100 : 0
    }
    return { country, values }
  })

  return { months, rows }
}

export async function getInvoicesPage(params: {
  page: number
  pageSize: number
  paymentState: "all" | "paid" | "not_paid" | "in_payment"
  companyName: string
  numberQuery?: string
  clientQuery?: string
}): Promise<InvoicePageResult> {
  const from = (params.page - 1) * params.pageSize
  const to = from + params.pageSize - 1

  let query = supabase
    .from("invoices")
    .select(
      "id, company_id, company_name, payment_state, invoice_date, invoice_partner_display_name, x_studio_pms_en_ficha, name, created_at",
      { count: "exact" }
    )
    .order("invoice_date", { ascending: false, nullsFirst: false })
    .range(from, to)

  if (params.paymentState !== "all") {
    query = query.eq("payment_state", params.paymentState)
  }
  if (params.companyName !== "all") {
    query = query.eq("company_name", params.companyName)
  }
  if (params.numberQuery?.trim()) {
    query = query.ilike("name", `%${params.numberQuery.trim()}%`)
  }
  if (params.clientQuery?.trim()) {
    query = query.ilike("invoice_partner_display_name", `%${params.clientQuery.trim()}%`)
  }

  const { data, count, error } = await query
  if (error) throw error

  return {
    rows: (data || []) as InvoiceRow[],
    total: count ?? 0,
  }
}
