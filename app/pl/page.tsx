"use client"

import { useState, useEffect } from "react"
import { usePermissions } from "@/lib/use-permissions"
import { supabase } from "@/lib/supabase"
import { Select } from "@/components/ui/select"
import { productNameSortKey } from "@/lib/utils"
import { PLTable } from "@/components/pl/PLTable"

const COUNTRIES = [
  { code: "AR", name: "Argentina" },
  { code: "CL", name: "Chile" },
  { code: "CO", name: "Colombia" },
  { code: "MX", name: "México" },
  { code: "UY", name: "Uruguay" },
  { code: "VE", name: "Venezuela" },
]

const CHANNELS = ["Gobierno", "Instituciones SFL", "Paciente", "Aseguradoras", "Distribuidores"]

const CATEGORIES = [
  "Anualidades",
  "Endocrinología",
  "Ginecología",
  "Oncología",
  "Otros",
  "Prenatales",
  "Urología",
]

const selectClass =
  "w-full bg-white/10 border-white/20 text-white focus:border-white/30 focus:ring-white/30"

export default function PLPage() {
  const { allowedCountries, isAdmin, canEdit, loading: permLoading } = usePermissions()
  const [modelo, setModelo] = useState<"budget" | "real">("budget")
  const [country, setCountry] = useState<string>("AR")
  const [category, setCategory] = useState<string>("all")
  const [product, setProduct] = useState<string>("all")
  const [channel, setChannel] = useState<string>("all")
  const [products, setProducts] = useState<string[]>([])
  const year = 2026

  useEffect(() => {
    if (!permLoading && !isAdmin && allowedCountries.length > 0) {
      setCountry(allowedCountries[0])
    }
  }, [permLoading, isAdmin, allowedCountries])

  useEffect(() => {
    fetchProducts()
    setProduct("all")
  }, [country, category, modelo, year])

  const fetchProducts = async () => {
    try {
      if (modelo === "budget") {
        let q = supabase.from("budget").select("product_name").eq("year", year)
        if (country !== "all") q = q.eq("country_code", country)
        const { data } = await q
        if (!data) return
        let names = [...new Set(data.map((b: { product_name: string }) => b.product_name))] as string[]

        if (category !== "all") {
          const { data: prods } = await supabase
            .from("products")
            .select("name")
            .eq("category", category)
          const catNames = new Set(prods?.map((p: { name: string }) => p.name) || [])
          names = names.filter((n) => catNames.has(n))
        }
        setProducts(
          names.sort((a, b) =>
            productNameSortKey(a).localeCompare(productNameSortKey(b), "es", { sensitivity: "base" })
          )
        )
      } else {
        let q = supabase.from("products").select("name, category")
        if (category !== "all") q = q.eq("category", category)
        const { data } = await q
        if (!data) return
        setProducts(
          data
            .map((p: { name: string }) => p.name)
            .sort((a: string, b: string) =>
              productNameSortKey(a).localeCompare(productNameSortKey(b), "es", { sensitivity: "base" })
            )
        )
      }
    } catch (err) {
      console.error(err)
    }
  }

  const availableCountries = isAdmin
    ? COUNTRIES
    : COUNTRIES.filter((c) => allowedCountries.includes(c.code))

  return (
    <div className="min-h-screen bg-gradient-to-r from-blue-900 via-blue-950 to-slate-900">
      <div className="container mx-auto py-8 px-4 max-w-screen-2xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white">P&L</h1>
          <p className="text-white/80 mt-1">
            Estado de resultados por producto, país y canal
          </p>
        </div>

        {/* Filters */}
        <div className="mb-6 rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 p-4 shadow-sm">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {/* Modelo */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-white/90">Modelo</label>
              <Select
                value={modelo}
                onChange={(e) => setModelo(e.target.value as "budget" | "real")}
                className={selectClass}
              >
                <option value="budget" className="bg-blue-900 text-white">
                  Budget
                </option>
                <option value="real" className="bg-blue-900 text-white">
                  Real 2026
                </option>
              </Select>
            </div>

            {/* País */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-white/90">País</label>
              <Select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className={selectClass}
              >
                {availableCountries.map((c) => (
                  <option key={c.code} value={c.code} className="bg-blue-900 text-white">
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>

            {/* Categoría */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-white/90">Categoría</label>
              <Select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className={selectClass}
              >
                <option value="all" className="bg-blue-900 text-white">
                  Todas las categorías
                </option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c} className="bg-blue-900 text-white">
                    {c}
                  </option>
                ))}
              </Select>
            </div>

            {/* Producto */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-white/90">Producto</label>
              <Select
                value={product}
                onChange={(e) => setProduct(e.target.value)}
                className={selectClass}
              >
                <option value="all" className="bg-blue-900 text-white">
                  Todos los productos
                </option>
                {products.map((p) => (
                  <option key={p} value={p} className="bg-blue-900 text-white">
                    {p}
                  </option>
                ))}
              </Select>
            </div>

            {/* Canal */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-white/90">Canal</label>
              <Select
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                className={selectClass}
              >
                <option value="all" className="bg-blue-900 text-white">
                  Todos los canales
                </option>
                {CHANNELS.map((ch) => (
                  <option key={ch} value={ch} className="bg-blue-900 text-white">
                    {ch}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </div>

        {/* P&L Table */}
        <PLTable
          modelo={modelo}
          year={year}
          country={country}
          category={category}
          product={product}
          channel={channel}
          canEdit={canEdit}
        />
      </div>
    </div>
  )
}
