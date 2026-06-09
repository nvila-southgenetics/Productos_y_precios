-- Índices para queries frecuentes (ventas, budget, overrides). Sin cambio de lógica de negocio.

CREATE INDEX IF NOT EXISTS idx_ventas_fecha ON public.ventas (fecha);
CREATE INDEX IF NOT EXISTS idx_ventas_company_fecha ON public.ventas (company, fecha);
CREATE INDEX IF NOT EXISTS idx_ventas_medico ON public.ventas (medico) WHERE medico IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ventas_test ON public.ventas (test);

CREATE INDEX IF NOT EXISTS idx_budget_year_name ON public.budget (year, budget_name);
CREATE INDEX IF NOT EXISTS idx_budget_year_name_country ON public.budget (year, budget_name, country_code);
CREATE INDEX IF NOT EXISTS idx_budget_product_id ON public.budget (product_id);

CREATE INDEX IF NOT EXISTS idx_pco_product_country_channel
  ON public.product_country_overrides (product_id, country_code, channel);
