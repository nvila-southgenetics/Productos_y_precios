-- RPCs rápidos sobre ventas (reemplazan ventas_mensuales_view en la app).

CREATE OR REPLACE FUNCTION public.get_distinct_ventas_products(p_years integer[] DEFAULT NULL)
RETURNS SETOF text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT v.test
  FROM ventas v
  WHERE v.test IS NOT NULL
    AND btrim(v.test) <> ''
    AND (
      p_years IS NULL
      OR cardinality(p_years) = 0
      OR EXTRACT(year FROM v.fecha)::integer = ANY(p_years)
    )
  ORDER BY 1;
$$;

CREATE OR REPLACE FUNCTION public.get_distinct_ventas_periods(p_companies text[] DEFAULT NULL)
RETURNS SETOF text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT to_char(v.fecha, 'YYYY-MM')
  FROM ventas v
  WHERE v.company IS NOT NULL
    AND btrim(v.company) <> ''
    AND (
      p_companies IS NULL
      OR cardinality(p_companies) = 0
      OR v.company = ANY(p_companies)
    )
  ORDER BY 1;
$$;

CREATE OR REPLACE FUNCTION public.get_ventas_mensuales_agg(
  p_years integer[] DEFAULT NULL,
  p_companies text[] DEFAULT NULL,
  p_products text[] DEFAULT NULL,
  p_periodo text DEFAULT NULL,
  p_month_from integer DEFAULT NULL,
  p_month_to integer DEFAULT NULL
)
RETURNS TABLE (
  producto text,
  mes integer,
  año integer,
  periodo text,
  "compañia" text,
  cantidad_ventas numeric,
  monto_total numeric,
  precio_promedio numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    g.producto,
    g.mes,
    g.año,
    g.periodo,
    g."compañia",
    g.cantidad_ventas,
    g.monto_total,
    ROUND(g.monto_total / NULLIF(g.cantidad_ventas, 0), 2) AS precio_promedio
  FROM (
    SELECT
      v.test AS producto,
      EXTRACT(month FROM date_trunc('month', v.fecha::timestamp))::integer AS mes,
      EXTRACT(year FROM date_trunc('month', v.fecha::timestamp))::integer AS año,
      to_char(date_trunc('month', v.fecha::timestamp), 'YYYY-MM') AS periodo,
      v.company AS "compañia",
      SUM(v.quantity) AS cantidad_ventas,
      SUM(COALESCE(v.amount, 0)) AS monto_total
    FROM ventas v
    WHERE v.company IS NOT NULL
      AND btrim(v.company) <> ''
      AND (
        p_years IS NULL
        OR cardinality(p_years) = 0
        OR EXTRACT(year FROM v.fecha)::integer = ANY(p_years)
      )
      AND (
        p_companies IS NULL
        OR cardinality(p_companies) = 0
        OR v.company = ANY(p_companies)
      )
      AND (
        p_products IS NULL
        OR cardinality(p_products) = 0
        OR v.test = ANY(p_products)
      )
      AND (
        p_periodo IS NULL
        OR to_char(date_trunc('month', v.fecha::timestamp), 'YYYY-MM') = p_periodo
      )
      AND (p_month_from IS NULL OR EXTRACT(month FROM v.fecha)::integer >= p_month_from)
      AND (p_month_to IS NULL OR EXTRACT(month FROM v.fecha)::integer <= p_month_to)
    GROUP BY v.test, v.company, date_trunc('month', v.fecha::timestamp)
  ) g
  ORDER BY g.año DESC, g.mes DESC, g.producto, g."compañia";
$$;

GRANT EXECUTE ON FUNCTION public.get_distinct_ventas_products(integer[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_distinct_ventas_periods(text[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_ventas_mensuales_agg(integer[], text[], text[], text, integer, integer) TO authenticated, service_role;
