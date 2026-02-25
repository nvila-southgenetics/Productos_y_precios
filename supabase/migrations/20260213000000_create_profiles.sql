-- Tabla profiles: un registro por usuario con rol global (user | admin)
-- Ejecutar en Supabase SQL Editor o con: supabase db push

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'admin')) DEFAULT 'user',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

COMMENT ON TABLE public.profiles IS 'Perfil por usuario: rol global user o admin';
COMMENT ON COLUMN public.profiles.role IS 'user = usuario normal, admin = administrador';

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Cada usuario puede leer su propio perfil
DO $$ BEGIN
  CREATE POLICY "Users can read own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Solo un admin puede actualizar perfiles
DO $$ BEGIN
  CREATE POLICY "Admins can update profiles"
    ON public.profiles FOR UPDATE
    USING (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role = 'admin'
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Solo un admin puede insertar perfiles
DO $$ BEGIN
  CREATE POLICY "Admins can insert profiles"
    ON public.profiles FOR INSERT
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role = 'admin'
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Service role bypass para operaciones admin (las API routes usan service_role)
-- Service role ya tiene bypass de RLS por defecto en Supabase

-- Trigger: crear perfil con rol 'user' al registrarse un nuevo usuario en auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, role)
  VALUES (new.id, 'user')
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill: crear perfiles para usuarios que ya existen en user_permissions
INSERT INTO public.profiles (id, role)
  SELECT user_id, CASE WHEN role = 'admin' THEN 'admin' ELSE 'user' END
  FROM public.user_permissions
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, updated_at = now();

-- Actualizar RLS de user_permissions para que "admin" se consulte desde profiles
DROP POLICY IF EXISTS "Admins can manage all permissions" ON public.user_permissions;
CREATE POLICY "Admins can manage all permissions"
  ON public.user_permissions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );
