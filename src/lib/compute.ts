import { Product, CountryCode, ComputedResult, ComputedRow, OverrideFields } from '@/types'
import { COUNTRY_RATES } from './countryRates'

/**
 * Función auxiliar para calcular valor en USD o Pct dependiendo de qué esté definido
 * Prioridad: USD > Pct > default
 */
function calculateValue(
  baseAmount: number,
  usdValue?: number,
  pctValue?: number,
  defaultValue: number = 0
): { amount: number; pct: number } {
  if (usdValue !== undefined) {
    // Si hay valor en USD, usarlo y calcular el %
    return {
      amount: usdValue,
      pct: baseAmount > 0 ? (usdValue / baseAmount) : 0
    }
  } else if (pctValue !== undefined) {
    // Si hay valor en %, usarlo y calcular el USD
    return {
      amount: baseAmount * pctValue,
      pct: pctValue
    }
  } else {
    // Usar valor por defecto
    return {
      amount: baseAmount * defaultValue,
      pct: defaultValue
    }
  }
}

export function computePricing(
  product: Product,
  countryCode: CountryCode,
  overrides?: OverrideFields
): ComputedResult {
  const countryRates = COUNTRY_RATES[countryCode]
  const basePrice = product.base_price

  // Merge country rules with overrides
  const rules = { ...countryRates.rules, ...overrides }

  // Gross Sales (sin IVA) - puede ser editado por país
  const grossSalesAmount = overrides?.grossSalesUSD !== undefined ? overrides.grossSalesUSD : basePrice
  const grossSales: ComputedRow = {
    label: 'Gross Sales (sin IVA)',
    account: countryRates.accounts.grossSales,
    amount: grossSalesAmount,
    pct: 100,
  }

  // Commercial Discount - puede ser porcentaje o monto fijo USD
  const discountCalc = calculateValue(
    grossSalesAmount,
    overrides?.commercialDiscountUSD,
    overrides?.commercialDiscountPct,
    rules.commercialDiscountPct || 0
  )
  
  const discount: ComputedRow = {
    label: 'Commercial Discount',
    account: countryRates.accounts.discount,
    amount: -discountCalc.amount,
    pct: -(discountCalc.pct * 100),
  }

  // Sales Revenue
  const salesRevenueAmount = grossSalesAmount - discountCalc.amount
  const salesRevenue: ComputedRow = {
    label: 'Sales Revenue',
    account: undefined,
    amount: salesRevenueAmount,
    pct: grossSalesAmount > 0 ? (salesRevenueAmount / grossSalesAmount) * 100 : 0,
  }

  // Cost of Sales (separador visual)
  const costOfSales: ComputedRow = {
    label: 'Cost of Sales',
    account: undefined,
    amount: 0, // Será calculado después
    pct: 0,
  }

  // Cost of Sales components (en orden específico)
  const costRows: ComputedRow[] = []

  // 1. Product Cost - puede ser USD o %
  const productCostCalc = calculateValue(
    salesRevenueAmount,
    overrides?.productCostUSD,
    overrides?.productCostPct,
    rules.productCostPct || 0
  )
  costRows.push({
    label: 'Product Cost',
    account: countryRates.accounts.productCost,
    amount: productCostCalc.amount,
    pct: productCostCalc.pct * 100,
  })

  // 2. Kit Cost - puede ser USD o %
  const kitCostCalc = calculateValue(
    salesRevenueAmount,
    overrides?.kitCostUSD,
    overrides?.kitCostPct,
    rules.kitCostUSD ? (rules.kitCostUSD / salesRevenueAmount) : 0
  )
  costRows.push({
    label: 'Kit Cost',
    account: countryRates.accounts.kitCost,
    amount: kitCostCalc.amount,
    pct: kitCostCalc.pct * 100,
  })

  // 3. Payment Fee Costs - puede ser USD o %
  const paymentFeeCalc = calculateValue(
    salesRevenueAmount,
    overrides?.paymentFeeUSD,
    overrides?.paymentFeePct,
    rules.paymentFeePct || 0
  )
  costRows.push({
    label: 'Payment Fee Costs',
    account: undefined,
    amount: paymentFeeCalc.amount,
    pct: paymentFeeCalc.pct * 100,
  })

  // 4. Blood Drawn & Sample Handling - puede ser USD o %
  const bloodDrawCalc = calculateValue(
    salesRevenueAmount,
    overrides?.bloodDrawSampleUSD,
    overrides?.bloodDrawSamplePct,
    rules.bloodDrawSampleUSD ? (rules.bloodDrawSampleUSD / salesRevenueAmount) : 0
  )
  costRows.push({
    label: 'Blood Drawn & Sample Handling',
    account: countryRates.accounts.bloodDrawSample,
    amount: bloodDrawCalc.amount,
    pct: bloodDrawCalc.pct * 100,
  })

  // 5. Sanitary Permits to export blood - puede ser USD o %
  const sanitaryPermitsCalc = calculateValue(
    salesRevenueAmount,
    overrides?.sanitaryPermitsUSD,
    overrides?.sanitaryPermitsPct,
    rules.sanitaryPermitsUSD ? (rules.sanitaryPermitsUSD / salesRevenueAmount) : 0
  )
  costRows.push({
    label: 'Sanitary Permits to export blood',
    account: countryRates.accounts.sanitaryPermits,
    amount: sanitaryPermitsCalc.amount,
    pct: sanitaryPermitsCalc.pct * 100,
  })

  // 6. External Courier - puede ser USD o %
  const externalCourierCalc = calculateValue(
    salesRevenueAmount,
    overrides?.externalCourierUSD,
    overrides?.externalCourierPct,
    rules.externalCourierUSD ? (rules.externalCourierUSD / salesRevenueAmount) : 0
  )
  costRows.push({
    label: 'External Courier',
    account: countryRates.accounts.externalCourier,
    amount: externalCourierCalc.amount,
    pct: externalCourierCalc.pct * 100,
  })

  // 7. Internal Courier - puede ser USD o %
  const internalCourierCalc = calculateValue(
    salesRevenueAmount,
    overrides?.internalCourierUSD,
    overrides?.internalCourierPct,
    rules.internalCourierUSD ? (rules.internalCourierUSD / salesRevenueAmount) : 0
  )
  costRows.push({
    label: 'Internal Courier',
    account: countryRates.accounts.internalCourier,
    amount: internalCourierCalc.amount,
    pct: internalCourierCalc.pct * 100,
  })

  // 8. Physicians Fees - puede ser USD o %
  const physiciansFeesCalc = calculateValue(
    salesRevenueAmount,
    overrides?.physiciansFeesUSD,
    overrides?.physiciansFeesPct,
    rules.physiciansFeesUSD ? (rules.physiciansFeesUSD / salesRevenueAmount) : 0
  )
  costRows.push({
    label: 'Physicians Fees',
    account: countryRates.accounts.physiciansFees,
    amount: physiciansFeesCalc.amount,
    pct: physiciansFeesCalc.pct * 100,
  })

  // 9. Sales Commission - puede ser USD o %
  const salesCommissionCalc = calculateValue(
    salesRevenueAmount,
    overrides?.salesCommissionUSD,
    overrides?.salesCommissionPct,
    rules.salesCommissionPct || 0
  )
  costRows.push({
    label: 'Sales Commission',
    account: countryRates.accounts.salesCommission,
    amount: salesCommissionCalc.amount,
    pct: salesCommissionCalc.pct * 100,
  })

  // Total Cost of Sales
  const totalCostAmount = costRows.reduce((sum, row) => sum + row.amount, 0)
  const totalCostOfSales: ComputedRow = {
    label: 'Total Cost of Sales',
    account: undefined,
    amount: totalCostAmount,
    pct: (totalCostAmount / salesRevenueAmount) * 100,
  }

  // Gross Profit
  const grossProfitAmount = salesRevenueAmount - totalCostAmount
  const grossProfit: ComputedRow = {
    label: 'Gross Profit',
    account: undefined,
    amount: grossProfitAmount,
    pct: (grossProfitAmount / salesRevenueAmount) * 100,
  }

  return {
    grossSales,
    discount,
    salesRevenue,
    costOfSales,
    costRows,
    totalCostOfSales,
    grossProfit,
  }
}

export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatPercentage(pct: number): string {
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`
}
