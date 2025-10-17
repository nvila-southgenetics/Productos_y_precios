import { Database } from './types/database'

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type Inserts<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type Updates<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']

export type Profile = Tables<'profiles'>

export type InterfacePreferences = {
  theme: 'pink' | 'blue' | 'green' | 'purple' | 'dark'
  language: 'es' | 'en' | 'pt'
  currency: 'USD' | 'EUR' | 'UYU' | 'ARS' | 'MXN' | 'CLP' | 'VES' | 'COP'
  dateFormat: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD'
  numberFormat: 'US' | 'EU' | 'LA'
  dashboardLayout: 'grid' | 'table' | 'compact'
  showCountryFlags: boolean
  compactMode: boolean
  accentColor: 'rose' | 'blue' | 'green' | 'purple' | 'orange'
  sidebarCollapsed: boolean
}

export type NotificationPreferences = {
  emailNotifications: boolean
  desktopNotifications: boolean
  priceChangeAlerts: boolean
  newProductAlerts: boolean
  weeklyReports: boolean
}
export type Product = Tables<'products'>
export type ProductCountryOverride = Tables<'product_country_overrides'>

export type CountryCode = 'UY' | 'AR' | 'MX' | 'CL' | 'VE' | 'CO'
export type MxConfigType = 'gobierno' | 'convenio' | 'lanzamiento' | 'default'

export type ComputedRow = {
  label: string
  account?: string
  amount: number
  pct: number
}

export type ComputedResult = {
  grossSales: ComputedRow
  discount: ComputedRow
  salesRevenue: ComputedRow
  costOfSales: ComputedRow // Separador visual
  costRows: ComputedRow[]
  totalCostOfSales: ComputedRow
  grossProfit: ComputedRow
}

export type CountryRates = {
  currency: 'USD'
  accounts: {
    grossSales: string
    discount: string
    productCost: string
    kitCost: string
    bloodDrawSample: string
    sanitaryPermits: string
    externalCourier: string
    internalCourier: string
    physiciansFees: string
    salesCommission: string
  }
  rules: {
    commercialDiscountPct: number
    productCostPct?: number
    kitCostUSD?: number
    paymentFeePct?: number
    bloodDrawSampleUSD?: number
    sanitaryPermitsUSD?: number
    externalCourierUSD?: number
    internalCourierUSD?: number
    physiciansFeesUSD?: number
    salesCommissionPct?: number
  }
}

export type OverrideFields = {
  // Gross Sales - puede ser editado por país
  grossSalesUSD?: number
  
  // Commercial Discount - ambos formatos
  commercialDiscountPct?: number
  commercialDiscountUSD?: number
  
  // Product Cost - ambos formatos
  productCostPct?: number
  productCostUSD?: number
  
  // Kit Cost - ambos formatos
  kitCostPct?: number
  kitCostUSD?: number
  
  // Payment Fee - ambos formatos
  paymentFeePct?: number
  paymentFeeUSD?: number
  
  // Blood Draw & Sample Handling - ambos formatos
  bloodDrawSamplePct?: number
  bloodDrawSampleUSD?: number
  
  // Sanitary Permits - ambos formatos
  sanitaryPermitsPct?: number
  sanitaryPermitsUSD?: number
  
  // External Courier - ambos formatos
  externalCourierPct?: number
  externalCourierUSD?: number
  
  // Internal Courier - ambos formatos
  internalCourierPct?: number
  internalCourierUSD?: number
  
  // Physicians Fees - ambos formatos
  physiciansFeesPct?: number
  physiciansFeesUSD?: number
  
  // Sales Commission - ambos formatos
  salesCommissionPct?: number
  salesCommissionUSD?: number
}
