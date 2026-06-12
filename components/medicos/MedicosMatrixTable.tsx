"use client"

import { useMemo, useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import { cn, formatNumber, productNameSortKey } from "@/lib/utils"
import { Select } from "@/components/ui/select"
import {
  MEDICOS_COMPARE_YEARS,
  SIN_INSTITUCION_KEY,
  SIN_MEDICO_KEY,
  SIN_MEDICO_LABEL,
  type MedicoInstitucionSaleRow,
} from "@/lib/supabase-mcp"

interface MedicosMatrixTableProps {
  rows: MedicoInstitucionSaleRow[]
  isLoading?: boolean
  /** Recarga por cambio de filtro: mantiene la tabla visible. */
  isRefreshing?: boolean
  compareMode?: boolean
  onCompareModeChange?: (value: boolean) => void
}

type RowSortMode =
  | "institution_sales"
  | "institution_name"
  | "doctor_sales"
  | "doctor_name"
type ColumnSortMode = "sales_desc" | "name"

const localeEs = "es" as const

function compareInstitutionOrder(
  a: { key: string; label: string },
  b: { key: string; label: string }
): number {
  if (a.key === SIN_INSTITUCION_KEY) return -1
  if (b.key === SIN_INSTITUCION_KEY) return 1
  if (a.key === SIN_MEDICO_KEY) return -1
  if (b.key === SIN_MEDICO_KEY) return 1
  return a.label.localeCompare(b.label, localeEs)
}

type ProductCol = {
  productKey: string
  producto: string
  product_id: string | null
}

type DisplayRow = {
  id: string
  kind: "institution" | "doctor"
  label: string
  medico: string | null
  institucionKey: string | null
  indent: boolean
}

function buildCountMap(rows: MedicoInstitucionSaleRow[], compareMode: boolean) {
  const countMap = new Map<string, number>()
  const productMeta = new Map<string, ProductCol>()

  for (const row of rows) {
    const yearPart = compareMode && row.year != null ? `|${row.year}` : ""
    const pk = `${row.productKey}|${row.institucionKey}|${row.medico}${yearPart}`
    countMap.set(pk, (countMap.get(pk) ?? 0) + row.cantidad)
    if (!productMeta.has(row.productKey)) {
      productMeta.set(row.productKey, {
        productKey: row.productKey,
        producto: row.producto,
        product_id: row.product_id,
      })
    }
  }

  return { countMap, productMeta }
}

function qtyFor(
  countMap: Map<string, number>,
  productKey: string,
  medico: string | null,
  institucionKey: string | null,
  year?: number
): number {
  const yearSuffix = year != null ? `|${year}` : ""
  if (medico && institucionKey) {
    return countMap.get(`${productKey}|${institucionKey}|${medico}${yearSuffix}`) ?? 0
  }
  if (medico && !institucionKey) {
    let total = 0
    const suffix = year != null ? `|${medico}|${year}` : `|${medico}`
    for (const [k, v] of countMap) {
      if (k.startsWith(`${productKey}|`) && k.endsWith(suffix)) total += v
    }
    return total
  }
  if (!medico && institucionKey) {
    let total = 0
    const mid = `|${institucionKey}|`
    for (const [k, v] of countMap) {
      if (!k.startsWith(`${productKey}${mid}`)) continue
      if (year != null) {
        if (k.endsWith(`|${year}`)) total += v
      } else {
        total += v
      }
    }
    return total
  }
  return 0
}

function rowTotal(
  countMap: Map<string, number>,
  productKeys: string[],
  medico: string | null,
  institucionKey: string | null,
  year?: number,
  compareMode = false
): number {
  if (year != null) {
    return productKeys.reduce(
      (sum, pk) => sum + qtyFor(countMap, pk, medico, institucionKey, year),
      0
    )
  }
  if (compareMode) {
    return MEDICOS_COMPARE_YEARS.reduce(
      (sum, y) => sum + rowTotal(countMap, productKeys, medico, institucionKey, y, false),
      0
    )
  }
  return productKeys.reduce(
    (sum, pk) => sum + qtyFor(countMap, pk, medico, institucionKey),
    0
  )
}

/** Suma de un producto en todas las instituciones y médicos (datos filtrados). */
function productGrandTotal(
  countMap: Map<string, number>,
  productKey: string,
  year?: number
): number {
  let total = 0
  const prefix = `${productKey}|`
  for (const [k, v] of countMap) {
    if (!k.startsWith(prefix)) continue
    if (year != null) {
      if (k.endsWith(`|${year}`)) total += v
    } else {
      total += v
    }
  }
  return total
}

function productCombinedTotal(countMap: Map<string, number>, productKey: string): number {
  return MEDICOS_COMPARE_YEARS.reduce(
    (sum, year) => sum + productGrandTotal(countMap, productKey, year),
    0
  )
}

function formatCell(value: number): string {
  if (value === 0) return "—"
  return formatNumber(value, "es-UY")
}

export function MedicosMatrixTable({
  rows,
  isLoading,
  isRefreshing = false,
  compareMode = false,
  onCompareModeChange,
}: MedicosMatrixTableProps) {
  const [rowSortMode, setRowSortMode] = useState<RowSortMode>("institution_sales")
  const [columnSortMode, setColumnSortMode] = useState<ColumnSortMode>("sales_desc")
  const [expandedInstitutions, setExpandedInstitutions] = useState<Set<string>>(new Set())

  const { countMap, productMeta } = useMemo(
    () => buildCountMap(rows, compareMode),
    [rows, compareMode]
  )

  const productKeys = useMemo(() => {
    const keys = [...productMeta.keys()]
    if (columnSortMode === "name") {
      return keys.sort((a, b) => {
        const la = productMeta.get(a)?.producto ?? a
        const lb = productMeta.get(b)?.producto ?? b
        return productNameSortKey(la).localeCompare(productNameSortKey(lb), "es", {
          sensitivity: "base",
        })
      })
    }
    return keys.sort((a, b) => {
      const totalA = compareMode
        ? productCombinedTotal(countMap, a)
        : rows.filter((r) => r.productKey === a).reduce((s, r) => s + r.cantidad, 0)
      const totalB = compareMode
        ? productCombinedTotal(countMap, b)
        : rows.filter((r) => r.productKey === b).reduce((s, r) => s + r.cantidad, 0)
      if (totalB !== totalA) return totalB - totalA
      const la = productMeta.get(a)?.producto ?? a
      const lb = productMeta.get(b)?.producto ?? b
      return productNameSortKey(la).localeCompare(productNameSortKey(lb), "es", {
        sensitivity: "base",
      })
    })
  }, [productMeta, columnSortMode, rows, compareMode, countMap])

  const displayRows: DisplayRow[] = useMemo(() => {
    if (!productKeys.length) return []

    const medicosByInst = new Map<string, Set<string>>()
    const instLabels = new Map<string, string>()

    for (const row of rows) {
      if (!medicosByInst.has(row.institucionKey)) {
        medicosByInst.set(row.institucionKey, new Set())
      }
      medicosByInst.get(row.institucionKey)!.add(row.medico)
      instLabels.set(row.institucionKey, row.institucionLabel)
    }

    const sortByDoctorSales = rowSortMode === "doctor_sales"
    const sortByDoctorName = rowSortMode === "doctor_name"
    const sortByInstSales = rowSortMode === "institution_sales"
    const sortByInstName = rowSortMode === "institution_name"

    if (sortByDoctorSales || sortByDoctorName) {
      const allMedicos = new Set<string>()
      for (const row of rows) allMedicos.add(row.medico)
      return [...allMedicos]
        .map((medico) => ({
          id: `doctor-${medico}`,
          kind: "doctor" as const,
          label: medico,
          medico,
          institucionKey: null,
          indent: false,
          sortTotal: rowTotal(countMap, productKeys, medico, null, undefined, compareMode),
        }))
        .sort((a, b) => {
          if (a.label === SIN_MEDICO_LABEL) return -1
          if (b.label === SIN_MEDICO_LABEL) return 1
          if (sortByDoctorSales && b.sortTotal !== a.sortTotal) {
            return b.sortTotal - a.sortTotal
          }
          return a.label.localeCompare(b.label, localeEs)
        })
        .map(({ sortTotal: _s, ...r }) => r)
    }

    const namedInstKeys = [...instLabels.keys()]
      .filter((k) => k !== SIN_INSTITUCION_KEY && k !== SIN_MEDICO_KEY)
      .sort((a, b) =>
        (instLabels.get(a) ?? a).localeCompare(instLabels.get(b) ?? b, localeEs)
      )

    const institutionKeys = [
      ...(instLabels.has(SIN_MEDICO_KEY) ? [SIN_MEDICO_KEY] : []),
      ...(instLabels.has(SIN_INSTITUCION_KEY) ? [SIN_INSTITUCION_KEY] : []),
      ...namedInstKeys,
    ]

    const institutions = institutionKeys
      .map((key) => ({
        key,
        label: instLabels.get(key) ?? key,
        medicos: [...(medicosByInst.get(key) ?? [])],
        instTotal: rowTotal(countMap, productKeys, null, key, undefined, compareMode),
      }))
      .sort((a, b) => {
        if (sortByInstSales) {
          if (b.instTotal !== a.instTotal) return b.instTotal - a.instTotal
          return compareInstitutionOrder(a, b)
        }
        return compareInstitutionOrder(a, b)
      })

    const out: DisplayRow[] = []
    for (const inst of institutions) {
      const isSinMedicoBucket = inst.key === SIN_MEDICO_KEY
      const expanded = !isSinMedicoBucket && expandedInstitutions.has(inst.key)
      const sortedMedicos = inst.medicos
        .map((medico) => ({
          medico,
          total: rowTotal(countMap, productKeys, medico, inst.key, undefined, compareMode),
        }))
        .sort((a, b) => {
          if (sortByInstSales && b.total !== a.total) return b.total - a.total
          return a.medico.localeCompare(b.medico, localeEs)
        })

      out.push({
        id: `inst-${inst.key}`,
        kind: "institution",
        label: inst.label,
        medico: null,
        institucionKey: inst.key,
        indent: false,
      })
      if (expanded) {
        for (const { medico } of sortedMedicos) {
          out.push({
            id: `doctor-${inst.key}-${medico}`,
            kind: "doctor",
            label: medico,
            medico,
            institucionKey: inst.key,
            indent: true,
          })
        }
      }
    }
    return out
  }, [rows, rowSortMode, productKeys, countMap, expandedInstitutions, compareMode])

  const grandTotals = useMemo(() => {
    if (compareMode) {
      const byProductByYear = productKeys.map((pk) =>
        MEDICOS_COMPARE_YEARS.map((year) => productGrandTotal(countMap, pk, year))
      )
      const byYear = MEDICOS_COMPARE_YEARS.map((year) =>
        productKeys.reduce((sum, pk) => sum + productGrandTotal(countMap, pk, year), 0)
      )
      const total = byYear.reduce((s, n) => s + n, 0)
      return { byProductByYear, byYear, total, byProduct: null as number[] | null }
    }
    const byProduct = productKeys.map((pk) => productGrandTotal(countMap, pk))
    const total = byProduct.reduce((s, n) => s + n, 0)
    return { byProduct, byProductByYear: null as number[][] | null, byYear: null as number[] | null, total }
  }, [countMap, productKeys, compareMode])

  function toggleInstitution(key: string) {
    setExpandedInstitutions((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  if (isLoading) {
    return (
      <p className="text-sm text-white/70 text-center py-12">
        Cargando ventas por médico e institución…
      </p>
    )
  }

  if (!productKeys.length) {
    return (
      <p className="text-sm text-white/70 text-center py-12">
        No hay ventas para los filtros seleccionados.
      </p>
    )
  }

  const selectClass =
    "bg-white/10 border-white/20 text-white text-sm rounded-md px-2 py-1.5 focus:border-white/30"

  return (
    <div className="relative space-y-3">
      {isRefreshing ? (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-start justify-center rounded-lg bg-blue-950/20 pt-6 backdrop-blur-[1px]">
          <p className="rounded-md border border-white/20 bg-blue-950/90 px-3 py-1.5 text-xs text-white/80 shadow-lg">
            Actualizando…
          </p>
        </div>
      ) : null}
      <div
        className={cn(
          "flex flex-wrap items-end justify-center gap-x-6 gap-y-3 rounded-lg border border-white/20 bg-white/5 p-4 text-center sm:text-left transition-opacity duration-200",
          isRefreshing && "opacity-60"
        )}
      >
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-white/70">Orden de filas</label>
          <Select
            value={rowSortMode}
            onChange={(e) => setRowSortMode(e.target.value as RowSortMode)}
            className={cn(selectClass, "min-w-[280px]")}
          >
            <option value="institution_sales" className="bg-blue-900 text-white">
              Institución (más ventas) → médico (más ventas)
            </option>
            <option value="institution_name" className="bg-blue-900 text-white">
              Institución (A-Z) → médico (A-Z)
            </option>
            <option value="doctor_sales" className="bg-blue-900 text-white">
              Médico (más ventas, sin institución)
            </option>
            <option value="doctor_name" className="bg-blue-900 text-white">
              Médico (A-Z, sin institución)
            </option>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-white/70">Orden de columnas</label>
          <Select
            value={columnSortMode}
            onChange={(e) => setColumnSortMode(e.target.value as ColumnSortMode)}
            className={cn(selectClass, "min-w-[240px]")}
          >
            <option value="sales_desc" className="bg-blue-900 text-white">
              Productos: más vendidos primero
            </option>
            <option value="name" className="bg-blue-900 text-white">
              Productos: alfabético (A-Z)
            </option>
          </Select>
        </div>
        {onCompareModeChange ? (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-white/70">Vista</label>
            <button
              type="button"
              aria-pressed={compareMode}
              onClick={() => onCompareModeChange(!compareMode)}
              className={cn(
                "inline-flex h-10 min-w-[240px] items-center justify-center rounded-md border px-3 text-sm font-medium transition-colors",
                "focus:outline-none focus:ring-2 focus:ring-white/30 focus:ring-offset-0",
                compareMode
                  ? "border-cyan-400/60 bg-cyan-500/20 text-cyan-100 hover:bg-cyan-500/25"
                  : cn(selectClass, "hover:bg-white/15")
              )}
            >
              {compareMode ? "Comparar 2025 | 2026" : "Comparar años"}
            </button>
          </div>
        ) : null}
        {compareMode ? (
          <p className="w-full basis-full text-center text-xs text-white/50 sm:w-auto sm:basis-auto sm:pb-1">
            Cada producto muestra unidades en 2025 y 2026 (respeta filtros de compañía, producto, etc.).
          </p>
        ) : null}
        {(rowSortMode === "institution_sales" || rowSortMode === "institution_name") && !compareMode && (
          <p className="w-full basis-full text-center text-xs text-white/50 sm:w-auto sm:basis-auto sm:pb-1">
            Clic en una fila de institución para ver el desglose por médico.
          </p>
        )}
      </div>

      <div
        className={cn(
          "overflow-x-auto rounded-lg border border-white/20 bg-white/5 backdrop-blur-sm transition-opacity duration-200",
          isRefreshing && "opacity-60"
        )}
      >
        <table className="w-full min-w-max border-collapse text-sm">
          <thead>
            {compareMode ? (
              <>
                <tr className="border-b border-white/20 bg-white/10">
                  <th
                    rowSpan={2}
                    className="sticky left-0 z-20 min-w-[200px] border-r border-white/20 bg-blue-950/95 px-3 py-2 text-left font-semibold text-white align-middle"
                  >
                    {rowSortMode === "institution_sales" || rowSortMode === "institution_name"
                      ? "Institución / Médico"
                      : "Médico"}
                  </th>
                  <th
                    colSpan={MEDICOS_COMPARE_YEARS.length}
                    className="border-r border-white/20 bg-blue-950/95 px-2 py-2 text-center font-semibold text-white"
                  >
                    Total
                  </th>
                  {productKeys.map((pk) => {
                    const meta = productMeta.get(pk)
                    return (
                      <th
                        key={pk}
                        colSpan={MEDICOS_COMPARE_YEARS.length}
                        className="min-w-[120px] max-w-[180px] border-r border-white/20 px-2 py-2 text-center font-semibold text-white"
                        title={meta?.producto}
                      >
                        <span className="line-clamp-2 text-xs">{meta?.producto ?? pk}</span>
                      </th>
                    )
                  })}
                </tr>
                <tr className="border-b border-white/20 bg-white/10">
                  {productKeys.length >= 0
                    ? [
                        ...MEDICOS_COMPARE_YEARS.map((year) => (
                          <th
                            key={`total-year-${year}`}
                            className="min-w-[52px] border-r border-white/20 bg-blue-950/90 px-1 py-1 text-center text-[11px] font-medium text-white/80"
                          >
                            {year}
                          </th>
                        )),
                        ...productKeys.flatMap((pk) =>
                          MEDICOS_COMPARE_YEARS.map((year) => (
                            <th
                              key={`${pk}-${year}`}
                              className="min-w-[52px] border-r border-white/20 bg-blue-950/90 px-1 py-1 text-center text-[11px] font-medium text-white/80"
                            >
                              {year}
                            </th>
                          ))
                        ),
                      ]
                    : null}
                </tr>
              </>
            ) : (
              <tr className="border-b border-white/20 bg-white/10">
                <th className="sticky left-0 z-20 min-w-[200px] border-r border-white/20 bg-blue-950/95 px-3 py-2 text-left font-semibold text-white">
                  {rowSortMode === "institution_sales" || rowSortMode === "institution_name"
                    ? "Institución / Médico"
                    : "Médico"}
                </th>
                <th className="min-w-[72px] border-r border-white/20 bg-blue-950/95 px-2 py-2 text-center font-semibold text-white">
                  Total
                </th>
                {productKeys.map((pk) => {
                  const meta = productMeta.get(pk)
                  return (
                    <th
                      key={pk}
                      className="min-w-[88px] max-w-[140px] border-r border-white/20 px-2 py-2 text-center font-semibold text-white"
                      title={meta?.producto}
                    >
                      <span className="line-clamp-2 text-xs">{meta?.producto ?? pk}</span>
                    </th>
                  )
                })}
              </tr>
            )}
          </thead>
          <tbody>
            <tr className="border-b border-white/20 bg-white/15 font-semibold">
              <td className="sticky left-0 z-10 border-r border-white/20 bg-blue-900/95 px-3 py-2 text-white">
                Total
              </td>
              {compareMode && grandTotals.byYear
                ? grandTotals.byYear.map((qty, i) => (
                    <td
                      key={`grand-total-year-${MEDICOS_COMPARE_YEARS[i]}`}
                      className={cn(
                        "border-r border-white/20 bg-blue-900/90 px-2 py-2 text-center text-white",
                        qty === 0 && "text-white/40"
                      )}
                    >
                      {formatCell(qty)}
                    </td>
                  ))
                : (
                    <td
                      className={cn(
                        "border-r border-white/20 bg-blue-900/90 px-2 py-2 text-center text-white",
                        grandTotals.total === 0 && "text-white/40"
                      )}
                    >
                      {formatCell(grandTotals.total)}
                    </td>
                  )}
              {compareMode && grandTotals.byProductByYear
                ? productKeys.flatMap((pk, pi) =>
                    MEDICOS_COMPARE_YEARS.map((year, yi) => {
                      const qty = grandTotals.byProductByYear![pi][yi]
                      return (
                        <td
                          key={`grand-${pk}-${year}`}
                          className={cn(
                            "border-r border-white/10 px-2 py-2 text-center text-white",
                            qty === 0 && "text-white/40"
                          )}
                        >
                          {formatCell(qty)}
                        </td>
                      )
                    })
                  )
                : productKeys.map((pk, i) => (
                    <td
                      key={`grand-${pk}`}
                      className={cn(
                        "border-r border-white/10 px-2 py-2 text-center text-white",
                        grandTotals.byProduct![i] === 0 && "text-white/40"
                      )}
                    >
                      {formatCell(grandTotals.byProduct![i])}
                    </td>
                  ))}
            </tr>
            {displayRows.map((row) => {
              const rowTotalsByYear = compareMode
                ? MEDICOS_COMPARE_YEARS.map((year) =>
                    rowTotal(countMap, productKeys, row.medico, row.institucionKey, year)
                  )
                : null
              const total = compareMode
                ? (rowTotalsByYear?.reduce((s, n) => s + n, 0) ?? 0)
                : rowTotal(countMap, productKeys, row.medico, row.institucionKey, undefined, compareMode)
              const isInstRow = row.kind === "institution"
              const instKey = row.institucionKey
              const isSinMedicoBucket = instKey === SIN_MEDICO_KEY
              const canExpandInst = isInstRow && instKey && !isSinMedicoBucket
              const expanded = instKey ? expandedInstitutions.has(instKey) : false

              return (
                <tr
                  key={row.id}
                  className={cn(
                    "border-b border-white/10 hover:bg-white/5",
                    canExpandInst && "bg-white/5 cursor-pointer",
                    isSinMedicoBucket && "bg-white/5"
                  )}
                  onClick={
                    canExpandInst ? () => toggleInstitution(instKey) : undefined
                  }
                  role={canExpandInst ? "button" : undefined}
                  tabIndex={canExpandInst ? 0 : undefined}
                  onKeyDown={
                    canExpandInst
                      ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault()
                            toggleInstitution(instKey)
                          }
                        }
                      : undefined
                  }
                >
                  <td
                    className={cn(
                      "sticky left-0 z-10 border-r border-white/20 bg-blue-950/90 px-3 py-2 font-medium text-white",
                      row.indent && "pl-8"
                    )}
                  >
                    <div className="flex items-center gap-1.5">
                      {canExpandInst ? (
                        expanded ? (
                          <ChevronDown className="h-4 w-4 shrink-0 text-white/70" />
                        ) : (
                          <ChevronRight className="h-4 w-4 shrink-0 text-white/70" />
                        )
                      ) : null}
                      <span className={cn(isInstRow && "font-semibold")}>{row.label}</span>
                    </div>
                  </td>
                  {compareMode && rowTotalsByYear
                    ? rowTotalsByYear.map((qty, i) => (
                        <td
                          key={`${row.id}-total-${MEDICOS_COMPARE_YEARS[i]}`}
                          className={cn(
                            "border-r border-white/20 bg-blue-950/70 px-2 py-2 text-center font-semibold text-white",
                            qty === 0 && "text-white/40"
                          )}
                        >
                          {formatCell(qty)}
                        </td>
                      ))
                    : (
                        <td
                          className={cn(
                            "border-r border-white/20 bg-blue-950/70 px-2 py-2 text-center font-semibold text-white",
                            total === 0 && "text-white/40"
                          )}
                        >
                          {formatCell(total)}
                        </td>
                      )}
                  {compareMode
                    ? productKeys.flatMap((pk) =>
                        MEDICOS_COMPARE_YEARS.map((year) => {
                          const qty = qtyFor(countMap, pk, row.medico, row.institucionKey, year)
                          return (
                            <td
                              key={`${row.id}-${pk}-${year}`}
                              className={cn(
                                "border-r border-white/10 px-2 py-2 text-center text-white/90",
                                qty === 0 && "text-white/40"
                              )}
                            >
                              {formatCell(qty)}
                            </td>
                          )
                        })
                      )
                    : productKeys.map((pk) => {
                        const qty = qtyFor(countMap, pk, row.medico, row.institucionKey)
                        return (
                          <td
                            key={`${row.id}-${pk}`}
                            className={cn(
                              "border-r border-white/10 px-2 py-2 text-center text-white/90",
                              qty === 0 && "text-white/40"
                            )}
                          >
                            {formatCell(qty)}
                          </td>
                        )
                      })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
