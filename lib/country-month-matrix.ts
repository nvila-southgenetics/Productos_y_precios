export const YEAR_TOTAL_YEARS = [2025, 2026] as const

export type YearTotalColumnKey = `year:${number}`

export function yearTotalKey(year: number): YearTotalColumnKey {
  return `year:${year}`
}

export function isYearTotalKey(key: string): key is YearTotalColumnKey {
  return key.startsWith("year:")
}

export function isMonthColumnKey(key: string): boolean {
  return /^\d{4}-\d{2}$/.test(key)
}

export function sumMonthsForYear(values: Record<string, number>, year: number): number {
  return Object.entries(values)
    .filter(([key]) => isMonthColumnKey(key) && key.startsWith(`${year}-`))
    .reduce((acc, [, value]) => acc + value, 0)
}

/** Meses ordenados + total anual (2025, 2026) después de cada año. */
export function buildColumnsWithYearTotals(
  months: string[],
  years: readonly number[] = YEAR_TOTAL_YEARS
): string[] {
  const sorted = [...new Set(months)].sort()
  const columns: string[] = []
  const yearsInData = [...new Set(sorted.map((m) => Number(m.slice(0, 4))))].sort((a, b) => a - b)

  for (const year of yearsInData) {
    columns.push(...sorted.filter((m) => m.startsWith(`${year}-`)))
    if (years.includes(year)) {
      columns.push(yearTotalKey(year))
    }
  }

  return columns
}

export function formatMonthHeader(monthKey: string): string {
  const [yearPart, monthPart] = monthKey.split("-")
  const month = Number(monthPart)
  const year = Number(yearPart)
  if (!Number.isFinite(month) || !Number.isFinite(year)) return monthKey
  const date = new Date(year, month - 1, 1)
  const monthLabel = date.toLocaleDateString("es-ES", { month: "short" }).replace(".", "")
  const shortYear = String(year).slice(-2)
  return `${monthLabel.charAt(0).toUpperCase()}${monthLabel.slice(1)}-${shortYear}`
}

export function formatCountryMonthColumnHeader(columnKey: string): string {
  if (isYearTotalKey(columnKey)) {
    return `Total ${columnKey.slice(5)}`
  }
  return formatMonthHeader(columnKey)
}

export function countryMonthColumnHeaderClass(columnKey: string): string {
  return isYearTotalKey(columnKey) ? "bg-blue-100 text-blue-900" : ""
}

export function countryMonthColumnCellClass(columnKey: string): string {
  return isYearTotalKey(columnKey) ? "bg-blue-50 font-semibold" : ""
}

export function appendYearTotalsToAmountMatrix<
  T extends { values: Record<string, number> },
>(params: {
  months: string[]
  rows: T[]
  totalsByMonth: Record<string, number>
  years?: readonly number[]
}): {
  columns: string[]
  rows: T[]
  totalsByMonth: Record<string, number>
} {
  const years = params.years ?? YEAR_TOTAL_YEARS
  const columns = buildColumnsWithYearTotals(params.months, years)
  const totalsByMonth = { ...params.totalsByMonth }

  for (const year of years) {
    totalsByMonth[yearTotalKey(year)] = sumMonthsForYear(totalsByMonth, year)
  }

  const rows = params.rows.map((row) => {
    const values = { ...row.values }
    for (const year of years) {
      values[yearTotalKey(year)] = sumMonthsForYear(values, year)
    }
    return { ...row, values }
  })

  return { columns, rows, totalsByMonth }
}

export function yearCollectionPercentage(
  billedByMonth: Record<string, number>,
  collectedByMonth: Record<string, number>,
  year: number
): { percentage: number; collectedAmount: number } {
  let billed = 0
  let collected = 0
  for (const [month, billedAmount] of Object.entries(billedByMonth)) {
    if (!isMonthColumnKey(month) || !month.startsWith(`${year}-`)) continue
    billed += billedAmount
    collected += collectedByMonth[month] ?? 0
  }
  return {
    percentage: billed > 0 ? (collected / billed) * 100 : 0,
    collectedAmount: collected,
  }
}
