-- Clave única para upsert PostgREST / n8n (on_conflict=company,fecha,move_id,id_producto,partner).
-- Reemplaza índice parcial ventas_unique_move_line (PostgREST no infiere partial indexes).

drop index if exists public.ventas_unique_move_line;

create unique index if not exists ventas_upsert_key
  on public.ventas (company, fecha, move_id, id_producto, partner);

comment on index public.ventas_upsert_key is
  'Dedup ventas import Odoo/n8n; usado por on_conflict en bulk upsert.';
