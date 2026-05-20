# Product Cost real por compañía (n8n → P&L)

La tabla `pl_company_monthly_product_cost` guarda el **Product Cost contable** mensual por compañía. La app lo usa solo en **P&L Real** con **todos los productos** seleccionados para reconciliar la fila Product Cost.

## Filtro en n8n (Odoo por `account_id`)

El HTTP Request agrupa por `date:month`, `company_id` y `account_id`. **No** subas todo `expense_direct_cost` a Product Cost: excluir cuentas tipo Kit, Courier, Commission, etc.

Ver nodos Code listos en [`n8n-odoo-company-costs-code.md`](./n8n-odoo-company-costs-code.md).

## Upsert (n8n / REST Supabase)

**Tabla:** `pl_company_monthly_product_cost`

**Clave única:** `(year, month, company)`

**Payload por fila:**

```json
{
  "year": 2026,
  "month": 3,
  "company": "SouthGenetics LLC Argentina",
  "product_cost_usd": 125430.50
}
```

- `year`: año del modelo P&L (2025 o 2026).
- `month`: entero 1–12.
- `company`: texto **exactamente igual** al usado en ventas / filtros P&L (mismos valores que devuelve `getCompanies()` en la app).
- `product_cost_usd`: total real del mes en USD (sin desglose por producto).

### Ejemplo con PostgREST (Supabase)

`POST` o `PATCH` con header `Prefer: resolution=merge-duplicates` y query `on_conflict=year,month,company`, o usar el cliente Supabase:

```js
await supabase.from("pl_company_monthly_product_cost").upsert(
  { year: 2026, month: 3, company: "SouthGenetics LLC Argentina", product_cost_usd: 125430.5 },
  { onConflict: "year,month,company" }
)
```

Tras cada carga, al refrescar P&L la app recalcula la diferencia; **no hace falta un segundo paso en n8n**.

## Comportamiento en P&L

1. Suma `productCostUSD × unidades` de todos los productos **excepto** «Diferencia de costos».
2. `diferencia = real − suma` por mes (agregando compañías del filtro).
3. El total de **Product Cost** en P&L = **real**.
4. El producto **«Diferencia de costos»** absorbe ese ajuste en el desglose.

Si falta dato real para un mes/compañía, `diferencia = 0` (solo suma por productos, como antes).

Si el usuario filtra **uno o más productos** y no incluye «Diferencia de costos», no se fuerza el total al real.

## Producto catálogo

«Diferencia de costos» se crea en la migración `20260520100000_pl_company_monthly_product_cost.sql` con overrides vacíos por país (canal Paciente). **n8n no debe escribir overrides** de ese producto.
