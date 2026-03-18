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
  }).format(amount)

  return `${formatted} US$`
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
  const lower = trimmed.toLowerCase()

  // Unificar \"Unity Básico\" (como se guarda en BD) a \"Unity\" en toda la UI
  if (lower === "unity básico" || lower === "unity basico") {
    return "Unity"
  }

  return trimmed
}



