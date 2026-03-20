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
  "Southgenetics LLC Chile": "CL",
  "SouthGenetics LLC Colombia": "CO",
  "SouthGenetics LLC México": "MX",
  "SouthGenetics LLC Venezuela": "VE",
}

/** Devuelve el código de país (ej: "AR") para una compañía de ventas concreta. */
export function getCountryForCompany(company: string | null | undefined): string | undefined {
  if (!company) return undefined
  return COMPANY_TO_COUNTRY_MAP[company.trim()]
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
