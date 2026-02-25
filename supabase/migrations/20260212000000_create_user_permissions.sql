-- Tabla de permisos por usuario: rol y países permitidos
-- Ejecutar en Supabase SQL Editor si no usas CLI de migraciones

CREATE TABLE IF NOT EXISTS public.user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin', 'editor', 'viewer')),
  allowed_countries text[] NOT NULL DEFAULT '{}',
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON public.user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_role ON public.user_permissions(role);

-- Permitir acceso autenticado (RLS se puede ajustar después)
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- Política: usuarios pueden leer su propio permiso
CREATE POLICY "Users can read own permission"
  ON public.user_permissions FOR SELECT
  USING (auth.uid() = user_id);

-- Política: solo admins pueden hacer todo (insert/update/delete)
CREATE POLICY "Admins can manage all permissions"
  ON public.user_permissions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_permissions p
      WHERE p.user_id = auth.uid() AND p.role = 'admin'
    )
  );

-- Comentarios
COMMENT ON TABLE public.user_permissions IS 'Permisos por usuario: rol (admin/editor/viewer) y países permitidos';
COMMENT ON COLUMN public.user_permissions.allowed_countries IS 'Códigos de país permitidos, ej: {UY,AR,MX}. Vacío = ninguno.';
