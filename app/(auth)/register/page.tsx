"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export default function RegisterPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    supabase.auth.getSession().then(({ data }: { data: { session: unknown } }) => {
      if (cancelled) return
      if (data.session) router.replace("/productos")
    })
    return () => {
      cancelled = true
    }
  }, [router])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      })
      if (error) throw error

      if (data.session) {
        router.replace("/productos")
        return
      }

      setMessage(
        "Cuenta creada. Si tu proyecto requiere confirmación por email, revisá tu correo para activar la cuenta."
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la cuenta")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Crear cuenta</h1>
        <p className="text-sm text-white/70 mt-1">Email y contraseña</p>
      </div>

      {error && (
        <div className="rounded-md border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-md border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          {message}
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-3">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-white/90">Email</label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:border-white/30"
            placeholder="tu@email.com"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-white/90">Contraseña</label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:border-white/30"
            placeholder="mínimo 6 caracteres"
          />
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="w-full bg-white/10 hover:bg-white/20 border border-white/20 text-white"
        >
          {loading ? "Creando..." : "Crear cuenta"}
        </Button>
      </form>

      <div className="text-sm">
        <Link className="text-white/80 hover:text-white underline" href="/login">
          Volver a iniciar sesión
        </Link>
      </div>
    </div>
  )
}

