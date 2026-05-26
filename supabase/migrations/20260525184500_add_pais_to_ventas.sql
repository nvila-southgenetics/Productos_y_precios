-- Add pais column to ventas
-- - existing rows => pais stays NULL (empty)
-- - new rows without pais => NULL (no default value)

alter table if exists public.ventas
  add column if not exists pais text;
