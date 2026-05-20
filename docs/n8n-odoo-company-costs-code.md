# n8n — Odoo `expense_direct_cost` → Product Cost (Supabase)

Odoo devuelve **varias cuentas** por mes y compañía (`account_id`). Solo algunas son **Product Cost** para `pl_company_monthly_product_cost`. El resto (Kit, Courier, Commission, etc.) corresponde a otras filas del P&L y **no** debe sumarse ahí.

## Nodo 1 — Normalizar respuesta Odoo

Pegá esto en el **Code** después del HTTP Request:

```javascript
// Resultado del HTTP Request (read_group con date:month, company_id, account_id)
const rows = $input.first().json.result ?? [];

const MES_NUM = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};

// Cuentas que NO son Product Cost (mismas líneas que en P&L, salvo Product Cost)
const NON_PRODUCT_COST_PATTERNS = [
  /\bkit\b/i,
  /kit\s*cost/i,
  /payment\s*fee/i,
  /blood/i,
  /sample/i,
  /muestra/i,
  /sanitary/i,
  /permit/i,
  /export\s*blood/i,
  /external\s*courier/i,
  /internal\s*courier/i,
  /courier/i,
  /physician/i,
  /honorario/i,
  /sales\s*commission/i,
  /\bcommission\b/i,
  /comisi[oó]n/i,
  /freight/i,
  /flete/i,
  /logistic/i,
  /env[ií]o/i,
];

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

function classifyAccount(accountName) {
  const name = String(accountName || "").trim();
  if (!name) return "unknown";
  if (NON_PRODUCT_COST_PATTERNS.some((re) => re.test(name))) {
    if (/\bkit\b/i.test(name) || /kit\s*cost/i.test(name)) return "kit";
    if (/payment\s*fee/i.test(name)) return "payment_fee";
    if (/blood|sample|muestra/i.test(name)) return "blood_draw";
    if (/sanitary|permit/i.test(name)) return "sanitary";
    if (/external\s*courier/i.test(name)) return "external_courier";
    if (/internal\s*courier/i.test(name)) return "internal_courier";
    if (/courier/i.test(name)) return "courier";
    if (/physician|honorario/i.test(name)) return "physicians_fees";
    if (/commission|comisi[oó]n/i.test(name)) return "sales_commission";
    return "other_cos";
  }
  return "product_cost";
}

const data = rows.map((r) => {
  const accountId = r.account_id?.[0] ?? null;
  const account = r.account_id?.[1] ?? null;
  const parsed = parseMes(r["date:month"], r.__range?.["date:month"]?.from);
  const balance = Number(r.balance ?? 0);
  const costCategory = classifyAccount(account);

  return {
    mes: r["date:month"],
    year: parsed?.year ?? null,
    month: parsed?.month ?? null,
    company_id: r.company_id?.[0] ?? null,
    company: r.company_id?.[1] ?? null,
    account_id: accountId,
    account,
    balance,
    cost_category: costCategory,
    is_product_cost: costCategory === "product_cost",
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

## Nodo 2 — Solo Product Cost + LLC → upsert Supabase

Después del nodo 1:

```javascript
const raw = $input.all().map((item) => item.json);

const COMPANY_TO_PL = {
  // "Nombre en Odoo": "Nombre en P&L / ventas",
};

const buckets = new Map();

for (const row of raw) {
  if (!row.is_product_cost) continue;

  const companyRaw = String(row.company || "").trim();
  if (!/llc/i.test(companyRaw)) continue;

  const company = COMPANY_TO_PL[companyRaw] || companyRaw;
  const year = row.year;
  const month = row.month;
  if (!year || !month) continue;

  const key = `${year}|${month}|${company}`;
  const prev = buckets.get(key) || { year, month, company, product_cost_usd: 0, accounts: [] };
  prev.product_cost_usd += Number(row.balance || 0);
  prev.accounts.push({
    account_id: row.account_id,
    account: row.account,
    balance: Number(row.balance || 0),
  });
  buckets.set(key, prev);
}

const out = [...buckets.values()]
  .sort((a, b) => a.year - b.year || a.month - b.month || a.company.localeCompare(b.company))
  .map(({ year, month, company, product_cost_usd, accounts }) => ({
    json: {
      year,
      month,
      company,
      product_cost_usd,
      _debug_accounts: accounts,
    },
  }));

return out;
```

En el nodo **Supabase upsert**, mapeá solo: `year`, `month`, `company`, `product_cost_usd` (sin `_debug_accounts`).

## Ajustar nombres de cuenta

Si una cuenta de **Product Cost** en Odoo cae como `other_cos` o al revés, agregá o quitá patrones en `NON_PRODUCT_COST_PATTERNS` en el nodo 1 según el nombre exacto en `account_id[1]`.

Para ver nombres reales, corré solo el nodo 1 y revisá el campo `account` + `cost_category`.
