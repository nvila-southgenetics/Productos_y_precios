import { format } from "date-fns"
import { supabase } from "@/lib/supabase"

export interface PaymentRow {
  id: number
  company_id: number | null
  company_name: string | null
  numero: string | null
  contacto: string | null
  producto: string | null
  total: number | null
  fecha: string | null
  pms_en_ficha: string | null
  pms: string | null
  cb: string | null
  created_at: string | null
}

export interface PaymentMetrics {
  total: number
  totalAmount: number
  withDate: number
  withoutDate: number
}

export interface PaymentMonthlyPoint {
  month: string
  count: number
  amount: number
}

export interface PaymentCountryMonthAmounts {
  months: string[]
  rows: Array<{
    country: string
    values: Record<string, number>
    total: number
  }>
  totalsByMonth: Record<string, number>
  grandTotal: number
}

export interface PaymentPageResult {
  rows: PaymentRow[]
  total: number
}

export const PAYMENTS_MIN_YEAR = 2025

const COMPANY_ID_TO_NAME: Record<number, string> = {
  2: "SouthGenetics LLC Argentina",
  3: "SouthGenetics LLC México",
  4: "SouthGenetics LLC Uruguay",
  5: "SouthGenetics LLC Colombia",
  6: "Southgenetics LLC Chile",
  7: "SouthGenetics LLC Venezuela",
}

function companyNameFromId(companyId: number | null): string | null {
  if (companyId == null) return null
  return COMPANY_ID_TO_NAME[companyId] ?? null
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

function parsePaymentDate(fecha: string | null, producto: string | null): Date | null {
  if (fecha) {
    const parts = fecha.split("-").map((part) => Number(part))
    if (parts.length === 3 && parts.every((part) => Number.isFinite(part))) {
      const [year, month, day] = parts
      return new Date(year, month - 1, day)
    }
  }

  if (!producto) return null

  const spanishMatch = producto.match(/(\d{2})\/(\d{2})\/(\d{4})\s+a\s/i)
  if (spanishMatch) {
    const [, day, month, year] = spanishMatch
    return new Date(Number(year), Number(month) - 1, Number(day))
  }

  const englishMatch = producto.match(/(\d{2})\/(\d{2})\/(\d{4})\s+to\s/i)
  if (englishMatch) {
    const [, month, day, year] = englishMatch
    return new Date(Number(year), Number(month) - 1, Number(day))
  }

  const slashMatch = producto.match(/(\d{2})\/(\d{2})\/(\d{4})/)
  if (slashMatch) {
    const [, day, month, year] = slashMatch
    return new Date(Number(year), Number(month) - 1, Number(day))
  }

  return null
}

function monthKeyFromPayment(fecha: string | null, producto: string | null): string | null {
  const date = parsePaymentDate(fecha, producto)
  if (!date || Number.isNaN(date.getTime())) return null
  if (date.getFullYear() < PAYMENTS_MIN_YEAR) return null
  return format(date, "yyyy-MM")
}

export function isPaymentFromMinYear(fecha: string | null, producto: string | null): boolean {
  const date = parsePaymentDate(fecha, producto)
  if (!date || Number.isNaN(date.getTime())) return false
  return date.getFullYear() >= PAYMENTS_MIN_YEAR
}

async function fetchAllPayments<T>(selectClause: string): Promise<T[]> {
  const chunkSize = 1000
  let from = 0
  const allRows: T[] = []

  while (true) {
    const { data, error } = await supabase
      .from("payments")
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

export async function getPaymentMetrics(): Promise<PaymentMetrics> {
  const data = await fetchAllPayments<{
    fecha: string | null
    producto: string | null
    total: number | null
  }>("fecha, producto, total")

  let totalAmount = 0
  let withDate = 0
  let withoutDate = 0

  for (const row of data) {
    if (!isPaymentFromMinYear(row.fecha, row.producto)) continue

    totalAmount += row.total ?? 0
    if (monthKeyFromPayment(row.fecha, row.producto)) {
      withDate += 1
    } else {
      withoutDate += 1
    }
  }

  const total = withDate + withoutDate

  return {
    total,
    totalAmount,
    withDate,
    withoutDate,
  }
}

export async function getPaymentCompanies(): Promise<Array<{ id: number; name: string }>> {
  return Object.entries(COMPANY_ID_TO_NAME)
    .map(([id, name]) => ({ id: Number(id), name }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function getMonthlyPaymentsSummary(): Promise<PaymentMonthlyPoint[]> {
  const data = await fetchAllPayments<{
    fecha: string | null
    producto: string | null
    total: number | null
  }>("fecha, producto, total")

  const monthly = new Map<string, PaymentMonthlyPoint>()

  for (const row of data) {
    const monthKey = monthKeyFromPayment(row.fecha, row.producto)
    if (!monthKey) continue

    const date = parsePaymentDate(row.fecha, row.producto)
    if (!date) continue
    const monthLabel = format(date, "MMM yyyy")

    if (!monthly.has(monthKey)) {
      monthly.set(monthKey, { month: monthLabel, count: 0, amount: 0 })
    }

    const point = monthly.get(monthKey)!
    point.count += 1
    point.amount += row.total ?? 0
  }

  return [...monthly.entries()]
    .filter(([key]) => key >= `${PAYMENTS_MIN_YEAR}-01`)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map((entry) => entry[1])
}

export async function getPaymentCountryMonthAmounts(): Promise<PaymentCountryMonthAmounts> {
  const data = await fetchAllPayments<{
    fecha: string | null
    producto: string | null
    company_id: number | null
    total: number | null
  }>("fecha, producto, company_id, total")

  const monthSet = new Set<string>()
  const matrix = new Map<string, Map<string, number>>()

  for (const row of data) {
    const monthKey = monthKeyFromPayment(row.fecha, row.producto)
    if (!monthKey) continue

    const country = normalizeCountryFromCompany(companyNameFromId(row.company_id))
    const amount = row.total ?? 0

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

export async function getPaymentsPage(params: {
  page: number
  pageSize: number
  companyId: number | "all"
  numberQuery?: string
  clientQuery?: string
}): Promise<PaymentPageResult> {
  const chunkSize = 1000
  let from = 0
  const filtered: Omit<PaymentRow, "company_name">[] = []

  while (true) {
    let query = supabase
      .from("payments")
      .select("id, company_id, numero, contacto, producto, total, fecha, pms_en_ficha, pms, cb, created_at")
      .order("numero", { ascending: false, nullsFirst: false })
      .range(from, from + chunkSize - 1)

    if (params.companyId !== "all") {
      query = query.eq("company_id", params.companyId)
    }
    if (params.numberQuery?.trim()) {
      query = query.ilike("numero", `%${params.numberQuery.trim()}%`)
    }
    if (params.clientQuery?.trim()) {
      query = query.ilike("contacto", `%${params.clientQuery.trim()}%`)
    }

    const { data, error } = await query
    if (error) throw error

    const rows = (data || []) as Omit<PaymentRow, "company_name">[]
    for (const row of rows) {
      if (isPaymentFromMinYear(row.fecha, row.producto)) {
        filtered.push(row)
      }
    }

    if (rows.length < chunkSize) break
    from += chunkSize
  }

  const pageStart = (params.page - 1) * params.pageSize
  const pageRows = filtered.slice(pageStart, pageStart + params.pageSize).map((row) => ({
    ...row,
    company_name: companyNameFromId(row.company_id),
  }))

  return {
    rows: pageRows,
    total: filtered.length,
  }
}

export function formatPaymentPeriod(fecha: string | null, producto: string | null): string | null {
  const date = parsePaymentDate(fecha, producto)
  if (!date || Number.isNaN(date.getTime())) return null
  return format(date, "dd/MM/yyyy")
}
