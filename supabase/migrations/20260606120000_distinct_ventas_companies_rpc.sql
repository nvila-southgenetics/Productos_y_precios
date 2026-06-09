-- Lista rápida de compañías (evita escanear ventas_mensuales_view, que hace timeout).
CREATE OR REPLACE FUNCTION public.get_distinct_ventas_companies()
RETURNS SETOF text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT company
  FROM ventas
  WHERE company IS NOT NULL AND btrim(company) <> ''
  ORDER BY 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_distinct_ventas_companies() TO authenticated, service_role;
