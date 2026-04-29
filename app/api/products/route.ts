import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"

// This route depends on request/cookies and must never be prerendered.
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const countryCode = request.nextUrl.searchParams.get("country")

    const supabase = await createClient()

    // Products
    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false })

    if (productsError) {
      console.error("Error fetching products:", productsError)
      return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 })
    }

    const productIds = (products || []).map((p: any) => p.id).filter(Boolean)

    // Overrides (optional filter by country)
    let overridesQuery = supabase
      .from("product_country_overrides")
      .select("*")
      .in("product_id", productIds.length ? productIds : ["00000000-0000-0000-0000-000000000000"])
    if (countryCode) overridesQuery = overridesQuery.eq("country_code", countryCode)

    const { data: overrides, error: overridesError } = await overridesQuery
    if (overridesError) {
      console.error("Error fetching product overrides:", overridesError)
      return NextResponse.json({ error: "Failed to fetch product overrides" }, { status: 500 })
    }

    const byProductId = new Map<string, any[]>()
    for (const o of overrides || []) {
      const pid = (o as any).product_id as string
      if (!pid) continue
      if (!byProductId.has(pid)) byProductId.set(pid, [])
      byProductId.get(pid)!.push(o)
    }

    const out = (products || []).map((p: any) => ({
      ...p,
      country_overrides: byProductId.get(p.id) || [],
    }))

    return NextResponse.json(out)
  } catch (error) {
    console.error("Error fetching products:", error)
    return NextResponse.json(
      { error: "Failed to fetch products" },
      { status: 500 }
    )
  }
}
