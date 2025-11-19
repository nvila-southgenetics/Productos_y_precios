import { CountryCode, CountryRates } from '@/types'

export const COUNTRY_RATES: Record<CountryCode, CountryRates> = {
  UY: {
    currency: 'USD',
    accounts: {
      grossSales: '4.1.1.6',
      discount: '4.1.1.10',
      productCost: '5.1.1.6',
      kitCost: '5.1.4.1.4',
      bloodDrawSample: '5.1.4.1.2',
      sanitaryPermits: '5.1.x.x',
      externalCourier: '5.1.2.4.2',
      internalCourier: '5.1.2.4.1',
      physiciansFees: '5.1.4.1.1',
      salesCommission: '6.1.1.06',
    },
    rules: {
      commercialDiscountPct: 0.05, // 5% descuento comercial
      productCostPct: 0.25, // 25% costo del producto
      kitCostUSD: 150, // $150 USD costo del kit
      paymentFeePct: 0.029, // 2.9% fee de pago
      bloodDrawSampleUSD: 50, // $50 USD toma de muestra
      sanitaryPermitsUSD: 75, // $75 USD permisos sanitarios
      externalCourierUSD: 200, // $200 USD courrier externo
      internalCourierUSD: 30, // $30 USD courrier interno
      physiciansFeesUSD: 100, // $100 USD honorarios médicos
      salesCommissionPct: 0.08, // 8% comisión de ventas
    },
  },
  AR: {
    currency: 'USD',
    accounts: {
      grossSales: '4.1.1.6',
      discount: '4.1.1.10',
      productCost: '5.1.1.6',
      kitCost: '5.1.4.1.4',
      bloodDrawSample: '5.1.4.1.2',
      sanitaryPermits: '5.1.x.x',
      externalCourier: '5.1.2.4.2',
      internalCourier: '5.1.2.4.1',
      physiciansFees: '5.1.4.1.1',
      salesCommission: '6.1.1.06',
    },
    rules: {
      commercialDiscountPct: 0.03, // 3% descuento comercial
      productCostPct: 0.20, // 20% costo del producto
      kitCostUSD: 120, // $120 USD costo del kit
      paymentFeePct: 0.035, // 3.5% fee de pago
      bloodDrawSampleUSD: 40, // $40 USD toma de muestra
      sanitaryPermitsUSD: 60, // $60 USD permisos sanitarios
      externalCourierUSD: 180, // $180 USD courrier externo
      internalCourierUSD: 25, // $25 USD courrier interno
      physiciansFeesUSD: 80, // $80 USD honorarios médicos
      salesCommissionPct: 0.07, // 7% comisión de ventas
    },
  },
  MX: {
    currency: 'USD',
    accounts: {
      grossSales: '4.1.1.6',
      discount: '4.1.1.10',
      productCost: '5.1.1.6',
      kitCost: '5.1.4.1.4',
      bloodDrawSample: '5.1.4.1.2',
      sanitaryPermits: '5.1.x.x',
      externalCourier: '5.1.2.4.2',
      internalCourier: '5.1.2.4.1',
      physiciansFees: '5.1.4.1.1',
      salesCommission: '6.1.1.06',
    },
    rules: {
      commercialDiscountPct: 0.04, // 4% descuento comercial
      productCostPct: 0.22, // 22% costo del producto
      kitCostUSD: 140, // $140 USD costo del kit
      paymentFeePct: 0.032, // 3.2% fee de pago
      bloodDrawSampleUSD: 45, // $45 USD toma de muestra
      sanitaryPermitsUSD: 85, // $85 USD permisos sanitarios
      externalCourierUSD: 190, // $190 USD courrier externo
      internalCourierUSD: 28, // $28 USD courrier interno
      physiciansFeesUSD: 90, // $90 USD honorarios médicos
      salesCommissionPct: 0.075, // 7.5% comisión de ventas
    },
  },
  CL: {
    currency: 'USD',
    accounts: {
      grossSales: '4.1.1.6',
      discount: '4.1.1.10',
      productCost: '5.1.1.6',
      kitCost: '5.1.4.1.4',
      bloodDrawSample: '5.1.4.1.2',
      sanitaryPermits: '5.1.x.x',
      externalCourier: '5.1.2.4.2',
      internalCourier: '5.1.2.4.1',
      physiciansFees: '5.1.4.1.1',
      salesCommission: '6.1.1.06',
    },
    rules: {
      commercialDiscountPct: 0.06, // 6% descuento comercial
      productCostPct: 0.24, // 24% costo del producto
      kitCostUSD: 160, // $160 USD costo del kit
      paymentFeePct: 0.028, // 2.8% fee de pago
      bloodDrawSampleUSD: 55, // $55 USD toma de muestra
      sanitaryPermitsUSD: 90, // $90 USD permisos sanitarios
      externalCourierUSD: 220, // $220 USD courrier externo
      internalCourierUSD: 35, // $35 USD courrier interno
      physiciansFeesUSD: 110, // $110 USD honorarios médicos
      salesCommissionPct: 0.09, // 9% comisión de ventas
    },
  },
  VE: {
    currency: 'USD',
    accounts: {
      grossSales: '4.1.1.6',
      discount: '4.1.1.10',
      productCost: '5.1.1.6',
      kitCost: '5.1.4.1.4',
      bloodDrawSample: '5.1.4.1.2',
      sanitaryPermits: '5.1.x.x',
      externalCourier: '5.1.2.4.2',
      internalCourier: '5.1.2.4.1',
      physiciansFees: '5.1.4.1.1',
      salesCommission: '6.1.1.06',
    },
    rules: {
      commercialDiscountPct: 0.08, // 8% descuento comercial
      productCostPct: 0.18, // 18% costo del producto
      kitCostUSD: 100, // $100 USD costo del kit
      paymentFeePct: 0.045, // 4.5% fee de pago
      bloodDrawSampleUSD: 35, // $35 USD toma de muestra
      sanitaryPermitsUSD: 120, // $120 USD permisos sanitarios
      externalCourierUSD: 250, // $250 USD courrier externo
      internalCourierUSD: 20, // $20 USD courrier interno
      physiciansFeesUSD: 70, // $70 USD honorarios médicos
      salesCommissionPct: 0.10, // 10% comisión de ventas
    },
  },
  CO: {
    currency: 'USD',
    accounts: {
      grossSales: '4.1.1.6',
      discount: '4.1.1.10',
      productCost: '5.1.1.6',
      kitCost: '5.1.4.1.4',
      bloodDrawSample: '5.1.4.1.2',
      sanitaryPermits: '5.1.x.x',
      externalCourier: '5.1.2.4.2',
      internalCourier: '5.1.2.4.1',
      physiciansFees: '5.1.4.1.1',
      salesCommission: '6.1.1.06',
    },
    rules: {
      commercialDiscountPct: 0.035, // 3.5% descuento comercial
      productCostPct: 0.21, // 21% costo del producto
      kitCostUSD: 130, // $130 USD costo del kit
      paymentFeePct: 0.031, // 3.1% fee de pago
      bloodDrawSampleUSD: 42, // $42 USD toma de muestra
      sanitaryPermitsUSD: 70, // $70 USD permisos sanitarios
      externalCourierUSD: 175, // $175 USD courrier externo
      internalCourierUSD: 26, // $26 USD courrier interno
      physiciansFeesUSD: 85, // $85 USD honorarios médicos
      salesCommissionPct: 0.072, // 7.2% comisión de ventas
    },
  },
}

export const COUNTRY_NAMES: Record<CountryCode, string> = {
  UY: 'Uruguay',
  AR: 'Argentina',
  MX: 'México',
  CL: 'Chile',
  VE: 'Venezuela',
  CO: 'Colombia',
}

export const COUNTRY_FLAGS: Record<CountryCode, string> = {
  UY: '🇺🇾',
  AR: '🇦🇷',
  MX: '🇲🇽',
  CL: '🇨🇱',
  VE: '🇻🇪',
  CO: '🇨🇴',
}

// Configuración de IVA por país (en porcentaje)
export const COUNTRY_VAT: Record<CountryCode, number> = {
  UY: 0.22, // 22% IVA en Uruguay
  AR: 0.21, // 21% IVA en Argentina
  MX: 0.16, // 16% IVA en México
  CL: 0.19, // 19% IVA en Chile
  VE: 0.16, // 16% IVA en Venezuela
  CO: 0.19, // 19% IVA en Colombia
}