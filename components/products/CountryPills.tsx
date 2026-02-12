"use client"

import { cn } from "@/lib/utils"

const countries = [
  { code: "UY", name: "Uruguay" },
  { code: "AR", name: "Argentina" },
  { code: "MX", name: "México" },
  { code: "CL", name: "Chile" },
  { code: "VE", name: "Venezuela" },
  { code: "CO", name: "Colombia" },
]

interface CountryPillsProps {
  selectedCountry: string
  onCountryChange: (country: string) => void
}

export function CountryPills({ selectedCountry, onCountryChange }: CountryPillsProps) {
  return (
    <div className="flex gap-2 flex-wrap">
      {countries.map((country) => (
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



