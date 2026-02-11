/**
 * Script para obtener todas las ventas de Enero 2025 desde Odoo
 * y guardarlas en un archivo JSON agrupadas por país
 * 
 * NOTA: Este script necesita ejecutarse manualmente usando las herramientas MCP
 * ya que requiere acceso directo a la API de Odoo
 */

// Mapeo de compañías a códigos de país
const companyToCountry = {
  'SouthGenetics LLC': 'UY',
  'SouthGenetics LLC Uruguay': 'UY',
  'SouthGenetics LLC Argentina': 'AR',
  'SouthGenetics LLC Arge': 'AR',
  'Southgenetics LLC Chile': 'CL',
  'SouthGenetics LLC Chile': 'CL',
  'SouthGenetics LLC Colombia': 'CO',
  'SouthGenetics LLC México': 'MX',
  'SouthGenetics LLC Venezuela': 'VE'
};

// Función para obtener el código de país desde el nombre de la compañía
function getCountryCode(companyName) {
  return companyToCountry[companyName] || 'UNKNOWN';
}

// Estructura de datos para agrupar por país
const ventasPorPais = {
  UY: [],
  AR: [],
  CL: [],
  CO: [],
  MX: [],
  VE: [],
  UNKNOWN: []
};

console.log('Script listo para obtener ventas de enero 2025');
console.log('Este script necesita ejecutarse usando las herramientas MCP de Odoo');
