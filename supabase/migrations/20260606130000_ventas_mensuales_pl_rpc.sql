-- Agregación rápida de ventas para P&L (evita timeout de ventas_mensuales_view).
CREATE OR REPLACE FUNCTION public.get_ventas_mensuales_pl(
  p_year integer,
  p_companies text[] DEFAULT NULL
)
RETURNS TABLE (
  producto text,
  mes integer,
  "compañia" text,
  cantidad_ventas numeric,
  monto_total numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    v.test AS producto,
    EXTRACT(month FROM v.fecha)::integer AS mes,
    v.company AS "compañia",
    SUM(v.quantity) AS cantidad_ventas,
    SUM(COALESCE(v.amount, 0)) AS monto_total
  FROM ventas v
  WHERE EXTRACT(year FROM v.fecha) = p_year
    AND v.company IS NOT NULL
    AND btrim(v.company) <> ''
    AND (
      p_companies IS NULL
      OR cardinality(p_companies) = 0
      OR v.company = ANY(p_companies)
    )
  GROUP BY v.test, v.company, EXTRACT(month FROM v.fecha)
  ORDER BY mes, producto, v.company;
$$;

GRANT EXECUTE ON FUNCTION public.get_ventas_mensuales_pl(integer, text[]) TO authenticated, service_role;
