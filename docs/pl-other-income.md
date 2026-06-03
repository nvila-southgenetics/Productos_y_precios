# Other Income (P&L)

Línea **Other Income** entre **Total Cost of Sales** y **Gross Profit**.

## Fórmula

`Gross Profit = Sales Revenue − Total Cost of Sales + Other Income`

## Tabla `pl_other_income`

| Campo | Descripción |
|-------|-------------|
| `year`, `month` | Período |
| `country_code` | País (UY, AR, …) |
| `modelo` | `real` o `budget` |
| `account_name` | Nombre de la cuenta contable (libre) |
| `amount_usd` | Monto del mes |

**Clave única:** `(year, country_code, month, modelo, account_name)`

## Uso en la app

1. P&L → expandir **Other Income** (chevron).
2. **Agregar cuenta** → nombre de la cuenta.
3. **Doble clic** en un mes para cargar el monto (requiere **un solo país** seleccionado, como impuestos/SG&A país).

Con varios países en el filtro se **suman** las cuentas de todos para mostrar totales; la edición solo con un país.
