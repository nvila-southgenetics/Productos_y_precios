/**
 * Acceso por hoja/ruta. `allowed_pages` vacío o null = todas las hojas (comportamiento actual).
 */
export const APP_PAGES = [
  { id: "dashboard", href: "/dashboard", label: "Dashboard" },
  { id: "productos", href: "/productos", label: "Productos", prefix: true },
  { id: "pl-import", href: "/pl-import", label: "Real Import" },
  { id: "budget", href: "/budget", label: "Budget" },
  { id: "comparacion", href: "/comparacion", label: "Comparación" },
  { id: "medicos", href: "/medicos", label: "Médicos" },
  { id: "pl", href: "/pl", label: "P&L" },
  { id: "invoices", href: "/invoices", label: "Cobranza", prefix: true },
] as const

export type AppPageId = (typeof APP_PAGES)[number]["id"]

export const ALL_PAGE_IDS: AppPageId[] = APP_PAGES.map((p) => p.id)

export function isFullPageAccess(allowedPages: string[] | null | undefined): boolean {
  return !allowedPages || allowedPages.length === 0
}

export function pathnameToPageId(pathname: string): AppPageId | "admin" | null {
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return "admin"
  for (const page of APP_PAGES) {
    if ("prefix" in page && page.prefix) {
      if (pathname === page.href || pathname.startsWith(`${page.href}/`)) return page.id
    } else if (pathname === page.href) {
      return page.id
    }
  }
  return null
}

export function canAccessPath(
  pathname: string,
  isAdmin: boolean,
  allowedPages: string[] | null | undefined
): boolean {
  if (isAdmin) return true
  const pageId = pathnameToPageId(pathname)
  if (pageId === "admin") return false
  if (!pageId) return true
  if (isFullPageAccess(allowedPages)) return true
  return allowedPages!.includes(pageId)
}

export function resolveHomePath(
  isAdmin: boolean,
  allowedPages: string[] | null | undefined
): string {
  if (isAdmin || isFullPageAccess(allowedPages)) return "/productos"
  const first = APP_PAGES.find((p) => allowedPages!.includes(p.id))
  return first?.href ?? "/productos"
}

export function getNavItems(
  isAdmin: boolean,
  allowedPages: string[] | null | undefined
): { href: string; label: string; id: string }[] {
  const items = APP_PAGES.map((p) => ({ href: p.href, label: p.label, id: p.id }))
  if (isAdmin) {
    return [...items, { href: "/admin", label: "Admin", id: "admin" }]
  }
  if (isFullPageAccess(allowedPages)) return items
  return items.filter((item) => allowedPages!.includes(item.id))
}

export function sanitizeAllowedPages(pages: unknown): AppPageId[] {
  if (!Array.isArray(pages)) return []
  return pages.filter((p): p is AppPageId => ALL_PAGE_IDS.includes(p as AppPageId))
}

export function formatAllowedPagesLabel(allowedPages: string[] | null | undefined): string {
  if (isFullPageAccess(allowedPages)) return "Todas las hojas"
  const labels = APP_PAGES.filter((p) => allowedPages!.includes(p.id)).map((p) => p.label)
  return labels.length ? labels.join(", ") : "Sin hojas"
}
