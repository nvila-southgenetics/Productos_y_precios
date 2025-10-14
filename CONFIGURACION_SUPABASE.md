# Configuración de Supabase para SG Contadora

## Configuración de Autenticación

Para desactivar la confirmación de email y simplificar el registro:

1. Ve al Dashboard de Supabase: https://supabase.com/dashboard
2. Selecciona tu proyecto: `sg_pyl`
3. Ve a **Authentication** > **Settings**
4. En la sección **Email**:
   - Desactiva **Enable email confirmations**
   - Esto permitirá que los usuarios se registren sin confirmar email

## Configuración de Email Templates (Opcional)

Si quieres mantener la confirmación de email más adelante:

1. Ve a **Authentication** > **Email Templates**
2. Personaliza los templates según necesites
3. En **Site URL**, configura: `http://localhost:3000`

## Políticas RLS Actualizadas

Las políticas de Row Level Security ya están configuradas correctamente:

- ✅ **products**: Todos los usuarios autenticados pueden crear, leer, actualizar y eliminar productos
- ✅ **product_country_overrides**: Todos los usuarios autenticados pueden crear, leer, actualizar y eliminar overrides
- ✅ **profiles**: Los usuarios solo pueden ver y editar su propio perfil

## Verificación

Para verificar que todo funciona:

1. Registra un nuevo usuario (no necesitará confirmar email)
2. Inicia sesión inmediatamente
3. Crea un producto nuevo
4. Verifica que no aparezcan errores de RLS

## Notas

- Los usuarios se crean automáticamente en la tabla `profiles` con rol `user`
- El sistema está configurado para ser simple y directo
- No se requiere confirmación de email para usar la aplicación
