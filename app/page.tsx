import { redirect } from "next/navigation"
import { getCurrentUserPermissions } from "@/lib/auth-permissions"
import { resolveHomePath } from "@/lib/page-access"

export default async function Home() {
  const perm = await getCurrentUserPermissions()
  if (!perm) redirect("/login")
  redirect(resolveHomePath(perm.isAdmin, perm.allowedPages))
}
