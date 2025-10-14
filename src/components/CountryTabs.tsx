'use client'

import { CountryCode, COUNTRY_NAMES, COUNTRY_FLAGS } from '@/lib/countryRates'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface CountryTabsProps {
  selectedCountry: CountryCode
  onCountryChange: (country: CountryCode) => void
}

export function CountryTabs({ selectedCountry, onCountryChange }: CountryTabsProps) {
  const countries: CountryCode[] = Object.keys(COUNTRY_NAMES) as CountryCode[]

  return (
    <Tabs value={selectedCountry} onValueChange={onCountryChange} className="w-full">
      <TabsList className="grid w-full grid-cols-6">
        {countries.map((country) => (
          <TabsTrigger key={country} value={country} className="country-chip">
            <span className="mr-2">{COUNTRY_FLAGS[country]}</span>
            {COUNTRY_NAMES[country]}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
