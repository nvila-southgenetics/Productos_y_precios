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
            "px-4 py-2 rounded-full text-sm font-medium transition-colors border",
            selectedCountry === country.code
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-background text-foreground border-input hover:bg-accent hover:text-accent-foreground"
          )}
        >
          {country.code}
        </button>
      ))}
    </div>
  )
}

