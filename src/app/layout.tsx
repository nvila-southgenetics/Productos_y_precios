import type { Metadata } from 'next'
import { Inter, Nunito } from 'next/font/google'
import './globals.css'
import { UserPreferencesProvider } from '@/contexts/UserPreferencesContext'

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
})

const nunito = Nunito({ 
  subsets: ['latin'],
  variable: '--font-nunito',
})

export const metadata: Metadata = {
  title: 'SG Contadora',
  description: 'Sistema de gestión contable para productos por país',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" className={`${inter.variable} ${nunito.variable}`}>
      <body className="min-h-screen bg-gradient-to-br from-rose-25 to-pink-50">
        <UserPreferencesProvider>
          {children}
        </UserPreferencesProvider>
      </body>
    </html>
  )
}
