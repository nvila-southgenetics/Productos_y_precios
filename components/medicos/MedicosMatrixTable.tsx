"use client"

import { useMemo, useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import { cn, formatNumber, productNameSortKey } from "@/lib/utils"
import { Select } from "@/components/ui/select"
import {
  SIN_INSTITUCION_KEY,
  type MedicoInstitucionSaleRow,
} from "@/lib/supabase-mcp"

interface MedicosMatrixTableProps {
  rows: MedicoInstitucionSaleRow[]
  isLoading?: boolean
}

type RowSortMode = "institution" | "doctor"
type ColumnSortMode = "sales_desc" | "name"

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

function buildCountMap(rows: MedicoInstitucionSaleRow[]) {
  const countMap = new Map<string, number>()
  const productMeta = new Map<string, ProductCol>()

  for (const row of rows) {
    const pk = `${row.productKey}|${row.institucionKey}|${row.medico}`
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
  institucionKey: string | null
): number {
  if (medico && institucionKey) {
    return countMap.get(`${productKey}|${institucionKey}|${medico}`) ?? 0
  }
  if (medico && !institucionKey) {
    let total = 0
    const suffix = `|${medico}`
    for (const [k, v] of countMap) {
      if (k.startsWith(`${productKey}|`) && k.endsWith(suffix)) total += v
    }
    return total
  }
  if (!medico && institucionKey) {
    let total = 0
    const mid = `|${institucionKey}|`
    for (const [k, v] of countMap) {
      if (k.startsWith(`${productKey}${mid}`)) total += v
    }
    return total
  }
  return 0
}

function rowTotal(
  countMap: Map<string, number>,
  productKeys: string[],
  medico: string | null,
  institucionKey: string | null
): number {
  return productKeys.reduce(
    (sum, pk) => sum + qtyFor(countMap, pk, medico, institucionKey),
    0
  )
}

function formatCell(value: number): string {
  if (value === 0) return "—"
  return formatNumber(value, "es-UY")
}

export function MedicosMatrixTable({ rows, isLoading }: MedicosMatrixTableProps) {
  const [rowSortMode, setRowSortMode] = useState<RowSortMode>("institution")
  const [columnSortMode, setColumnSortMode] = useState<ColumnSortMode>("sales_desc")
  const [expandedInstitutions, setExpandedInstitutions] = useState<Set<string>>(new Set())

  const { countMap, productMeta } = useMemo(() => buildCountMap(rows), [rows])

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
      const totalA = rows
        .filter((r) => r.productKey === a)
        .reduce((s, r) => s + r.cantidad, 0)
      const totalB = rows
        .filter((r) => r.productKey === b)
        .reduce((s, r) => s + r.cantidad, 0)
      if (totalB !== totalA) return totalB - totalA
      const la = productMeta.get(a)?.producto ?? a
      const lb = productMeta.get(b)?.producto ?? b
      return productNameSortKey(la).localeCompare(productNameSortKey(lb), "es", {
        sensitivity: "base",
      })
    })
  }, [productMeta, columnSortMode, rows])

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

    if (rowSortMode === "doctor") {
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
          sortTotal: rowTotal(countMap, productKeys, medico, null),
        }))
        .sort((a, b) => {
          if (b.sortTotal !== a.sortTotal) return b.sortTotal - a.sortTotal
          return a.label.localeCompare(b.label, "es")
        })
        .map(({ sortTotal: _s, ...r }) => r)
    }

    const namedInstKeys = [...instLabels.keys()]
      .filter((k) => k !== SIN_INSTITUCION_KEY)
      .sort((a, b) => (instLabels.get(a) ?? a).localeCompare(instLabels.get(b) ?? b, "es"))

    const institutionKeys = instLabels.has(SIN_INSTITUCION_KEY)
      ? [SIN_INSTITUCION_KEY, ...namedInstKeys]
      : namedInstKeys

    const institutions = institutionKeys
      .map((key) => ({
        key,
        label: instLabels.get(key) ?? key,
        medicos: [...(medicosByInst.get(key) ?? [])],
        instTotal: rowTotal(countMap, productKeys, null, key),
      }))
      .sort((a, b) => {
        if (b.instTotal !== a.instTotal) return b.instTotal - a.instTotal
        return a.label.localeCompare(b.label, "es")
      })

    const out: DisplayRow[] = []
    for (const inst of institutions) {
      const expanded = expandedInstitutions.has(inst.key)
      const sortedMedicos = inst.medicos
        .map((medico) => ({
          medico,
          total: rowTotal(countMap, productKeys, medico, inst.key),
        }))
        .sort((a, b) => {
          if (b.total !== a.total) return b.total - a.total
          return a.medico.localeCompare(b.medico, "es")
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
  }, [rows, rowSortMode, productKeys, countMap, expandedInstitutions])

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
        No hay ventas con médico para los filtros seleccionados.
      </p>
    )
  }

  const selectClass =
    "bg-white/10 border-white/20 text-white text-sm rounded-md px-2 py-1.5 focus:border-white/30"

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-4 rounded-lg border border-white/20 bg-white/5 p-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-white/70">Orden de filas</label>
          <Select
            value={rowSortMode}
            onChange={(e) => setRowSortMode(e.target.value as RowSortMode)}
            className={cn(selectClass, "min-w-[220px]")}
          >
            <option value="institution" className="bg-blue-900 text-white">
              Por institución (más ventas) → médico
            </option>
            <option value="doctor" className="bg-blue-900 text-white">
              Por médico (más ventas, sin institución)
            </option>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-white/70">Orden de columnas</label>
          <Select
            value={columnSortMode}
            onChange={(e) => setColumnSortMode(e.target.value as ColumnSortMode)}
            className={cn(selectClass, "min-w-[200px]")}
          >
            <option value="sales_desc" className="bg-blue-900 text-white">
              Productos más vendidos primero
            </option>
            <option value="name" className="bg-blue-900 text-white">
              Productos por nombre
            </option>
          </Select>
        </div>
        {rowSortMode === "institution" && (
          <p className="text-xs text-white/50 pb-1">
            Clic en una fila de institución para ver el desglose por médico.
          </p>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-white/20 bg-white/5 backdrop-blur-sm">
        <table className="w-full min-w-max border-collapse text-sm">
          <thead>
            <tr className="border-b border-white/20 bg-white/10">
              <th className="sticky left-0 z-20 min-w-[200px] border-r border-white/20 bg-blue-950/95 px-3 py-2 text-left font-semibold text-white">
                {rowSortMode === "institution" ? "Institución / Médico" : "Médico"}
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
          </thead>
          <tbody>
            {displayRows.map((row) => {
              const total = rowTotal(
                countMap,
                productKeys,
                row.medico,
                row.institucionKey
              )
              const isInstRow = row.kind === "institution"
              const instKey = row.institucionKey
              const expanded = instKey ? expandedInstitutions.has(instKey) : false

              return (
                <tr
                  key={row.id}
                  className={cn(
                    "border-b border-white/10 hover:bg-white/5",
                    isInstRow && "bg-white/5 cursor-pointer"
                  )}
                  onClick={
                    isInstRow && instKey
                      ? () => toggleInstitution(instKey)
                      : undefined
                  }
                  role={isInstRow ? "button" : undefined}
                  tabIndex={isInstRow ? 0 : undefined}
                  onKeyDown={
                    isInstRow && instKey
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
                      {isInstRow && instKey ? (
                        expanded ? (
                          <ChevronDown className="h-4 w-4 shrink-0 text-white/70" />
                        ) : (
                          <ChevronRight className="h-4 w-4 shrink-0 text-white/70" />
                        )
                      ) : null}
                      <span className={cn(isInstRow && "font-semibold")}>{row.label}</span>
                    </div>
                  </td>
                  <td
                    className={cn(
                      "border-r border-white/20 bg-blue-950/70 px-2 py-2 text-center font-semibold text-white",
                      total === 0 && "text-white/40"
                    )}
                  >
                    {formatCell(total)}
                  </td>
                  {productKeys.map((pk) => {
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
