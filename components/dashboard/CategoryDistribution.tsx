"use client"

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts"
import type { DashboardProduct } from "@/lib/supabase-mcp"

interface CategoryDistributionProps {
  products: DashboardProduct[]
  title: string
}

const COLORS = [
  "#3b82f6", // blue
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // purple
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#84cc16", // lime
]

export function CategoryDistribution({
  products,
  title,
}: CategoryDistributionProps) {
  const categoryMap = new Map<string, number>()

  products.forEach((product) => {
    if (product.category) {
      const current = categoryMap.get(product.category) || 0
      categoryMap.set(product.category, current + product.cantidad_ventas)
    }
  })

  const data = Array.from(categoryMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)

  if (data.length === 0) {
    return (
      <div className="rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 p-4 shadow-sm">
        <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>
        <p className="text-sm text-white/60 text-center py-8">No hay datos disponibles</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 p-4 shadow-sm">
      <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) =>
              `${name}: ${((percent || 0) * 100).toFixed(0)}%`
            }
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: "rgba(255,255,255,0.95)",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: "8px",
              padding: "8px 12px",
            }}
            formatter={(value: number) => [
              value.toLocaleString("es-UY"),
              "Ventas",
            ]}
          />
          <Legend
            verticalAlign="bottom"
            height={36}
            formatter={(value) => value}
            wrapperStyle={{ color: "rgba(255,255,255,0.8)" }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
