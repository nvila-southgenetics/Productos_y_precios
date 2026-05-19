"use client"

import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { cn, displayProductName } from "@/lib/utils"
import { motion } from "framer-motion"
import type { DashboardProduct } from "@/lib/supabase-mcp"
import { PRODUCT_CATEGORY_COLORS } from "@/lib/product-categories"

interface ProductRankingProps {
  products: DashboardProduct[]
  title: string
  metricLabel: string
  getMetricValue: (product: DashboardProduct) => string | number
  getMetricColor: (product: DashboardProduct, index: number) => string
  iconColor?: string
  emptyMessage?: string
}

export function ProductRanking({
  products,
  title,
  metricLabel,
  getMetricValue,
  getMetricColor,
  iconColor = "text-blue-600",
  emptyMessage = "No hay datos disponibles",
}: ProductRankingProps) {
  if (products.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 p-4 shadow-sm"
      >
        <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>
        <p className="text-sm text-white/60 text-center py-8">{emptyMessage}</p>
      </motion.div>
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
      <div className="space-y-2">
        {products.map((product, index) => (
          <Link
            key={product.producto}
            href={product.product_id ? `/productos/${product.product_id}` : "#"}
            className="flex items-center gap-4 p-3 rounded-lg border border-white/10 hover:border-white/20 hover:bg-white/5 transition-all duration-150 group"
          >
            <div
              className={cn(
                "flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm text-white",
                getMetricColor(product, index)
              )}
            >
              {index + 1}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm text-white group-hover:text-blue-200 transition-colors truncate">
                {displayProductName(product.producto)}
              </p>
              {product.category && (
                <Badge
                  className={cn(
                    "mt-1 text-xs border bg-white/10 text-white/80 border-white/20",
                    PRODUCT_CATEGORY_COLORS[product.category] || PRODUCT_CATEGORY_COLORS["Otros"]
                  )}
                >
                  {product.category}
                </Badge>
              )}
            </div>
            <div className="flex-shrink-0 text-right">
              <p className="font-semibold text-sm text-white">
                {getMetricValue(product)}
              </p>
              <p className="text-xs text-white/60">{metricLabel}</p>
            </div>
          </Link>
        ))}
      </div>
    </motion.div>
  )
}
