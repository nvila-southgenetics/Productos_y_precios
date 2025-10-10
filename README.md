# SG Contadora

Una aplicación web minimalista y femenina para la gestión contable de productos por país, construida con Next.js 14, TypeScript, TailwindCSS y Supabase.

## 🌸 Características

- **Gestión Completa de Productos**: 
  - ✅ Crear nuevos productos
  - ✅ Ver productos en vista grid o tabla estilo base de datos
  - ✅ Editar productos existentes
  - ✅ Eliminar productos con confirmación
- **Vista Dual**: Alternar entre vista de tarjetas (grid) y tabla de base de datos
- **Vista por País**: Calcula automáticamente costos, comisiones e impuestos por país (Uruguay, Argentina, México)
- **Overrides Personalizados**: Configura valores específicos por producto y país
- **Autenticación Simple**: Sistema de login/registro con email y contraseña usando Supabase por defecto
- **Diseño Minimalista**: Interfaz femenina con paleta de rosas y bordes redondeados
- **Cálculos Automáticos**: Replica la lógica de Google Sheets para cálculos contables

## 🚀 Instalación Rápida

### 1. Clonar e instalar dependencias

```bash
# Instalar dependencias
pnpm install
```

### 2. Configurar Supabase

1. Crea un proyecto en [Supabase](https://supabase.com)
2. Copia el archivo de ejemplo de variables de entorno:

```bash
cp env.example .env.local
```

3. Edita `.env.local` con tus credenciales de Supabase:

```env
NEXT_PUBLIC_SUPABASE_URL=tu_supabase_url_aqui
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_supabase_anon_key_aqui
```

### 3. Configurar la Base de Datos

1. Ve a tu proyecto de Supabase → SQL Editor
2. Ejecuta el script `supabase.sql` para crear las tablas y políticas RLS
3. Opcional: Ejecuta el seed para datos de ejemplo:

```bash
# Necesitas agregar tu SERVICE_ROLE_KEY al .env.local primero
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key_aqui

# Luego ejecutar el seed
pnpm db:seed
```

### 4. Configurar Autenticación (Opcional)

El sistema usa la configuración por defecto de Supabase. Si quieres personalizar:

1. **Ve a tu Dashboard de Supabase**: https://supabase.com/dashboard/project/cdrmxjcdgxjyakrcpxnp
2. **Authentication > Settings** para configurar:
   - Email confirmations (habilitado por defecto)
   - Site URL: `http://localhost:3000`
   - Redirect URLs: `http://localhost:3000`

**Nota**: El sistema funciona con la configuración por defecto de Supabase sin necesidad de configuraciones adicionales.

### 5. Iniciar la aplicación

```bash
pnpm dev
```

La aplicación estará disponible en [http://localhost:3000](http://localhost:3000)

## 📋 Uso

### 1. Iniciar Sesión
- Ve a `/login`
- Si no tienes cuenta, haz clic en "¿No tienes cuenta? Regístrate"
- Completa email y contraseña
- Para registro: confirma tu email cuando recibas el correo (revisa spam)
- Para login: ingresa tus credenciales y accede directamente

**✅ Sistema Simple**: Usa la configuración por defecto de Supabase. No requiere configuraciones adicionales.

### 2. Crear Productos
- Ve a `/products`
- Haz clic en "Nuevo Producto"
- Completa los datos del producto (nombre, SKU, precio base)

### 3. Ver Cálculos por País
- Haz clic en cualquier producto
- Usa las pestañas para alternar entre países (UY, AR, MX)
- La tabla muestra automáticamente:
  - Gross Sales (precio base)
  - Commercial Discount
  - Sales Revenue
  - Cost of Sales (desglosado)
  - Gross Profit

### 4. Configurar Overrides
- En la vista del producto, haz clic en "Editar Parámetros"
- Modifica valores específicos para ese país
- Los cambios se aplican inmediatamente al cálculo

## 🏗️ Arquitectura

```
src/
├── app/                    # App Router de Next.js 14
│   ├── (auth)/            # Rutas de autenticación
│   ├── products/          # Páginas de productos
│   └── globals.css        # Estilos globales
├── components/            # Componentes React
│   ├── ui/               # Componentes base (shadcn/ui)
│   └── *.tsx             # Componentes específicos
├── lib/                  # Utilidades y lógica
│   ├── supabase.ts       # Cliente Supabase
│   ├── countryRates.ts   # Datos hardcodeados por país
│   ├── compute.ts        # Lógica de cálculos
│   └── utils.ts          # Utilidades generales
└── types/                # Definiciones de TypeScript
```

## 🎨 Diseño

- **Paleta**: Rosa como color primario, con variantes suaves
- **Tipografía**: Inter para texto, Nunito para títulos
- **Componentes**: Bordes redondeados (rounded-2xl), sombras suaves
- **Microinteracciones**: Transiciones suaves, hover states
- **Responsive**: Diseño adaptable a móviles y desktop

## 🔧 Configuración Avanzada

### Países Soportados
Actualmente soporta Uruguay (UY), Argentina (AR) y México (MX). Para agregar más países:

1. Actualiza `CountryCode` en `src/types.ts`
2. Agrega datos en `src/lib/countryRates.ts`
3. Actualiza la validación en la base de datos

### Cálculos Personalizados
La lógica de cálculo está en `src/lib/compute.ts`. Puedes modificar:
- Fórmulas de cálculo
- Nuevos tipos de costos
- Lógica de porcentajes

### Roles de Usuario
- **User**: Puede ver productos y cálculos
- **Admin**: Puede crear, editar y eliminar productos

## 🚨 Troubleshooting

### Error de autenticación
- Verifica que las variables de entorno estén correctas
- Asegúrate de que el proyecto de Supabase esté activo

### Error de base de datos
- Ejecuta el script `supabase.sql` completo
- Verifica que las políticas RLS estén configuradas

### Error de cálculos
- Verifica que los datos del país estén en `countryRates.ts`
- Revisa que los overrides estén en formato JSON válido

## 📝 Scripts Disponibles

```bash
pnpm dev          # Desarrollo
pnpm build        # Build para producción
pnpm start        # Iniciar en producción
pnpm lint         # Linter
pnpm db:seed      # Poblar con datos de ejemplo
```

## 🤝 Contribución

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Ver `LICENSE` para más detalles.

---

**SG Contadora** - Diseñado con 💕 para la gestión contable moderna
