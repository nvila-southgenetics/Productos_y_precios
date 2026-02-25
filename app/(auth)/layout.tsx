"use client"

import type { ReactNode } from "react"

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-r from-blue-900 via-blue-950 to-slate-900">
      <div className="container mx-auto px-4 py-10 max-w-lg">
        <div className="rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 p-6 shadow-sm">
          {children}
        </div>
      </div>
    </div>
  )
}

