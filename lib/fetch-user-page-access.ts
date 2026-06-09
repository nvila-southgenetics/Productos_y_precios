import { createAdminClient } from "@/lib/supabase/admin"

export async function fetchUserPageAccess(userId: string): Promise<{
  isAdmin: boolean
  allowedPages: string[] | null
}> {
  const admin = createAdminClient()
  const [{ data: profile }, { data: perm }] = await Promise.all([
    admin.from("profiles").select("role").eq("id", userId).single(),
    admin.from("user_permissions").select("allowed_pages").eq("user_id", userId).single(),
  ])

  const pages = perm?.allowed_pages
  const allowedPages =
    Array.isArray(pages) && pages.length > 0 ? (pages as string[]) : null

  return {
    isAdmin: profile?.role === "admin",
    allowedPages,
  }
}
