"use client"

import { useMemo, useState } from "react"
import { Minus, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatNumber, productNameSortKey } from "@/lib/utils"
import {
  SIN_INSTITUCION_KEY,
  type MedicoInstitucionSaleRow,
} from "@/lib/supabase-mcp"

interface MedicosMatrixTableProps {
  rows: MedicoInstitucionSaleRow[]
  isLoading?: boolean
}

type InstitutionColumn = {
  key: string
  label: string
  medicos: string[]
}

function buildMatrix(rows: MedicoInstitucionSaleRow[]) {
  const countMap = new Map<string, number>()
  const productMeta = new Map<string, { producto: string; product_id: string | null }>()
  const medicosByInst = new Map<string, Set<string>>()
  const instLabels = new Map<string, string>()

  for (const row of rows) {
    const pk = `${row.productKey}|${row.institucionKey}|${row.medico}`
    countMap.set(pk, (countMap.get(pk) ?? 0) + row.cantidad)

    if (!productMeta.has(row.productKey)) {
      productMeta.set(row.productKey, {
        producto: row.producto,
        product_id: row.product_id,
      })
    }

    if (!medicosByInst.has(row.institucionKey)) {
      medicosByInst.set(row.institucionKey, new Set())
    }
    medicosByInst.get(row.institucionKey)!.add(row.medico)
    instLabels.set(row.institucionKey, row.institucionLabel)
  }

  const namedInstKeys = [...instLabels.keys()]
    .filter((k) => k !== SIN_INSTITUCION_KEY)
    .sort((a, b) => (instLabels.get(a) ?? a).localeCompare(instLabels.get(b) ?? b, 'es'))

  const institutionKeys = instLabels.has(SIN_INSTITUCION_KEY)
    ? [...namedInstKeys, SIN_INSTITUCION_KEY]
    : namedInstKeys

  const institutions: InstitutionColumn[] = institutionKeys.map((key) => ({
    key,
    label: instLabels.get(key) ?? key,
    medicos: [...(medicosByInst.get(key) ?? [])].sort((a, b) => a.localeCompare(b, 'es')),
  }))

  const productKeys = [...productMeta.keys()].sort((a, b) => {
    const la = productMeta.get(a)?.producto ?? a
    const lb = productMeta.get(b)?.producto ?? b
    return productNameSortKey(la).localeCompare(productNameSortKey(lb), 'es', {
      sensitivity: 'base',
    })
  })

  return { countMap, productMeta, institutions, productKeys }
}

function cellCount(
  countMap: Map<string, number>,
  productKey: string,
  instKey: string,
  medico?: string
): number {
  if (medico) {
    return countMap.get(`${productKey}|${instKey}|${medico}`) ?? 0
  }
  let total = 0
  const prefix = `${productKey}|${instKey}|`
  for (const [k, v] of countMap) {
    if (k.startsWith(prefix)) total += v
  }
  return total
}

function formatCell(value: number): string {
  if (value === 0) return '—'
  return formatNumber(value, 'es-UY')
}

export function MedicosMatrixTable({ rows, isLoading }: MedicosMatrixTableProps) {
  const [expandedInstitutions, setExpandedInstitutions] = useState<Set<string>>(new Set())

  const { countMap, productMeta, institutions, productKeys } = useMemo(
    () => buildMatrix(rows),
    [rows]
  )

  const hasExpanded = institutions.some((inst) => expandedInstitutions.has(inst.key))

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
      <p className="text-sm text-white/70 text-center py-12">Cargando ventas por médico e institución…</p>
    )
  }

  if (!productKeys.length) {
    return (
      <p className="text-sm text-white/70 text-center py-12">
        No hay ventas con médico para los filtros seleccionados.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-white/20 bg-white/5 backdrop-blur-sm">
      <table className="w-full min-w-max border-collapse text-sm">
        <thead>
          <tr className="border-b border-white/20 bg-white/10">
            <th
              rowSpan={hasExpanded ? 2 : 1}
              className="sticky left-0 z-20 min-w-[180px] border-r border-white/20 bg-blue-950/95 px-3 py-2 text-left font-semibold text-white"
            >
              Producto
            </th>
            {institutions.map((inst) => {
              const expanded = expandedInstitutions.has(inst.key)
              const colSpan = expanded ? Math.max(inst.medicos.length, 1) : 1
              return (
                <th
                  key={inst.key}
                  colSpan={colSpan}
                  className="border-r border-white/20 px-2 py-2 text-center font-semibold text-white"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span className="truncate max-w-[200px]" title={inst.label}>
                      {inst.label}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-white hover:bg-white/20"
                      onClick={() => toggleInstitution(inst.key)}
                      aria-label={expanded ? `Contraer ${inst.label}` : `Expandir ${inst.label}`}
                    >
                      {expanded ? (
                        <Minus className="h-4 w-4" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </th>
              )
            })}
          </tr>
          {hasExpanded && (
            <tr className="border-b border-white/20 bg-white/10">
              {institutions.map((inst) => {
                const expanded = expandedInstitutions.has(inst.key)
                if (!expanded) {
                  return (
                    <th
                      key={`${inst.key}-collapsed`}
                      className="border-r border-white/20 px-2 py-1 text-xs text-white/60"
                    />
                  )
                }
                if (inst.medicos.length === 0) {
                  return (
                    <th
                      key={`${inst.key}-empty`}
                      className="border-r border-white/20 px-2 py-1 text-xs text-white/60"
                    >
                      —
                    </th>
                  )
                }
                return inst.medicos.map((medico) => (
                  <th
                    key={`${inst.key}-${medico}`}
                    className="min-w-[100px] max-w-[160px] border-r border-white/20 px-2 py-1 text-xs font-medium text-white/90"
                    title={medico}
                  >
                    <span className="line-clamp-2">{medico}</span>
                  </th>
                ))
              })}
            </tr>
          )}
        </thead>
        <tbody>
          {productKeys.map((productKey) => {
            const meta = productMeta.get(productKey)
            return (
              <tr
                key={productKey}
                className="border-b border-white/10 hover:bg-white/5"
              >
                <td className="sticky left-0 z-10 border-r border-white/20 bg-blue-950/90 px-3 py-2 font-medium text-white">
                  {meta?.producto ?? productKey}
                </td>
                {institutions.map((inst) => {
                  const expanded = expandedInstitutions.has(inst.key)
                  if (!expanded) {
                    const total = cellCount(countMap, productKey, inst.key)
                    return (
                      <td
                        key={`${productKey}-${inst.key}-total`}
                        className={cn(
                          'border-r border-white/10 px-2 py-2 text-center text-white/90',
                          total === 0 && 'text-white/40'
                        )}
                      >
                        {formatCell(total)}
                      </td>
                    )
                  }
                  if (inst.medicos.length === 0) {
                    return (
                      <td
                        key={`${productKey}-${inst.key}-empty`}
                        className="border-r border-white/10 px-2 py-2 text-center text-white/40"
                      >
                        —
                      </td>
                    )
                  }
                  return inst.medicos.map((medico) => {
                    const qty = cellCount(countMap, productKey, inst.key, medico)
                    return (
                      <td
                        key={`${productKey}-${inst.key}-${medico}`}
                        className={cn(
                          'border-r border-white/10 px-2 py-2 text-center text-white/90',
                          qty === 0 && 'text-white/40'
                        )}
                      >
                        {formatCell(qty)}
                      </td>
                    )
                  })
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
