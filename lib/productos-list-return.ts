export const PRODUCTOS_LIST_RETURN_KEY = "productos-list-return"

/** Guarda la URL del listado (path + query) para volver desde el detalle. */
export function saveProductosListReturn(pathWithSearch: string) {
  if (typeof window === "undefined") return
  if (!pathWithSearch.startsWith("/productos")) return
  sessionStorage.setItem(PRODUCTOS_LIST_RETURN_KEY, pathWithSearch)
}

export function getProductosListReturn(): string {
  if (typeof window === "undefined") return "/productos"
  return sessionStorage.getItem(PRODUCTOS_LIST_RETURN_KEY) || "/productos"
}

export function parseProductosReturnTo(returnTo: string | null): string | null {
  if (!returnTo) return null
  try {
    const decoded = decodeURIComponent(returnTo)
    if (decoded.startsWith("/productos")) return decoded
  } catch {
    /* ignore */
  }
  return null
}
