-- Add institucion column to ventas
-- - existing rows => institucion stays NULL (empty)
-- - new rows without institucion => NULL (no default value)

alter table if exists public.ventas
  add column if not exists institucion text;
