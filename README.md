# Sistema Profit & Loss - SouthGenetics

Sistema web de Profit & Loss conectado a Odoo para SouthGenetics, una empresa de testing genético.

## Stack Tecnológico

- **Frontend**: Next.js 14+ con App Router
- **Styling**: Tailwind CSS
- **Base de datos**: Supabase
- **Schema**: `public` (tablas: `products`, `product_country_overrides`)

## Configuración

1. **Instalar dependencias:**
```bash
npm install
```

2. **Configurar variables de entorno:**
Crea un archivo `.env.local` basado en `.env.local.example` y agrega tus credenciales de Supabase:

```env
NEXT_PUBLIC_SUPABASE_URL=https://cdrmxjcdgxjyakrcpxnp.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key_aqui
```

Para obtener las claves de Supabase, puedes usar el MCP o acceder al dashboard de Supabase.

3. **Ejecutar el servidor de desarrollo:**
```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

## Estructura del Proyecto

```
├── app/
│   ├── productos/          # Página principal de productos
│   ├── layout.tsx          # Layout principal
│   ├── page.tsx            # Página de inicio (redirige a /productos)
│   └── globals.css         # Estilos globales
├── components/
│   ├── products/           # Componentes relacionados con productos
│   │   ├── ProductTable.tsx
│   │   ├── ProductFilters.tsx
│   │   ├── CountryPills.tsx
│   │   └── ProductDetailModal.tsx
│   └── ui/                 # Componentes UI base
├── lib/
│   ├── supabase.ts         # Cliente de Supabase
│   ├── supabase-mcp.ts     # Funciones de datos
│   └── utils.ts            # Utilidades
└── types/
    └── mcp.ts              # Tipos TypeScript
```

## Funcionalidades

### Página de Productos

- **Vista principal**: Lista todos los productos con información básica
- **Filtros**: 
  - Búsqueda por nombre, SKU o descripción
  - Filtro por categoría
  - Filtro por tipo
  - Vista por país (UY, AR, MX, CL, VE, CO)
- **Acciones**: Ver, editar, eliminar productos

### Vista Detallada de Producto

- **Cálculo de Costos**: Tabla interactiva con todos los costos del producto
- **Edición inline**: Doble clic en valores USD para editarlos
- **Cálculos automáticos**: 
  - Sales Revenue = Gross Sales - Commercial Discount
  - Total Cost of Sales = suma de costos activos
  - Gross Profit = Sales Revenue - Total Cost of Sales
  - Porcentajes calculados automáticamente
- **Configuración por país**: Cada país puede tener sus propios valores

## Base de Datos

### Tablas principales:

1. **`products`**
   - `id` (uuid)
   - `name` (text)
   - `sku` (text)
   - `description` (text)
   - `category` (text)
   - `tipo` (text)
   - `created_at` (timestamptz)

2. **`product_country_overrides`**
   - `id` (uuid)
   - `product_id` (uuid) - FK a products
   - `country_code` (text) - 'UY', 'AR', 'MX', 'CL', 'VE', 'CO'
   - `overrides` (jsonb) - contiene todos los costos específicos por país

## Próximos Pasos

- Dashboard de métricas agregadas
- Reportes de P&L por período
- Integración con Odoo para sincronización
- Autenticación de usuarios
- Permisos y roles

## Notas

- Los cambios en los overrides se guardan automáticamente al hacer clic en "Guardar Cambios"
- Los valores con % se calculan automáticamente basados en Gross Sales
- Gross Sales es editable por país según el mercado local

