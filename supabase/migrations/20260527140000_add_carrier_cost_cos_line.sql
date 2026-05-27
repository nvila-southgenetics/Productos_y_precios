-- Producto Diferencia para la línea carrier_cost (P&L Real)

insert into public.products (name, alias, base_price, user_id, category, description)
select v.name, v.name, 0, p.id, 'Otros', v.product_desc
from (select id from public.profiles limit 1) p
cross join (
  values
    ('Diferencia - Carrier Cost', 'Ajuste Carrier Cost: contable − suma por producto')
) as v(name, product_desc)
where not exists (select 1 from public.products pr where pr.name = v.name);

insert into public.product_country_overrides (product_id, country_code, channel, overrides)
select pr.id, c.code, 'Paciente', '{}'::jsonb
from public.products pr
cross join (
  values ('UY'), ('AR'), ('MX'), ('CL'), ('VE'), ('CO')
) as c(code)
where pr.name = 'Diferencia - Carrier Cost'
  and not exists (
    select 1 from public.product_country_overrides o
    where o.product_id = pr.id and o.country_code = c.code and o.channel = 'Paciente'
  );
