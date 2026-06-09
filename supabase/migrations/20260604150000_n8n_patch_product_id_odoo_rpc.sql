-- RPC para que n8n (anon/service) pueda asignar id_odoo sin RLS auth.uid() = user_id

create or replace function public.patch_product_id_odoo(p_id uuid, p_id_odoo integer)
returns public.products
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.products;
begin
  update public.products
  set id_odoo = p_id_odoo
  where id = p_id
  returning * into row;

  if row.id is null then
    raise exception 'Producto no encontrado: %', p_id;
  end if;

  return row;
end;
$$;

create or replace function public.bulk_patch_products_id_odoo(payload jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  n integer := 0;
begin
  if payload is null or jsonb_typeof(payload) <> 'array' then
    return 0;
  end if;

  for item in select * from jsonb_array_elements(payload)
  loop
    perform public.patch_product_id_odoo(
      (item->>'id')::uuid,
      (item->>'id_odoo')::integer
    );
    n := n + 1;
  end loop;

  return n;
end;
$$;

grant execute on function public.patch_product_id_odoo(uuid, integer) to anon, authenticated, service_role;
grant execute on function public.bulk_patch_products_id_odoo(jsonb) to anon, authenticated, service_role;
