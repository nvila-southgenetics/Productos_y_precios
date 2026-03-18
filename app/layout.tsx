import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Header } from "@/components/layout/Header"
import { ProductCreateDialogProvider } from "@/components/products/ProductCreateDialogProvider"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "SouthGenetics - Profit & Loss",
  description: "Sistema de gestión de Profit & Loss para SouthGenetics",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body className={inter.className}>
        <Header />
        <ProductCreateDialogProvider>{children}</ProductCreateDialogProvider>
      </body>
    </html>
  )
}

