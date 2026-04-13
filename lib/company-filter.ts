/**
 * Construye el parámetro de compañía para consultas (string único, "Todas las compañías" o lista).
 */
export function companyQueryFromSelection(
  companies: string[],
  selected: string[],
  isAdmin: boolean
): string | string[] {
  if (companies.length === 0) return "Todas las compañías"
  const sel = selected.length ? selected : companies
  const allPicked =
    sel.length === companies.length && companies.every((c) => sel.includes(c))
  if (isAdmin && allPicked) return "Todas las compañías"
  if (sel.length === 1) return sel[0]
  return sel
}
