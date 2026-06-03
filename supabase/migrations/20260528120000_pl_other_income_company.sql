-- Other Income: almacenar por compañía (como Odoo/n8n), no por country_code.

alter table public.pl_other_income
  add column if not exists company text;

update public.pl_other_income
set company = case country_code
  when 'AR' then 'SouthGenetics LLC Argentina'
  when 'UY' then 'SouthGenetics LLC Uruguay'
  when 'CL' then 'Southgenetics LLC Chile'
  when 'CO' then 'SouthGenetics LLC Colombia'
  when 'MX' then 'SouthGenetics LLC México'
  when 'VE' then 'SouthGenetics LLC Venezuela'
  else 'SouthGenetics LLC'
end
where company is null and country_code is not null;

delete from public.pl_other_income where company is null;

alter table public.pl_other_income
  alter column company set not null;

alter table public.pl_other_income
  drop constraint if exists pl_other_income_year_country_code_month_modelo_account_name_key;

alter table public.pl_other_income
  drop column if exists country_code;

drop index if exists pl_other_income_year_country_modelo_idx;

create index if not exists pl_other_income_year_company_modelo_idx
  on public.pl_other_income (year, company, modelo);

alter table public.pl_other_income
  add constraint pl_other_income_year_company_month_modelo_account_name_key
  unique (year, company, month, modelo, account_name);

comment on column public.pl_other_income.company is
  'Compañía Odoo/ventas (ej. SouthGenetics LLC Argentina). Mismo texto que en n8n.';
