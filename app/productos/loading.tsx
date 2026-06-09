import { ProductosTableSkeleton } from "@/components/products/ProductosTableSkeleton"

export default function ProductosLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900">
      <div className="container mx-auto py-8 px-4 max-w-7xl">
        <div className="animate-pulse mb-6">
          <div className="h-10 w-64 bg-white/10 rounded mb-2" />
          <div className="h-5 w-80 bg-white/5 rounded" />
        </div>
        <div className="h-16 bg-white/10 rounded-lg border border-white/20 mb-6 animate-pulse" />
        <ProductosTableSkeleton />
      </div>
    </div>
  )
}
