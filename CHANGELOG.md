# Changelog - Sistema P&L SouthGenetics

## Cambios Recientes

### ✅ Página de Vista Detallada como Ruta Separada

**Cambios implementados:**

1. **Nueva ruta dinámica**: `/productos/[productId]`
   - Página completa separada (no modal)
   - Breadcrumb: Productos > [Nombre del Producto]
   - Botón "← Volver" en la esquina superior izquierda
   - Botón "Copiar URL" en el header

2. **Layout 70/30**:
   - Columna izquierda (70%): Cálculo de Costos
   - Columna derecha (30%): Información del Producto

3. **Tabs de selección de país**:
   - Uruguay, Argentina, México, Chile, Venezuela, Colombia
   - Tab activo con fondo azul
   - Cambio automático de valores al cambiar de país

4. **Tabla de Costos actualizada**:
   - Headers: Concepto | 💵 USD | 📊 % | Cuenta
   - Cuentas contables ajustadas según especificaciones:
     - Gross Sales: 4.1.1.6
     - Commercial Discount: 4.1.1.10
     - Product Cost: 5.1.1.6
     - Kit Cost: 5.1.4.1.4
     - Payment Fee Costs: -
     - Blood Drawn & Sample Handling: 5.1.4.1.2
     - Sanitary Permits: 5.1.x.x
     - External Courier: 5.1.2.4.2
     - Internal Courier: 5.1.2.4.1
     - Physicians Fees: 5.1.4.1.1
     - Sales Commission: 6.1.1.06

5. **Funcionalidad "Reiniciar Parámetros"**:
   - Diálogo de confirmación
   - Resetea todos los valores a $0.00 excepto Gross Sales
   - Desmarca todos los checkboxes excepto Gross Sales y Product Cost
   - Guarda automáticamente en la base de datos

6. **Edición inline mejorada**:
   - Doble clic en valores USD para editar
   - Validación: solo números positivos
   - Guardado automático con debounce de 500ms
   - Escape para cancelar edición
   - Hover con fondo amarillo suave

7. **Navegación actualizada**:
   - ProductTable ahora navega a `/productos/[productId]` en lugar de abrir modal
   - Click en nombre del producto navega a la página detallada
   - Botones de acción (ver, editar) navegan a la página
   - Botón de enlace copia la URL al portapapeles

8. **Cálculos automáticos**:
   - Sales Revenue = Gross Sales - Commercial Discount
   - Total Cost of Sales = suma de costos con checkbox activo
   - Gross Profit = Sales Revenue - Total Cost of Sales
   - Porcentajes calculados automáticamente

9. **Mensajes informativos**:
   - ℹ️ "Haz doble clic en cualquier valor USD para editarlo..."
   - ⚠️ "Gross Sales es editable por país, cambio según el mercado local"

10. **Manejo de errores**:
    - Página 404 si el producto no existe
    - Loading states mientras carga
    - Mensajes de error claros

### Archivos modificados/creados:

- ✅ `app/productos/[productId]/page.tsx` - Nueva página dinámica
- ✅ `components/products/ProductDetailView.tsx` - Componente de vista detallada
- ✅ `components/products/ProductTable.tsx` - Actualizado para navegación
- ✅ `app/productos/page.tsx` - Eliminado modal, simplificado
- ✅ `lib/supabase-mcp.ts` - Actualizado getProductById para obtener todos los overrides

### Próximos pasos sugeridos:

- [ ] Implementar sistema de toast notifications
- [ ] Agregar skeleton loaders
- [ ] Implementar eliminación de productos
- [ ] Crear página de nuevo producto
- [ ] Agregar validaciones más robustas
- [ ] Implementar optimistic updates

