"use client"

import { useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getAllCountryCodes } from "@/lib/auth-constants"
import { UserPlus, Loader2, Shield, Globe, Pencil, Check, X, Users } from "lucide-react"

type UserRole = "admin" | "editor" | "viewer"

interface UserRow {
  id: string
  email: string | null
  created_at: string
  role?: string
  allowed_countries?: string[]
}

const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Administrador",
  editor: "Lectura y escritura",
  viewer: "Solo lectura",
}

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-amber-500/20 text-amber-200 border-amber-400/30",
  editor: "bg-emerald-500/20 text-emerald-200 border-emerald-400/30",
  viewer: "bg-blue-500/20 text-blue-200 border-blue-400/30",
}

const COUNTRY_FLAGS: Record<string, string> = {
  UY: "🇺🇾",
  AR: "🇦🇷",
  MX: "🇲🇽",
  CL: "🇨🇱",
  VE: "🇻🇪",
  CO: "🇨🇴",
}

export default function AdminPage() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [ensureDone, setEnsureDone] = useState(false)

  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<UserRole>("viewer")
  const [inviteCountries, setInviteCountries] = useState<string[]>([])
  const [inviting, setInviting] = useState(false)
  const [inviteMessage, setInviteMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null)

  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [editRole, setEditRole] = useState<UserRole>("viewer")
  const [editCountries, setEditCountries] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const countries = getAllCountryCodes()

  useEffect(() => {
    async function ensure() {
      try {
        await fetch("/api/admin/ensure-admin", { method: "POST" })
      } finally {
        setEnsureDone(true)
      }
    }
    ensure()
  }, [])

  const loadUsers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/users")
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || "Solo administradores")
        setUsers([])
        return
      }
      const data = await res.json()
      setUsers(data)
    } catch {
      setError("Error al cargar usuarios")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!ensureDone) return
    loadUsers()
  }, [ensureDone, loadUsers])

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setInviteMessage(null)
    setInviting(true)
    try {
      const res = await fetch("/api/admin/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          role: inviteRole,
          allowed_countries: inviteRole === "admin" ? countries.slice() : inviteCountries,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setInviteMessage({ type: "err", text: data.error || "Error al invitar" })
        return
      }
      setInviteMessage({ type: "ok", text: data.message || "Invitación enviada" })
      setInviteEmail("")
      setInviteCountries([])
      setInviteRole("viewer")
      await loadUsers()
    } finally {
      setInviting(false)
    }
  }

  function toggleInviteCountry(code: string) {
    setInviteCountries((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    )
  }

  function startEditing(user: UserRow) {
    setEditingUserId(user.id)
    setEditRole((user.role as UserRole) || "viewer")
    setEditCountries(user.allowed_countries ?? [])
  }

  function cancelEditing() {
    setEditingUserId(null)
  }

  async function savePermissions(userId: string) {
    setSaving(true)
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          role: editRole,
          allowed_countries: editRole === "admin" ? countries.slice() : editCountries,
        }),
      })
      if (res.ok) {
        setEditingUserId(null)
        await loadUsers()
      }
    } finally {
      setSaving(false)
    }
  }

  function toggleEditCountry(code: string) {
    setEditCountries((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-r from-blue-900 via-blue-950 to-slate-900">
      <div className="container mx-auto py-8 px-4 max-w-5xl">
        <div className="flex items-center gap-3 mb-2">
          <Shield className="h-8 w-8 text-amber-400" />
          <h1 className="text-3xl font-bold text-white">Panel de Administración</h1>
        </div>
        <p className="text-white/70 mb-8">
          Invitá usuarios, asigná roles (lectura/escritura) y restringí el acceso por país.
        </p>

        {error && (
          <div className="rounded-lg border border-red-400/30 bg-red-500/10 p-4 text-red-200 mb-6">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-white/80 py-20 justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
            Cargando...
          </div>
        ) : (
          <div className="space-y-6">
            {/* Invitar usuario */}
            <section className="rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-blue-400" />
                Invitar nuevo usuario
              </h2>
              {inviteMessage && (
                <div
                  className={`mb-4 p-3 rounded-lg text-sm ${
                    inviteMessage.type === "ok"
                      ? "bg-emerald-500/20 text-emerald-100 border border-emerald-400/30"
                      : "bg-red-500/20 text-red-200 border border-red-400/30"
                  }`}
                >
                  {inviteMessage.text}
                </div>
              )}
              <form onSubmit={handleInvite} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-white/90 mb-1.5">Email</label>
                    <Input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      required
                      placeholder="usuario@ejemplo.com"
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-white/90 mb-1.5">Rol</label>
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as UserRole)}
                      className="w-full rounded-lg border border-white/20 bg-white/10 text-white px-3 py-2 text-sm"
                    >
                      <option value="viewer" className="bg-slate-800">Solo lectura</option>
                      <option value="editor" className="bg-slate-800">Lectura y escritura</option>
                      <option value="admin" className="bg-slate-800">Administrador</option>
                    </select>
                  </div>
                </div>

                {inviteRole !== "admin" && (
                  <div>
                    <label className="block text-sm font-medium text-white/90 mb-2">
                      <Globe className="h-4 w-4 inline mr-1" />
                      Países permitidos
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {countries.map((code) => (
                        <button
                          key={code}
                          type="button"
                          onClick={() => toggleInviteCountry(code)}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                            inviteCountries.includes(code)
                              ? "bg-blue-500/30 border-blue-400/50 text-white"
                              : "bg-white/5 border-white/15 text-white/60 hover:bg-white/10"
                          }`}
                        >
                          {COUNTRY_FLAGS[code]} {code}
                        </button>
                      ))}
                    </div>
                    {inviteCountries.length === 0 && (
                      <p className="text-xs text-amber-300/80 mt-1.5">
                        Seleccioná al menos un país para que el usuario pueda ver datos.
                      </p>
                    )}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={inviting || (inviteRole !== "admin" && inviteCountries.length === 0)}
                  className="bg-blue-600 hover:bg-blue-700 text-white border-0"
                >
                  {inviting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4 mr-1.5" />
                      Enviar invitación
                    </>
                  )}
                </Button>
              </form>
            </section>

            {/* Lista de usuarios */}
            <section className="rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-400" />
                Usuarios del sistema ({users.length})
              </h2>
              <div className="space-y-3">
                {users.map((u) => {
                  const isEditing = editingUserId === u.id
                  const role = (u.role as UserRole) || "viewer"

                  return (
                    <div
                      key={u.id}
                      className={`rounded-lg border p-4 transition-all ${
                        isEditing
                          ? "bg-white/10 border-blue-400/40"
                          : "bg-white/5 border-white/10 hover:bg-white/[0.07]"
                      }`}
                    >
                      {isEditing ? (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-white font-medium">{u.email ?? "—"}</span>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                disabled={saving}
                                onClick={() => savePermissions(u.id)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white border-0 h-8"
                              >
                                {saving ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Check className="h-3.5 w-3.5" />
                                )}
                                <span className="ml-1">Guardar</span>
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={cancelEditing}
                                className="text-white/70 hover:text-white hover:bg-white/10 h-8"
                              >
                                <X className="h-3.5 w-3.5" />
                                <span className="ml-1">Cancelar</span>
                              </Button>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-white/70 mb-1">Rol</label>
                              <select
                                value={editRole}
                                onChange={(e) => setEditRole(e.target.value as UserRole)}
                                className="w-full rounded-lg border border-white/20 bg-white/10 text-white px-3 py-1.5 text-sm"
                              >
                                <option value="viewer" className="bg-slate-800">Solo lectura</option>
                                <option value="editor" className="bg-slate-800">Lectura y escritura</option>
                                <option value="admin" className="bg-slate-800">Administrador</option>
                              </select>
                            </div>
                            {editRole !== "admin" && (
                              <div>
                                <label className="block text-xs font-medium text-white/70 mb-1">Países</label>
                                <div className="flex flex-wrap gap-1.5">
                                  {countries.map((code) => (
                                    <button
                                      key={code}
                                      type="button"
                                      onClick={() => toggleEditCountry(code)}
                                      className={`px-2 py-1 rounded text-xs font-medium border transition-all ${
                                        editCountries.includes(code)
                                          ? "bg-blue-500/30 border-blue-400/50 text-white"
                                          : "bg-white/5 border-white/15 text-white/50 hover:bg-white/10"
                                      }`}
                                    >
                                      {COUNTRY_FLAGS[code]} {code}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4 min-w-0">
                            <div className="min-w-0">
                              <p className="text-white font-medium truncate">{u.email ?? "—"}</p>
                              <p className="text-xs text-white/50 mt-0.5">
                                Desde {new Date(u.created_at).toLocaleDateString("es")}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <span
                              className={`px-2.5 py-1 rounded-md text-xs font-medium border ${
                                ROLE_COLORS[role] || ROLE_COLORS.viewer
                              }`}
                            >
                              {ROLE_LABELS[role] || role}
                            </span>
                            <div className="flex items-center gap-1">
                              {(u.allowed_countries?.length
                                ? u.allowed_countries
                                : []
                              ).map((c) => (
                                <span
                                  key={c}
                                  className="text-sm"
                                  title={c}
                                >
                                  {COUNTRY_FLAGS[c] || c}
                                </span>
                              ))}
                              {(!u.allowed_countries || u.allowed_countries.length === 0) &&
                                role !== "admin" && (
                                  <span className="text-xs text-white/40">Sin países</span>
                                )}
                              {role === "admin" && (
                                <span className="text-xs text-amber-300/70">Todos</span>
                              )}
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => startEditing(u)}
                              className="text-white/60 hover:text-white hover:bg-white/10 h-8 w-8 p-0"
                              title="Editar permisos"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
                {users.length === 0 && (
                  <div className="text-center py-8 text-white/50">
                    No hay usuarios registrados todavía.
                  </div>
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
