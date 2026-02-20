"use client"

import { useState } from "react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import type { MonthlyEvolutionPoint } from "@/lib/supabase-mcp"
import { ProductSearchFilter } from "@/components/dashboard/ProductSearchFilter"

type YearFilter = "both" | "2025" | "2026"

interface MonthlySalesEvolutionChartProps {
  year2025: MonthlyEvolutionPoint[]
  year2026: MonthlyEvolutionPoint[]
  products: string[]
  selectedProduct: string
  onProductChange: (product: string) => void
  isLoading?: boolean
}

export function MonthlySalesEvolutionChart({
  year2025,
  year2026,
  products,
  selectedProduct,
  onProductChange,
  isLoading = false,
}: MonthlySalesEvolutionChartProps) {
  const [yearFilter, setYearFilter] = useState<YearFilter>("both")

  const chartData = year2025.map((p, i) => ({
    mes: p.mesLabel,
    ventas2025: year2025[i]?.cantidad_ventas ?? 0,
    ventas2026: year2026[i]?.cantidad_ventas ?? 0,
  }))

  const hasData =
    chartData.some((d) => d.ventas2025 > 0) || chartData.some((d) => d.ventas2026 > 0)

  if (isLoading) {
    return (
      <div className="rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 p-4 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
          <h3 className="text-lg font-semibold text-white">Evolución mensual de ventas</h3>
          <div className="w-[220px] shrink-0">
            <ProductSearchFilter
              products={products}
              selectedProduct={selectedProduct}
              onProductChange={onProductChange}
              disabled={products.length === 0}
            />
          </div>
        </div>
        <div className="h-[300px] flex items-center justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white" />
        </div>
      </div>
    )
  }

  if (!hasData) {
    return (
      <div className="rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 p-4 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
          <h3 className="text-lg font-semibold text-white">Evolución mensual de ventas</h3>
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-[220px] shrink-0">
              <ProductSearchFilter
                products={products}
                selectedProduct={selectedProduct}
                onProductChange={onProductChange}
                disabled={products.length === 0}
              />
            </div>
            <div className="flex items-center gap-1 rounded-lg bg-white/5 p-1 border border-white/10">
              <button type="button" onClick={() => setYearFilter("both")} className="px-3 py-1.5 text-sm font-medium rounded-md text-white/70 hover:text-white hover:bg-white/10">Ambos</button>
              <button type="button" onClick={() => setYearFilter("2025")} className="px-3 py-1.5 text-sm font-medium rounded-md text-white/70 hover:text-white hover:bg-white/10">2025</button>
              <button type="button" onClick={() => setYearFilter("2026")} className="px-3 py-1.5 text-sm font-medium rounded-md text-white/70 hover:text-white hover:bg-white/10">2026</button>
            </div>
          </div>
        </div>
        <p className="text-sm text-white/60 text-center py-8">No hay datos de ventas para mostrar</p>
      </div>
    )
  }

  const show2025 = yearFilter === "both" || yearFilter === "2025"
  const show2026 = yearFilter === "both" || yearFilter === "2026"

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 p-4 shadow-sm"
    >
      <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
        <h3 className="text-lg font-semibold text-white shrink-0">
          Evolución mensual de ventas
        </h3>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-[220px] shrink-0">
            <ProductSearchFilter
              products={products}
              selectedProduct={selectedProduct}
              onProductChange={onProductChange}
              disabled={isLoading || products.length === 0}
            />
          </div>
          <div className="flex items-center gap-1 rounded-lg bg-white/5 p-1 border border-white/10">
          <button
            type="button"
            onClick={() => setYearFilter("both")}
            className={cn(
              "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
              yearFilter === "both"
                ? "bg-white/20 text-white"
                : "text-white/70 hover:text-white hover:bg-white/10"
            )}
          >
            Ambos
          </button>
          <button
            type="button"
            onClick={() => setYearFilter("2025")}
            className={cn(
              "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
              yearFilter === "2025"
                ? "bg-white/20 text-white"
                : "text-white/70 hover:text-white hover:bg-white/10"
            )}
          >
            2025
          </button>
          <button
            type="button"
            onClick={() => setYearFilter("2026")}
            className={cn(
              "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
              yearFilter === "2026"
                ? "bg-white/20 text-white"
                : "text-white/70 hover:text-white hover:bg-white/10"
            )}
          >
            2026
          </button>
          </div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
          <XAxis
            dataKey="mes"
            tick={{ fontSize: 12, fill: "rgba(255,255,255,0.8)" }}
          />
          <YAxis tick={{ fontSize: 12, fill: "rgba(255,255,255,0.8)" }} />
          <Tooltip
            contentStyle={{
              backgroundColor: "rgba(15, 23, 42, 0.95)",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: "8px",
              padding: "8px 12px",
            }}
            labelStyle={{ fontWeight: 600, color: "rgba(255,255,255,0.9)" }}
            formatter={(value: number | undefined) => [
              (value ?? 0).toLocaleString("es-UY", { minimumFractionDigits: 0, maximumFractionDigits: 0 }),
              "",
            ]}
            labelFormatter={(label) => `Mes: ${label}`}
          />
          <Legend
            wrapperStyle={{ paddingTop: 8 }}
            formatter={(_value, entry) => (
              <span style={{ color: "rgba(255,255,255,0.9)" }}>
                {entry?.dataKey === "ventas2025" ? "2025" : "2026"}
              </span>
            )}
          />
          {show2025 && (
            <Line
              type="monotone"
              dataKey="ventas2025"
              name="ventas2025"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ fill: "#3b82f6", r: 4 }}
              activeDot={{ r: 6 }}
            />
          )}
          {show2026 && (
            <Line
              type="monotone"
              dataKey="ventas2026"
              name="ventas2026"
              stroke="#10b981"
              strokeWidth={2}
              dot={{ fill: "#10b981", r: 4 }}
              activeDot={{ r: 6 }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </motion.div>
  )
}
