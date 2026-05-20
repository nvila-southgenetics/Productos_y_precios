# n8n — Odoo `expense_direct_cost` → Product Cost (Supabase)

Odoo devuelve **varias cuentas** por mes y compañía (`account_id`). Solo algunas son **Product Cost** para `pl_company_monthly_product_cost`. El resto (Kit, Courier, Commission, etc.) corresponde a otras filas del P&L y **no** debe sumarse ahí.

## Nodo 1 — Normalizar respuesta Odoo (sin filtrar ni clasificar)

Un ítem por fila del `read_group`. El filtro por cuenta / LLC / Product Cost lo hacés vos en nodos siguientes.

```javascript
const rows = $input.first().json.result ?? [];

const MES_NUM = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};

function parseMes(mesStr, desde) {
  if (mesStr) {
    const parts = String(mesStr).trim().toLowerCase().split(/\s+/);
    const mesNombre = parts[0].normalize("NFD").replace(/\p{M}/gu, "");
    const year = Number(parts[1]);
    const month = MES_NUM[mesNombre];
    if (month && year) return { year, month };
  }
  if (desde) {
    const d = new Date(desde);
    if (!isNaN(d.getTime())) {
      return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
    }
  }
  return null;
}

const data = rows.map((r) => {
  const parsed = parseMes(r["date:month"], r.__range?.["date:month"]?.from);
  return {
    mes: r["date:month"] ?? null,
    year: parsed?.year ?? null,
    month: parsed?.month ?? null,
    company_id: r.company_id?.[0] ?? null,
    company: r.company_id?.[1] ?? null,
    account_id: r.account_id?.[0] ?? null,
    account: r.account_id?.[1] ?? null,
    balance: Number(r.balance ?? 0),
    cantidad_movimientos: r.__count ?? 0,
    desde: r.__range?.["date:month"]?.from ?? null,
    hasta: r.__range?.["date:month"]?.to ?? null,
  };
});

data.sort((a, b) => {
  if ((a.desde || "") < (b.desde || "")) return -1;
  if ((a.desde || "") > (b.desde || "")) return 1;
  const c = (a.company || "").localeCompare(b.company || "");
  if (c !== 0) return c;
  return (a.account || "").localeCompare(b.account || "");
});

return data.map((d) => ({ json: d }));
```

## Nodo 2 en adelante (vos)

Desde ahí podés filtrar por `account`, LLC, sumar por mes/compañía y armar el upsert a `pl_company_monthly_product_cost` cuando corresponda. Ver [`pl-company-product-cost.md`](./pl-company-product-cost.md) para el payload de Supabase.
