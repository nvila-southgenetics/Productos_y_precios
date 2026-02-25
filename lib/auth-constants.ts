export type UserRole = "admin" | "editor" | "viewer"

const COUNTRY_CODES = ["UY", "AR", "MX", "CL", "VE", "CO"] as const

export function getAllCountryCodes(): readonly string[] {
  return COUNTRY_CODES
}

export const COUNTRY_CODES_LIST: string[] = ["UY", "AR", "MX", "CL", "VE", "CO"]

const COMPANY_TO_COUNTRY_MAP: Record<string, string> = {
  "SouthGenetics LLC": "UY",
  "SouthGenetics LLC Uruguay": "UY",
  "SouthGenetics LLC Argentina": "AR",
  "SouthGenetics LLC Arge": "AR",
  "SouthGenetics LLC Chile": "CL",
  "Southgenetics LLC Chile": "CL",
  "Southgenetics LTDA": "CL",
  "SouthGenetics LLC Colombia": "CO",
  "SouthGenetics LLC México": "MX",
  "SouthGenetics LLC Venezuela": "VE",
}

export function filterCompaniesByCountries(
  companies: string[],
  allowedCountries: string[]
): string[] {
  if (!allowedCountries.length) return companies
  return companies.filter((c) => {
    const country = COMPANY_TO_COUNTRY_MAP[c.trim()]
    return !country || allowedCountries.includes(country)
  })
}

export function filterCountriesByAllowed(
  countryCodes: string[],
  allowedCountries: string[]
): string[] {
  if (!allowedCountries.length) return countryCodes
  return countryCodes.filter((c) => allowedCountries.includes(c))
}
