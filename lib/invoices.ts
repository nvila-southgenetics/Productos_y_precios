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

export interface InvoicePageResult {
  rows: InvoiceRow[]
  total: number
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
    const date = row.invoice_date ? new Date(row.invoice_date) : null
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
