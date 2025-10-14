# SG Contadora ✨

Una aplicación web rosa y femenina para la gestión contable de productos por país, construida con Next.js 14, TypeScript, TailwindCSS y Supabase.

## 🌸 Características

- **Gestión Completa de Productos**: 
  - ✅ Crear nuevos productos
  - ✅ Ver productos en vista grid o tabla estilo base de datos
  - ✅ Editar productos existentes
  - ✅ Eliminar productos con confirmación
- **Comparación de Países**: Vista lado a lado para comparar hasta 4 países simultáneamente ✨
- **Conversión Automática USD ↔ %**: Todos los impuestos pueden ingresarse en dólares o porcentaje y se convierten automáticamente 💰
- **Vista Dual**: Alternar entre vista de tarjetas (grid) y tabla de base de datos
- **Vista por País**: Calcula automáticamente costos, comisiones e impuestos por país (UY, AR, MX, CL, VE, CO)
- **Overrides Personalizados**: Configura valores específicos por producto y país
- **Autenticación Simple**: Sistema de login/registro con email y contraseña usando Supabase
- **Diseño Rosa y Femenino**: Interfaz con paleta rosa pastel, header fucsia, cursor de corazón 💕 y brillitos ✨
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

### 4. Iniciar la aplicación

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

### 2. Crear Productos
- Ve a `/products`
- Haz clic en "Nuevo Producto"
- Completa los datos del producto (nombre, SKU, precio base)

### 3. Comparar Países ✨
- En la lista de productos, haz clic en "Comparar Países"
- Selecciona hasta 4 países para ver lado a lado
- Compara campo por campo fácilmente

### 4. Editar Impuestos en USD o %
- Haz doble clic en cualquier valor USD o %
- Si editas USD → se calcula el % automáticamente
- Si editas % → se calcula el USD automáticamente
- Los cambios se guardan automáticamente

## 🏗️ Arquitectura

```
src/
├── app/                    # App Router de Next.js 14
│   ├── products/          # Páginas de productos
│   │   ├── compare/[id]/ # Vista de comparación de países
│   │   └── [id]/         # Vista detallada de producto
│   └── globals.css        # Estilos globales con brillitos ✨
├── components/            # Componentes React
│   ├── ui/               # Componentes base (shadcn/ui)
│   ├── Navbar.tsx        # Header fucsia con brillitos
│   └── ProductCountryTable.tsx  # Tabla editable USD/% 
├── lib/                  # Utilidades y lógica
│   ├── supabase.ts       # Cliente Supabase
│   ├── countryRates.ts   # Datos hardcodeados por país
│   ├── compute.ts        # Lógica de cálculos con conversión USD/% 
│   └── utils.ts          # Utilidades generales
└── types/                # Definiciones de TypeScript
```

## 🎨 Diseño Rosa y Femenino

- **Fondo**: Rosa pastel en lugar de blanco
- **Header**: Fucsia con gradiente (fuchsia-500 a pink-500)
- **Cursor**: Forma de corazón 💕
- **Brillitos**: Animaciones ✨ y 💫 por toda la app
- **Paleta**: Rosa/fucsia/pink en todos los componentes
- **Tipografía**: Inter para texto, Nunito para títulos
- **Componentes**: Bordes redondeados, sombras suaves
- **Responsive**: Diseño adaptable a móviles y desktop

## 🔧 Configuración Avanzada

### Países Soportados
Actualmente soporta Uruguay (UY), Argentina (AR), México (MX), Chile (CL), Venezuela (VE) y Colombia (CO). Para agregar más países:

1. Actualiza `CountryCode` en `src/types.ts`
2. Agrega datos en `src/lib/countryRates.ts`
3. Actualiza la validación en la base de datos

### Cálculos Personalizados
La lógica de cálculo está en `src/lib/compute.ts` con soporte completo de conversión USD/Pct bidireccional

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

Este proyecto está bajo la Licencia MIT.

---

**SG Contadora** - Diseñado con 💕✨ para la gestión contable moderna
