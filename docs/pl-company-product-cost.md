# Cost of Sales contable por compañía (n8n → P&L)

La tabla `pl_company_monthly_cos` guarda el **monto contable mensual** por compañía y **línea COS**. La app reconcilia cada fila del P&L Real (mismo criterio que Product Cost).

## Líneas (`cost_line`)

| `cost_line` | Fila P&L | Producto Diferencia |
|-------------|----------|---------------------|
| `product_cost` | Product Cost | Diferencia de costos |
| `kit_cost` | Kit Cost | Diferencia - Kit Cost |
| `payment_fee` | Payment Fee Costs | Diferencia - Payment Fee |
| `blood_draw` | Blood Drawn & Sample Handling | Diferencia - Blood Draw |
| `sanitary` | Sanitary Permits… | Diferencia - Sanitary Permits |
| `external_courier` | External Courier | Diferencia - External Courier |
| `internal_courier` | Internal Courier | Diferencia - Internal Courier |
| `physicians_fees` | Physicians Fees | Diferencia - Physicians Fees |
| `sales_commission` | Sales Commission | Diferencia - Sales Commission |

## Upsert (n8n / Supabase)

**Tabla:** `pl_company_monthly_cos`

**Clave única:** `(year, month, company, cost_line)`

**Payload:**

```json
{
  "year": 2026,
  "month": 5,
  "company": "SouthGenetics LLC Uruguay",
  "cost_line": "product_cost",
  "amount_usd": 34892
}
```

```js
await supabase.from("pl_company_monthly_cos").upsert(
  {
    year: 2026,
    month: 5,
    company: "SouthGenetics LLC Uruguay",
    cost_line: "kit_cost",
    amount_usd: 1200,
  },
  { onConflict: "year,month,company,cost_line" }
)
```

Una fila por mes, compañía y línea. Ver normalización Odoo en [`n8n-odoo-company-costs-code.md`](./n8n-odoo-company-costs-code.md).

## Comportamiento en P&L (Real)

Con **todos los productos** (o datos contables cargados para el filtro):

1. Suma `override × unidades` por producto (sin el producto Diferencia de esa línea).
2. `diferencia = contable − suma`.
3. Total de la fila = **contable**.
4. El producto **Diferencia - …** absorbe el ajuste.

Migración desde `pl_company_monthly_product_cost`: `20260521100000_pl_company_monthly_cos.sql`.
