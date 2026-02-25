import { NextResponse } from "next/server"
import { getCurrentUserPermissions } from "@/lib/auth-permissions"

export async function GET() {
  const perm = await getCurrentUserPermissions()
  if (!perm) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }
  return NextResponse.json(perm)
}
