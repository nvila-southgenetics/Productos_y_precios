// Script completo para generar JSON con todos los productos y precios
const fs = require('fs');

console.log('='.repeat(60));
console.log('GENERADOR DE PRODUCTOS Y PRECIOS POR CATEGORÍA');
console.log('='.repeat(60));

// Leer productos completos
let productosContent = fs.readFileSync('productos_completos.json', 'utf8');
if (productosContent.charCodeAt(0) === 0xFEFF) {
    productosContent = productosContent.slice(1);
}
const productosData = JSON.parse(productosContent);
let productos = productosData.records || [];

console.log(`\n✓ ${productos.length} productos cargados desde productos_completos.json`);

// Si hay más productos (total > limit), necesitamos obtenerlos
// Por ahora procesamos los que tenemos

// Crear índices para búsqueda rápida
const productosPorId = {};
const productosPorNombre = {};
const productosPorDisplayName = {};

productos.forEach(p => {
    productosPorId[p.id] = p;
    productosPorNombre[p.name] = p;
    if (p.display_name) {
        productosPorDisplayName[p.display_name] = p;
        // También indexar sin código entre corchetes
        const nombreSinCodigo = p.display_name.replace(/^\[.*?\]\s*/, '');
        if (!productosPorDisplayName[nombreSinCodigo]) {
            productosPorDisplayName[nombreSinCodigo] = p;
        }
    }
});

// Organizar por categoría
const categorias = {};

productos.forEach(producto => {
    const categoriaInfo = producto.categ_id || [null, 'Sin categoría'];
    const categoriaNombre = categoriaInfo[1];
    
    if (!categorias[categoriaNombre]) {
        categorias[categoriaNombre] = [];
    }
    
    categorias[categoriaNombre].push({
        id: producto.id,
        name: producto.name,
        display_name: producto.display_name,
        default_code: producto.default_code,
        product_tmpl_id: producto.product_tmpl_id ? producto.product_tmpl_id[0] : null,
        detailed_type: producto.detailed_type,
        active: producto.active,
        precios: {} // Se llenará con precios por compañía
    });
});

// Ordenar
const categoriasOrdenadas = {};
Object.keys(categorias).sort().forEach(categoria => {
    categoriasOrdenadas[categoria] = categorias[categoria].sort((a, b) => {
        const nameA = a.display_name || a.name || '';
        const nameB = b.display_name || b.name || '';
        return nameA.localeCompare(nameB);
    });
});

// Crear estructura final
const resultado = {
    metadata: {
        total_productos: productos.length,
        total_categorias: Object.keys(categoriasOrdenadas).length,
        fecha_generacion: '2026-02-06',
        nota: 'Los precios se obtienen de product.pricelist.item en Odoo. Para agregar precios completos, ejecuta el script con todos los items de precios.'
    },
    categorias: categoriasOrdenadas
};

// Guardar JSON
const outputFile = 'productos_por_categoria_con_precios.json';
fs.writeFileSync(outputFile, JSON.stringify(resultado, null, 2), 'utf8');

console.log(`\n✓ JSON generado: ${outputFile}`);
console.log(`  - Productos: ${resultado.metadata.total_productos}`);
console.log(`  - Categorías: ${resultado.metadata.total_categorias}`);
console.log('\n' + '='.repeat(60));
console.log('NOTA: Los precios están vacíos. Para agregarlos:');
console.log('1. Obtén todos los items de product.pricelist.item (318 total)');
console.log('2. Relaciónalos con los productos usando el nombre');
console.log('3. Agrupa por compañía dentro de cada producto');
console.log('='.repeat(60));
