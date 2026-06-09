/**
 * Detecta médicos posiblemente duplicados en ventas y genera Excel.
 * Uso: node scripts/find-medico-duplicates.mjs
 * Requiere .env.local con NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (o anon si RLS permite lectura ventas)
 */

import { createClient } from "@supabase/supabase-js"
import * as XLSX from "xlsx"
import { readFileSync, existsSync } from "fs"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")

function loadEnv() {
  for (const f of [".env.local", ".env"]) {
    const p = resolve(root, f)
    if (!existsSync(p)) continue
    for (const line of readFileSync(p, "utf8").split("\n")) {
      const m = line.match(/^([^#=]+)=(.*)$/)
      if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "")
    }
  }
}

loadEnv()

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

function stripAccents(s) {
  return s.normalize("NFD").replace(/\p{M}/gu, "")
}

function normalizeMedico(raw) {
  let s = stripAccents(String(raw || "").trim().toLowerCase())
  s = s.replace(/\b(dr\.?|dra\.?|doctor|doctora|prof\.?|lic\.?)\b/gi, " ")
  s = s.replace(/[^a-z0-9\s]/g, " ")
  s = s.replace(/\s+/g, " ").trim()
  return s
}

const PARTICLES = new Set(["de", "del", "la", "las", "los", "y", "e"])

/** Clave para agrupar: tokens sin partículas, ordenados */
function groupKey(normalized) {
  if (!normalized) return ""
  const tokens = normalized
    .split(" ")
    .filter((t) => t && !PARTICLES.has(t))
  if (tokens.length === 0) return ""
  if (tokens.length === 1) return tokens[0]
  return [...tokens].sort().join(" ")
}

class UnionFind {
  constructor(n) {
    this.parent = Array.from({ length: n }, (_, i) => i)
  }
  find(i) {
    if (this.parent[i] !== i) this.parent[i] = this.find(this.parent[i])
    return this.parent[i]
  }
  union(i, j) {
    const ri = this.find(i)
    const rj = this.find(j)
    if (ri !== rj) this.parent[ri] = rj
  }
}

function levenshtein(a, b) {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  const m = a.length
  const n = b.length
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost)
    }
  }
  return dp[m][n]
}

function similarity(a, b) {
  if (!a || !b) return 0
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return 1
  return 1 - levenshtein(a, b) / maxLen
}

async function fetchMedicos() {
  const pageSize = 1000
  let offset = 0
  const agg = new Map()

  while (true) {
    const { data, error } = await supabase
      .from("ventas")
      .select("medico, quantity")
      .not("medico", "is", null)
      .range(offset, offset + pageSize - 1)

    if (error) throw error
    const batch = data || []
    for (const row of batch) {
      const m = String(row.medico || "").trim()
      if (!m) continue
      const q = Number(row.quantity) || 0
      const prev = agg.get(m) || { ventas: 0, unidades: 0 }
      prev.ventas += 1
      prev.unidades += q
      agg.set(m, prev)
    }
    if (batch.length < pageSize) break
    offset += pageSize
  }

  return [...agg.entries()].map(([medico, stats]) => ({
    medico,
    ventas: stats.ventas,
    unidades: stats.unidades,
    normalized: normalizeMedico(medico),
    groupKey: groupKey(normalizeMedico(medico)),
  }))
}

function tokensSubset(a, b) {
  const ta = new Set(a.normalized.split(" ").filter((t) => t && !PARTICLES.has(t)))
  const tb = new Set(b.normalized.split(" ").filter((t) => t && !PARTICLES.has(t)))
  const inter = [...ta].filter((t) => tb.has(t)).length
  const minSz = Math.min(ta.size, tb.size)
  if (minSz < 2 || inter < minSz) return false
  return inter === minSz
}

function findDuplicateGroups(rows) {
  const index = new Map()
  const eligible = rows.filter((r) => r.normalized && r.normalized.length >= 3)
  eligible.forEach((r, i) => index.set(r.medico, i))

  const uf = new UnionFind(eligible.length)
  const edgeReason = new Map()

  const link = (i, j, reason) => {
    uf.union(i, j)
    const key = [i, j].sort().join("-")
    if (!edgeReason.has(key)) edgeReason.set(key, reason)
  }

  const byGroupKey = new Map()
  for (let i = 0; i < eligible.length; i++) {
    const gk = eligible[i].groupKey
    if (!gk || gk.length < 4) continue
    if (!byGroupKey.has(gk)) byGroupKey.set(gk, [])
    byGroupKey.get(gk).push(i)
  }

  for (const indices of byGroupKey.values()) {
    for (let a = 1; a < indices.length; a++) {
      link(indices[0], indices[a], "Mismas palabras (orden/título distinto)")
    }
  }

  for (let i = 0; i < eligible.length; i++) {
    for (let j = i + 1; j < eligible.length; j++) {
      const a = eligible[i]
      const b = eligible[j]
      if (a.groupKey === b.groupKey && a.groupKey) continue
      if (tokensSubset(a, b)) {
        link(i, j, "Mismos tokens (nombre incompleto vs completo)")
        continue
      }
      const sim = similarity(a.normalized, b.normalized)
      if (sim >= 0.88) {
        link(i, j, `Nombre muy similar (${Math.round(sim * 100)}%)`)
      }
    }
  }

  const clusters = new Map()
  for (let i = 0; i < eligible.length; i++) {
    const root = uf.find(i)
    if (!clusters.has(root)) clusters.set(root, new Set())
    clusters.get(root).add(i)
  }

  const groups = []
  for (const indices of clusters.values()) {
    if (indices.size <= 1) continue
    const variantes = [...indices].map((i) => eligible[i])
    const rawNames = new Set(variantes.map((v) => v.medico))
    if (rawNames.size <= 1) continue

    const reasons = new Set()
    const idxArr = [...indices]
    for (let a = 0; a < idxArr.length; a++) {
      for (let b = a + 1; b < idxArr.length; b++) {
        const key = [idxArr[a], idxArr[b]].sort().join("-")
        if (edgeReason.has(key)) reasons.add(edgeReason.get(key))
      }
    }
    const tipo = reasons.size ? [...reasons].join("; ") : "Varias coincidencias"
    const confianza = [...reasons].some((r) => {
      const m = r.match(/(\d+)%/)
      return m && Number(m[1]) < 95
    })
      ? "Media"
      : "Alta"

    groups.push({
      tipo,
      confianza,
      clave: variantes[0].groupKey || variantes[0].normalized,
      variantes,
    })
  }

  groups.sort((a, b) => {
    const order = { Alta: 0, Media: 1, Baja: 2 }
    return (order[a.confianza] ?? 9) - (order[b.confianza] ?? 9) || b.variantes.length - a.variantes.length
  })

  return groups
}

async function main() {
  console.log("Cargando médicos desde ventas...")
  const rows = await fetchMedicos()
  console.log(`Total nombres distintos: ${rows.length}`)

  const groups = findDuplicateGroups(rows)
  console.log(`Grupos de posibles duplicados: ${groups.length}`)

  const sheetGrupos = []
  let grupoId = 0
  for (const g of groups) {
    grupoId++
    for (const v of g.variantes) {
      sheetGrupos.push({
        Grupo: grupoId,
        Tipo: g.tipo,
        Confianza: g.confianza,
        Clave_detectada: g.clave,
        Nombre_en_ventas: v.medico,
        Nombre_normalizado: v.normalized,
        Registros_venta: v.ventas,
        Unidades: v.unidades,
        Cantidad_variantes: g.variantes.length,
      })
    }
  }

  const sheetTodos = rows
    .sort((a, b) => a.medico.localeCompare(b.medico, "es"))
    .map((r) => ({
      Nombre_en_ventas: r.medico,
      Nombre_normalizado: r.normalized,
      Clave_agrupacion: r.groupKey,
      Registros_venta: r.ventas,
      Unidades: r.unidades,
    }))

  const sheetResumen = [
    { Metrica: "Total nombres distintos en ventas", Valor: rows.length },
    { Metrica: "Grupos posibles duplicados", Valor: groups.length },
    { Metrica: "Nombres en grupos (variantes)", Valor: groups.reduce((s, g) => s + g.variantes.length, 0) },
    {
      Metrica: "Generado",
      Valor: new Date().toISOString().slice(0, 19).replace("T", " "),
    },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheetResumen), "Resumen")
  XLSX.utils.book_append_sheet(
    wb,
    sheetGrupos.length ? XLSX.utils.json_to_sheet(sheetGrupos) : XLSX.utils.aoa_to_sheet([["Sin duplicados detectados"]]),
    "Posibles_duplicados"
  )
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheetTodos), "Todos_los_medicos")

  const outPath = resolve(root, "exports", "medicos_posibles_duplicados.xlsx")
  XLSX.writeFile(wb, outPath)
  console.log(`Excel guardado: ${outPath}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
