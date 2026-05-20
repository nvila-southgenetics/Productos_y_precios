"use client"

import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

function ShimmerBar({ className }: { className?: string }) {
  return <div className={cn("rounded-md bg-white/10 animate-pulse", className)} />
}

export function ProductosTableSkeleton({ showReviewColumn = true }: { showReviewColumn?: boolean }) {
  const rows = 10

  return (
    <div className="rounded-lg border border-white/20 overflow-hidden shadow-sm bg-white/10 backdrop-blur-sm">
      <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
        <ShimmerBar className="h-4 w-32" />
        <div className="flex items-center gap-2 text-white/50 text-sm">
          <Loader2 className="h-4 w-4 animate-spin text-white/60" />
          <span>Cargando productos…</span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/20 bg-white/10">
              {showReviewColumn && (
                <th className="h-12 px-4 w-12">
                  <ShimmerBar className="h-4 w-4 mx-auto" />
                </th>
              )}
              <th className="h-12 px-4">
                <ShimmerBar className="h-4 w-24" />
              </th>
              <th className="h-12 px-4">
                <ShimmerBar className="h-4 w-16 ml-auto" />
              </th>
              <th className="h-12 px-4">
                <ShimmerBar className="h-4 w-20 ml-auto" />
              </th>
              <th className="h-12 px-4">
                <ShimmerBar className="h-4 w-14" />
              </th>
              {showReviewColumn && (
                <th className="h-12 px-4 w-24">
                  <ShimmerBar className="h-4 w-12 mx-auto" />
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, i) => (
              <tr
                key={i}
                className="border-b border-white/10"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                {showReviewColumn && (
                  <td className="px-4 py-4">
                    <ShimmerBar className="h-5 w-5 rounded" />
                  </td>
                )}
                <td className="px-4 py-4">
                  <ShimmerBar className="h-4 w-full max-w-[280px]" />
                  <ShimmerBar className="h-3 w-20 mt-2" />
                </td>
                <td className="px-4 py-4">
                  <ShimmerBar className="h-4 w-10 ml-auto" />
                </td>
                <td className="px-4 py-4">
                  <ShimmerBar className="h-4 w-10 ml-auto" />
                </td>
                <td className="px-4 py-4">
                  <div className="flex gap-2">
                    <ShimmerBar className="h-8 w-8 rounded" />
                    <ShimmerBar className="h-8 w-8 rounded" />
                    <ShimmerBar className="h-8 w-8 rounded" />
                  </div>
                </td>
                {showReviewColumn && (
                  <td className="px-4 py-4">
                    <ShimmerBar className="h-5 w-5 rounded mx-auto" />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
