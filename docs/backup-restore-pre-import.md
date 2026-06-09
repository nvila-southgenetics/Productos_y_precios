# Respaldo antes de import n8n

## Respaldo actual (2026-06-04 13:11:38 UTC)

| Qué | Dónde |
|-----|--------|
| JSON local | `exports/backups/pre-import-20260604_131138/` |
| Tabla ventas | `public.backup_ventas_pre_import_20260604_131138` (4026 filas) |
| Tabla products | `public.backup_products_pre_import_20260604_131138` (217 filas) |
| Manifest | `exports/backups/pre-import-20260604_131138/manifest.json` |

## Crear un nuevo respaldo

```bash
node scripts/backup-pre-import.mjs
```

Luego ejecutá el SQL generado en `create-backup-tables.sql` (o pedí que se aplique vía Supabase MCP).

## Revertir solo ventas (lo más habitual)

En **Supabase → SQL Editor**:

```sql
TRUNCATE public.ventas;
INSERT INTO public.ventas
SELECT * FROM public.backup_ventas_pre_import_20260604_131138;
```

## Revertir ventas y products

```sql
TRUNCATE public.products CASCADE;
INSERT INTO public.products
SELECT * FROM public.backup_products_pre_import_20260604_131138;

TRUNCATE public.ventas;
INSERT INTO public.ventas
SELECT * FROM public.backup_ventas_pre_import_20260604_131138;
```

`CASCADE` en products solo si hay FKs que lo exijan; si falla, truncá ventas primero y después products.

## Revertir desde JSON (si borraste las tablas backup)

1. `TRUNCATE public.ventas;` (manual en SQL Editor)
2. Subir de nuevo con un script de insert por lotes desde `ventas.json` (contactar / extender `restore-pre-import.mjs`).

## Borrar respaldos viejos (cuando ya no los necesites)

```sql
DROP TABLE IF EXISTS public.backup_ventas_pre_import_20260604_131138;
DROP TABLE IF EXISTS public.backup_products_pre_import_20260604_131138;
```

No commitear `exports/backups/` si son muy grandes; están en `.gitignore` recomendado.
