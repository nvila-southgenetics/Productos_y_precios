-- Cost of Sales contable mensual por compañía y línea (n8n → P&L Real).
-- Reemplaza pl_company_monthly_product_cost (solo product_cost).

create table if not exists public.pl_company_monthly_cos (
  id uuid primary key default gen_random_uuid(),
  year integer not null,
  month integer not null check (month >= 1 and month <= 12),
  company text not null,
  cost_line text not null,
  amount_usd numeric not null default 0,
  updated_at timestamptz not null default now(),
  unique (year, month, company, cost_line)
);

create index if not exists pl_company_monthly_cos_year_company_line_idx
  on public.pl_company_monthly_cos (year, company, cost_line);

comment on table public.pl_company_monthly_cos is
  'COS contable mensual por compañía y línea. Upsert desde n8n. cost_line: product_cost, kit_cost, payment_fee, blood_draw, sanitary, external_courier, internal_courier, physicians_fees, sales_commission';

-- Migrar datos existentes de Product Cost
insert into public.pl_company_monthly_cos (year, month, company, cost_line, amount_usd, updated_at)
select year, month, company, 'product_cost', product_cost_usd, updated_at
from public.pl_company_monthly_product_cost
on conflict (year, month, company, cost_line) do update set
  amount_usd = excluded.amount_usd,
  updated_at = excluded.updated_at;

drop table if exists public.pl_company_monthly_product_cost;

-- Productos "Diferencia" por línea COS (mismo patrón que Diferencia de costos)
insert into public.products (name, alias, base_price, user_id, category, description)
select v.name, v.name, 0, p.id, 'Otros', v.product_desc
from (select id from public.profiles limit 1) p
cross join (
  values
    ('Diferencia de costos', 'Ajuste Product Cost: contable − suma por producto'),
    ('Diferencia - Kit Cost', 'Ajuste Kit Cost: contable − suma por producto'),
    ('Diferencia - Payment Fee', 'Ajuste Payment Fee: contable − suma por producto'),
    ('Diferencia - Blood Draw', 'Ajuste Blood Draw: contable − suma por producto'),
    ('Diferencia - Sanitary Permits', 'Ajuste Sanitary Permits: contable − suma por producto'),
    ('Diferencia - External Courier', 'Ajuste External Courier: contable − suma por producto'),
    ('Diferencia - Internal Courier', 'Ajuste Internal Courier: contable − suma por producto'),
    ('Diferencia - Physicians Fees', 'Ajuste Physicians Fees: contable − suma por producto'),
    ('Diferencia - Sales Commission', 'Ajuste Sales Commission: contable − suma por producto')
) as v(name, product_desc)
where not exists (select 1 from public.products pr where pr.name = v.name);

insert into public.product_country_overrides (product_id, country_code, channel, overrides)
select pr.id, c.code, 'Paciente', '{}'::jsonb
from public.products pr
cross join (
  values ('UY'), ('AR'), ('MX'), ('CL'), ('VE'), ('CO')
) as c(code)
where pr.name like 'Diferencia%'
  and not exists (
    select 1 from public.product_country_overrides o
    where o.product_id = pr.id and o.country_code = c.code and o.channel = 'Paciente'
  );
