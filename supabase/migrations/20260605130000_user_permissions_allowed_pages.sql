-- Restricción opcional por hoja/ruta. NULL o {} = acceso a todas las hojas (usuarios existentes).
ALTER TABLE public.user_permissions
  ADD COLUMN IF NOT EXISTS allowed_pages text[] DEFAULT NULL;

COMMENT ON COLUMN public.user_permissions.allowed_pages IS
  'IDs de hojas permitidas (dashboard, productos, medicos, etc.). NULL o vacío = todas.';
