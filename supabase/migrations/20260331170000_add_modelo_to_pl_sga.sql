-- Add modelo column to pl_sga to separate budget vs real
-- Requirements:
-- - existing rows => modelo='budget'
-- - no default for new rows
-- - uniqueness/upserts must include modelo to avoid collisions between models

alter table if exists public.pl_sga
  add column if not exists modelo text;

update public.pl_sga
set modelo = 'budget'
where modelo is null;

-- Drop legacy unique constraint/index that doesn't include modelo
do $$
declare
  c record;
  idx record;
  cols text[];
begin
  -- Drop UNIQUE constraints on (year,country_code,month,product_name,channel)
  for c in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where con.contype = 'u'
      and nsp.nspname = 'public'
      and rel.relname = 'pl_sga'
  loop
    select array_agg(att.attname order by x.ord) into cols
    from (
      select unnest(con.conkey) as attnum, generate_subscripts(con.conkey, 1) as ord
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace nsp on nsp.oid = rel.relnamespace
      where con.contype = 'u'
        and nsp.nspname = 'public'
        and rel.relname = 'pl_sga'
        and con.conname = c.conname
    ) x
    join pg_attribute att on att.attrelid = 'public.pl_sga'::regclass and att.attnum = x.attnum;

    if cols = array['year','country_code','month','product_name','channel'] then
      execute format('alter table public.pl_sga drop constraint %I', c.conname);
    end if;
  end loop;

  -- Drop UNIQUE indexes (not backed by a constraint) on legacy 5-column key
  for idx in
    select i.relname as index_name
    from pg_index ix
    join pg_class t on t.oid = ix.indrelid
    join pg_namespace nsp on nsp.oid = t.relnamespace
    join pg_class i on i.oid = ix.indexrelid
    left join pg_constraint con on con.conindid = ix.indexrelid
    where nsp.nspname = 'public'
      and t.relname = 'pl_sga'
      and ix.indisunique
      and not ix.indisprimary
      and con.oid is null
  loop
    select array_agg(att.attname order by k.ord) into cols
    from (
      select unnest(ix.indkey) as attnum, generate_subscripts(ix.indkey, 1) as ord
      from pg_index ix
      where ix.indexrelid = (select oid from pg_class where relname = idx.index_name)
    ) k
    join pg_attribute att on att.attrelid = 'public.pl_sga'::regclass and att.attnum = k.attnum;

    if cols = array['year','country_code','month','product_name','channel'] then
      execute format('drop index public.%I', idx.index_name);
    end if;
  end loop;
end $$;

-- New unique key INCLUDING modelo (no default, but must be present for uniqueness/upserts)
alter table public.pl_sga
  add constraint pl_sga_year_country_month_product_channel_modelo_key
  unique (year, country_code, month, product_name, channel, modelo);

