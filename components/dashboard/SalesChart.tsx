"use client"

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts"
import { motion } from "framer-motion"
import type { DashboardProduct } from "@/lib/supabase-mcp"

interface SalesChartProps {
  products: DashboardProduct[]
  title: string
  dataKey: keyof DashboardProduct
  color: string
}

export function SalesChart({ products, title, dataKey, color }: SalesChartProps) {
  const data = products.slice(0, 8).map((product) => ({
    name: product.producto.length > 20 
      ? product.producto.substring(0, 20) + "..." 
      : product.producto,
    value: product[dataKey] as number,
    fullName: product.producto,
  }))

  if (data.length === 0) {
    return (
      <div className="rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 p-4 shadow-sm">
        <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>
        <p className="text-sm text-white/60 text-center py-8">No hay datos disponibles</p>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 p-4 shadow-sm"
    >
      <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
          <XAxis
            dataKey="name"
            angle={-45}
            textAnchor="end"
            height={80}
            tick={{ fontSize: 12, fill: "rgba(255,255,255,0.8)" }}
          />
          <YAxis tick={{ fontSize: 12, fill: "rgba(255,255,255,0.8)" }} />
          <Tooltip
            contentStyle={{
              backgroundColor: "rgba(255,255,255,0.95)",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: "8px",
              padding: "8px 12px",
            }}
            labelStyle={{ fontWeight: 600, color: "#1e293b" }}
            formatter={(value: number) => [
              typeof value === "number"
                ? value.toLocaleString("es-UY", {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  })
                : value,
              "",
            ]}
          />
          <Bar dataKey="value" radius={[8, 8, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </motion.div>
  )
}
