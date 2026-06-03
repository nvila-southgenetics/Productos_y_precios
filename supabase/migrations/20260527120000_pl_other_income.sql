-- Other Income por país, mes y cuenta (P&L: entre Total COS y Gross Profit).

create table if not exists public.pl_other_income (
  id uuid primary key default gen_random_uuid(),
  year integer not null,
  month integer not null check (month >= 1 and month <= 12),
  country_code text not null,
  modelo text not null check (modelo in ('real', 'budget')),
  account_name text not null,
  amount_usd numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (year, country_code, month, modelo, account_name)
);

create index if not exists pl_other_income_year_country_modelo_idx
  on public.pl_other_income (year, country_code, modelo);

comment on table public.pl_other_income is
  'Otros ingresos (Other Income) del P&L por país, mes y cuenta contable.';

alter table public.pl_other_income enable row level security;

create policy "pl_other_income_select_authenticated"
  on public.pl_other_income for select
  to authenticated
  using (true);

create policy "pl_other_income_insert_authenticated"
  on public.pl_other_income for insert
  to authenticated
  with check (true);

create policy "pl_other_income_update_authenticated"
  on public.pl_other_income for update
  to authenticated
  using (true)
  with check (true);

create policy "pl_other_income_delete_authenticated"
  on public.pl_other_income for delete
  to authenticated
  using (true);
