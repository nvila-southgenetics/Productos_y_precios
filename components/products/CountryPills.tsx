"use client"

import { cn } from "@/lib/utils"

const countries = [
  { code: "AR", name: "Argentina" },
  { code: "CL", name: "Chile" },
  { code: "CO", name: "Colombia" },
  { code: "MX", name: "México" },
  { code: "UY", name: "Uruguay" },
  { code: "VE", name: "Venezuela" },
].sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }))

interface CountryPillsProps {
  selectedCountry: string
  onCountryChange: (country: string) => void
  /** Si se pasa, solo se muestran estos países (permisos del usuario). */
  allowedCountries?: string[]
}

export function CountryPills({ selectedCountry, onCountryChange, allowedCountries }: CountryPillsProps) {
  const list = allowedCountries?.length
    ? countries.filter((c) => allowedCountries.includes(c.code))
    : countries
  return (
    <div className="flex gap-2 flex-wrap">
      {list.map((country) => (
        <button
          key={country.code}
          onClick={() => onCountryChange(country.code)}
          className={cn(
            "px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 border shadow-sm",
            selectedCountry === country.code
              ? "bg-white/20 text-white border-white/30 shadow-sm backdrop-blur-sm"
              : "bg-white/10 text-white/70 border-white/20 hover:bg-white/15 hover:border-white/30 hover:text-white backdrop-blur-sm"
          )}
        >
          {country.name}
        </button>
      ))}
    </div>
  )
}



