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
              ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white border-blue-700 shadow-blue"
              : "bg-white text-slate-700 border-blue-200 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700"
          )}
        >
          {country.name}
        </button>
      ))}
    </div>
  )
}



