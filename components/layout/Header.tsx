"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

export function Header() {
  const pathname = usePathname()

  const navItems = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/productos", label: "Productos" },
    { href: "/pl-import", label: "P&L Import" },
    { href: "/budget", label: "Budget" },
    { href: "/comparacion", label: "Comparación" },
  ]

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full border-b shadow-sm backdrop-blur-md",
        "bg-gradient-to-r from-blue-900 via-blue-950 to-slate-900 border-white/10"
      )}
    >
      <div className="container mx-auto max-w-7xl flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center space-x-2 group">
            <div className="h-8 w-1 rounded-full bg-gradient-to-b from-blue-400 to-blue-500"></div>
            <span className="text-xl font-bold bg-gradient-to-r from-blue-300 to-blue-400 bg-clip-text text-transparent">
              SouthGenetics P&L
            </span>
          </Link>
          <nav className="flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href || pathname?.startsWith(item.href + "/")
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 relative",
                    isActive
                      ? "bg-white/10 text-white shadow-sm border border-white/20"
                      : "text-white/70 hover:bg-white/5 hover:text-white"
                  )}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </div>
      </div>
    </header>
  )
}

