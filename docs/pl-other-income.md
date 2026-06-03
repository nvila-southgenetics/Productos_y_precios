# Other Income (P&L)

Línea **Other Income** entre **Total Cost of Sales** y **Gross Profit**.

## Fórmula

`Gross Profit = Sales Revenue − Total Cost of Sales + Other Income`

## Tabla `pl_other_income`

| Campo | Descripción |
|-------|-------------|
| `year`, `month` | Período |
| `company` | Compañía Odoo/ventas (ej. `SouthGenetics LLC Argentina`) — **mismo texto que en n8n** |
| `modelo` | Siempre **`real`** (solo P&L Real; Budget no usa Other Income) |
| `account_name` | Nombre de la cuenta contable |
| `amount_usd` | Monto del mes en USD (**positivo** = ingreso) |

**Clave única:** `(year, company, month, modelo, account_name)`

## Uso en la app

1. P&L → expandir **Other Income**.
2. **Agregar cuenta** o cargar desde n8n.
3. **Doble clic** en un mes para editar (requiere **una sola compañía** en el filtro del P&L).

Con varias compañías tildadas se **suman** las cuentas con el mismo nombre para mostrar totales.

---

## Carga desde n8n (nodo Supabase)

### Credencial

**`service_role`** de Supabase (Settings → API).

### Payload (upsert)

```json
{
  "year": 2026,
  "month": 1,
  "company": "SouthGenetics LLC Argentina",
  "modelo": "real",
  "account_name": "Intereses ganados",
  "amount_usd": 1250.5
}
```

**On conflict:** `year,company,month,modelo,account_name`

No hace falta mapear a `country_code`: usá el mismo `company` que devuelve Odoo (`company_id[1]`).

### Nodo Supabase

| Campo | Mapeo |
|-------|--------|
| `year` | `{{ $json.year }}` |
| `month` | `{{ $json.month }}` |
| `company` | `{{ $json.company }}` |
| `modelo` | **`real`** (fijo; no usar `budget`) |
| `account_name` | `{{ $json.account }}` |
| `amount_usd` | `{{ $json.amount_usd }}` |

### HTTP Request (alternativa)

```
POST https://<PROJECT>.supabase.co/rest/v1/pl_other_income?on_conflict=year,company,month,modelo,account_name
```

Headers: `apikey`, `Authorization: Bearer <SERVICE_ROLE>`, `Prefer: resolution=merge-duplicates`

### Nodo Code — desde Odoo normalizado

Reutilizá el formato de [`n8n-odoo-company-costs-code.md`](./n8n-odoo-company-costs-code.md) (`year`, `month`, `company`, `account`, `balance`).

```javascript
const OTHER_INCOME_ACCOUNT_PATTERNS = [
  /interes/i,
  /other income/i,
  /otros ingresos/i,
];

function isOtherIncomeAccount(accountLabel) {
  const s = String(accountLabel || "");
  return OTHER_INCOME_ACCOUNT_PATTERNS.some((re) => re.test(s));
}

const modelo = "real";
const out = [];

for (const item of $input.all()) {
  const j = item.json;
  if (!j.year || !j.month || !j.company || !j.account) continue;
  if (!isOtherIncomeAccount(j.account)) continue;

  const company = String(j.company).trim();
  const raw = Number(j.balance ?? 0);
  const amount_usd = Math.abs(raw);

  out.push({
    json: {
      year: j.year,
      month: j.month,
      company,
      modelo,
      account_name: String(j.account).trim(),
      amount_usd,
    },
  });
}

return out;
```

### Flujo n8n

Odoo → Code normalizar → Code filtrar Other Income → Supabase upsert `pl_other_income`

### Errores frecuentes

| Problema | Causa |
|----------|--------|
| No aparece en P&L | `company` distinto al del filtro (espacios, typo, “Arge” vs “Argentina”) |
| No edita en app | Más de una compañía seleccionada en P&L |
| Duplicados | Upsert sin `on_conflict` en las 5 columnas clave |
| Signo invertido | Ajustar `amount_usd` en Code según convención Odoo |

Nombres de compañía válidos (ejemplos): `SouthGenetics LLC Argentina`, `SouthGenetics LLC Uruguay`, `Southgenetics LLC Chile`, `SouthGenetics LLC Colombia`, `SouthGenetics LLC México`, `SouthGenetics LLC Venezuela`, `SouthGenetics LLC`.

