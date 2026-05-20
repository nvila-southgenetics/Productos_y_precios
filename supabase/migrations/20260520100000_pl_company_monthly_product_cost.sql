-- Product Cost real mensual por compañía (carga vía n8n).
-- La app reconcilia: real_total - suma(productos) → producto "Diferencia de costos".

create table if not exists public.pl_company_monthly_product_cost (
  id uuid primary key default gen_random_uuid(),
  year integer not null,
  month integer not null check (month >= 1 and month <= 12),
  company text not null,
  product_cost_usd numeric not null default 0,
  updated_at timestamptz not null default now(),
  unique (year, month, company)
);

create index if not exists pl_company_monthly_product_cost_year_company_idx
  on public.pl_company_monthly_product_cost (year, company);

comment on table public.pl_company_monthly_product_cost is
  'Product Cost contable mensual por compañía. Upsert desde n8n.';

-- Producto catálogo para absorber la diferencia (si existe un perfil para user_id).
insert into public.products (name, alias, base_price, user_id, category, description)
select
  'Diferencia de costos',
  'Diferencia de costos',
  0,
  p.id,
  'Otros',
  'Ajuste entre Product Cost contable y la suma por producto en P&L Real'
from public.profiles p
where not exists (select 1 from public.products pr where pr.name = 'Diferencia de costos')
limit 1;

-- Overrides vacíos Paciente por país para el producto Diferencia (si se creó arriba).
insert into public.product_country_overrides (product_id, country_code, channel, overrides)
select pr.id, c.code, 'Paciente', '{}'::jsonb
from public.products pr
cross join (
  values ('UY'), ('AR'), ('MX'), ('CL'), ('VE'), ('CO')
) as c(code)
where pr.name = 'Diferencia de costos'
  and not exists (
    select 1 from public.product_country_overrides o
    where o.product_id = pr.id and o.country_code = c.code and o.channel = 'Paciente'
  );
