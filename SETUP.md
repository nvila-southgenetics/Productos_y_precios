# Guía de Configuración Rápida

## Pasos para ejecutar el proyecto

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar variables de entorno

Crea un archivo `.env.local` en la raíz del proyecto con el siguiente contenido:

```env
NEXT_PUBLIC_SUPABASE_URL=https://cdrmxjcdgxjyakrcpxnp.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNkcm14amNkZ3hqeWFrcmNweG5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgyMTg5NjQsImV4cCI6MjA3Mzc5NDk2NH0.XzHswQ3ibLC1x30d49wZExizLdb581S5bz0uhqs5LVM
```

### 3. Ejecutar el servidor de desarrollo

```bash
npm run dev
```

### 4. Abrir en el navegador

Navega a [http://localhost:3000](http://localhost:3000)

El proyecto redirigirá automáticamente a `/productos` donde verás la página principal.

## Estructura de la Base de Datos

El proyecto está conectado a Supabase y usa las siguientes tablas:

- **`products`**: Contiene la información básica de los productos
- **`product_country_overrides`**: Contiene los costos específicos por país en formato JSONB

## Funcionalidades Implementadas

✅ Página principal de productos con tabla
✅ Filtros por país, categoría, tipo y búsqueda
✅ Vista detallada de producto con cálculo de costos
✅ Edición inline de valores USD (doble clic)
✅ Cálculos automáticos de porcentajes y totales
✅ Guardado de cambios en la base de datos

## Próximos Pasos

- Implementar creación de nuevos productos
- Implementar eliminación de productos
- Dashboard de métricas
- Reportes de P&L
- Integración con Odoo

