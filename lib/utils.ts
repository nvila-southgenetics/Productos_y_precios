import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

export function formatCurrency(amount: number): string {
  // Nota: en este entorno, `Intl.NumberFormat` con `style: 'currency'` para `USD`
  // no está poniendo separadores de miles (ej: 5700 -> "5700 US$").
  // Por eso formateamos como `decimal` (con agrupación) y luego agregamos el sufijo.
  const formatted = new Intl.NumberFormat("es-ES", {
    style: "decimal",
    useGrouping: true,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.abs(amount))

  return amount < 0 ? `(${formatted} US$)` : `${formatted} US$`
}

/** Formatea montos USD como número (sin "US$"). */
export function formatUSDNumber(amount: number): string {
  const formatted = new Intl.NumberFormat("es-ES", {
    style: "decimal",
    useGrouping: true,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.abs(amount))

  return amount < 0 ? `(${formatted})` : `${formatted}`
}

export function formatNumber(
  value: number,
  locale: string = "es-UY",
  options: Intl.NumberFormatOptions = { minimumFractionDigits: 0, maximumFractionDigits: 0 }
): string {
  const formatted = value.toLocaleString(locale, options)
  if (value >= 0) return formatted
  return `(${Math.abs(value).toLocaleString(locale, options)})`
}

export function formatPercentage(value: number): string {
  return `${(value * 100).toFixed(2)}%`
}

/** Clave para ordenar nombres de producto: ignora "[" al inicio (no los elimina del nombre). */
export function productNameSortKey(name: string): string {
  return name.replace(/^\[+/, "").trim()
}

/** Nombre a mostrar para productos en el frontend (alias legibles). */
export function displayProductName(name: string | null | undefined): string {
  const trimmed = (name ?? "").trim()
  return trimmed
}

/** Label visible para usuarios: preferir alias por sobre name. */
export function displayProductLabel(input: {
  name: string | null | undefined
  alias?: string | null | undefined
}): string {
  const alias = (input.alias ?? "").trim()
  if (alias) return alias
  return displayProductName(input.name)
}

/** Label visible a partir de `name` usando un map name→alias. */
export function displayProductLabelFromName(
  name: string | null | undefined,
  aliasByName: Record<string, string | null | undefined> | Map<string, string | null | undefined> | null | undefined
): string {
  const n = displayProductName(name)
  if (!aliasByName || !n) return n
  const alias =
    aliasByName instanceof Map ? (aliasByName.get(n) ?? "") : (aliasByName[n] ?? "")
  return displayProductLabel({ name: n, alias })
}



