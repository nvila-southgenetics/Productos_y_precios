# Sistema P&L - SouthGenetics

Sistema integral de gestión de productos, análisis de ventas y proyecciones presupuestarias para SouthGenetics.

## 🚀 Características

### Módulo de Productos
- ✅ Gestión completa de productos genéticos
- ✅ Cálculo de costos por país (Chile, Uruguay, Argentina, México, Colombia, etc.)
- ✅ Control de gastos detallado con 13+ conceptos de costo
- ✅ Gross Profit y Gross Sale por producto
- ✅ Edición inline de valores USD con debounce
- ✅ Filtros por país, categoría, tipo y búsqueda
- ✅ Vista detallada con tabs por país

### Módulo P&L Import
- ✅ Análisis de ventas mensuales reales desde Odoo
- ✅ Vista consolidada por mes con dropdowns expandibles
- ✅ Modal de P&L mensual agregado con cálculos consolidados
- ✅ Cálculos automáticos de rentabilidad
- ✅ Filtros por compañía y producto
- ✅ Vista compacta optimizada
- ✅ Indicadores visuales para productos sin precios configurados

### Módulo Budget
- ✅ Proyecciones de ventas 2026
- ✅ Filtros por año, país, producto y **mes**
- ✅ Resumen ejecutivo con KPIs (Total Unidades, Gross Sale, Gross Profit, Margen Promedio)
- ✅ Tabla con columna de **Margen (%)** con colores semáforo
- ✅ Importación de Excel para proyecciones
- ✅ Vista expandible con detalle mensual
- ✅ Cálculos automáticos basados en `product_country_overrides`

## 🛠️ Stack Tecnológico

- **Frontend:** Next.js 14 (App Router), React 18, TypeScript
- **Styling:** Tailwind CSS, shadcn/ui components
- **Base de Datos:** Supabase (PostgreSQL) con MCP Server
- **Integración:** N8N (Odoo connector)
- **Librerías:**
  - `xlsx` - Para importar proyecciones de Excel
  - `lucide-react` - Iconos
  - `date-fns` - Manejo de fechas

## 📦 Instalación

```bash
# Clonar el repositorio
git clone https://github.com/nvila-southgenetics/Productos_y_precios.git
cd Productos_y_precios

# Instalar dependencias
npm install

# Configurar variables de entorno
cp env.example .env.local
# Editar .env.local con tus credenciales de Supabase:
# NEXT_PUBLIC_SUPABASE_URL=tu_url
# NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_key

# Correr en desarrollo
npm run dev
```

La aplicación estará disponible en `http://localhost:3000`

## 🗄️ Base de Datos

### Tablas principales:

- **`products`** - Catálogo de productos genéticos
  - Campos: `id`, `name`, `sku`, `description`, `category`, `tipo`
  
- **`product_country_overrides`** - Precios y costos por país
  - Campos: `product_id`, `country_code`, `overrides` (JSONB)
  - Países soportados: UY, AR, MX, CL, VE, CO
  
- **`budget`** - Proyecciones de ventas 2026
  - Campos: `product_name`, `country_code`, `year`, `jan-dec`, `total_units`
  - 86 registros, 43 productos únicos
  
- **`ventas_mensuales_view`** - Vista de ventas reales desde Odoo
  - Campos: `producto`, `mes`, `año`, `compañia`, `cantidad_ventas`, `monto_total`

### Setup inicial:

1. Crear las tablas en Supabase usando las migraciones
2. Importar datos de productos desde Odoo vía N8N
3. Configurar precios y costos en `/productos`
4. Importar proyecciones de ventas desde Excel en `/budget`

## 🔗 Integraciones

### N8N Workflows:
- Sincronización automática con Odoo
- Actualización de ventas mensuales
- Generación de reportes

### Supabase:
- MCP Server conectado para operaciones server-side
- Row Level Security (RLS) habilitado
- Real-time subscriptions (opcional)

## 📊 Estructura del Proyecto

```
PYL2/
├── app/
│   ├── productos/          # Gestión de productos
│   │   ├── page.tsx        # Lista de productos
│   │   └── [productId]/    # Detalle de producto
│   ├── pl-import/          # Análisis de ventas
│   │   └── page.tsx        # Vista mensual de ventas
│   └── budget/             # Proyecciones presupuestarias
│       └── page.tsx        # Tabla de budget con filtros
├── components/
│   ├── products/           # Componentes de productos
│   ├── pl-import/          # Componentes de P&L
│   ├── budget/             # Componentes de budget
│   ├── layout/             # Header y navegación
│   └── ui/                 # Componentes shadcn/ui
├── lib/
│   ├── supabase.ts         # Cliente Supabase
│   ├── supabase-mcp.ts     # Funciones MCP
│   ├── budgetParser.ts     # Parser de Excel
│   └── utils.ts            # Utilidades
└── types/
    └── mcp.ts              # Tipos TypeScript
```

## 🎯 Casos de Uso

### 1. Configurar Precios de Productos
1. Ir a `/productos`
2. Seleccionar un producto
3. Configurar precios y costos por país
4. Los cálculos se actualizan automáticamente

### 2. Analizar Ventas Mensuales
1. Ir a `/pl-import`
2. Seleccionar compañía y producto (opcional)
3. Expandir meses para ver detalles
4. Click en "📄 P&L" para ver consolidado mensual

### 3. Proyecciones Presupuestarias
1. Ir a `/budget`
2. Importar Excel con proyecciones
3. Filtrar por año, país, producto o mes
4. Ver resumen ejecutivo y tabla detallada
5. Analizar márgenes con colores semáforo

### 4. Comparar Budget vs Real
1. Ver proyecciones en `/budget`
2. Ver ventas reales en `/pl-import`
3. Comparar manualmente o exportar datos

## 🎨 Características de UI/UX

- **Diseño moderno:** Tailwind CSS con tema personalizado
- **Componentes reutilizables:** shadcn/ui
- **Responsive:** Adaptado a móviles y tablets
- **Feedback visual:** Toasts, loading states, indicadores
- **Navegación intuitiva:** Header persistente con tabs
- **Colores semáforo:** Verde/Amarillo/Naranja/Gris para márgenes

## 📈 Métricas y KPIs

### Resumen Budget:
- Total Unidades proyectadas
- Total Gross Sale
- Total Gross Profit
- Margen Promedio (%)

### Resumen P&L Import:
- Ventas por mes y compañía
- Gross Sale y Gross Profit calculados
- Comparación con montos de Odoo

## 🔒 Seguridad

- Variables de entorno en `.env.local` (no versionadas)
- Row Level Security en Supabase
- Validación de inputs en formularios
- Sanitización de datos de Excel

## 🚀 Deployment

### Vercel (Recomendado):
```bash
# Instalar Vercel CLI
npm i -g vercel

# Deploy
vercel
```

### Variables de entorno en Vercel:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 🐛 Troubleshooting

### Error: "Module not found: Can't resolve 'xlsx'"
```bash
npm install xlsx
```

### Error: "Failed to fetch budget data"
- Verificar conexión a Supabase
- Verificar que las tablas existan
- Verificar permisos RLS

### Error: "Product not found"
- Verificar que el producto exista en la BD
- Verificar que `product_id` esté correctamente linkeado

## 📝 Changelog

Ver [CHANGELOG.md](./CHANGELOG.md) para historial de cambios.

## 👥 Equipo

Desarrollado por el equipo de SouthGenetics

## 📄 Licencia

Privado - SouthGenetics LLC

---

**Última actualización:** Diciembre 2024
