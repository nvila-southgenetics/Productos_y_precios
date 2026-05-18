-- Add medico column to ventas
-- - existing rows => medico stays NULL (empty)
-- - new rows without medico => NULL (no default value)

alter table if exists public.ventas
  add column if not exists medico text;
