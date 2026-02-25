"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [hasSession, setHasSession] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    supabase.auth.getSession().then(({ data }: { data: { session: unknown } }) => {
      if (cancelled) return
      setHasSession(!!data.session)
      setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setMessage(null)

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.")
      return
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.")
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setMessage("Contraseña actualizada. Ya podés iniciar sesión.")
      setTimeout(() => router.replace("/login"), 800)
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar la contraseña")
    } finally {
      setLoading(false)
    }
  }

  if (!ready) {
    return <p className="text-white/80">Cargando...</p>
  }

  if (!hasSession) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Restablecer contraseña</h1>
          <p className="text-sm text-white/70 mt-1">
            Abrí esta pantalla desde el link de recuperación enviado por email.
          </p>
        </div>
        <Link className="text-white/80 hover:text-white underline text-sm" href="/forgot-password">
          Volver a enviar link
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Nueva contraseña</h1>
        <p className="text-sm text-white/70 mt-1">Elegí una contraseña nueva</p>
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
          <label className="text-sm font-medium text-white/90">Contraseña nueva</label>
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

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-white/90">Confirmar contraseña</label>
          <Input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={6}
            className="bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:border-white/30"
            placeholder="repetir contraseña"
          />
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="w-full bg-white/10 hover:bg-white/20 border border-white/20 text-white"
        >
          {loading ? "Actualizando..." : "Actualizar contraseña"}
        </Button>
      </form>

      <div className="text-sm">
        <Link className="text-white/80 hover:text-white underline" href="/productos">
          Volver
        </Link>
      </div>
    </div>
  )
}

