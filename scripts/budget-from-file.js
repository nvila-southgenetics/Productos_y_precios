/**
 * Reads budget-mx-2026 JSON and outputs SQL to replace budget 2026
 * for countries in the file. Months not in file = 0.
 * For Argentina and Chile, jan and feb = current values from DB (passed as arClJanFeb).
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '../budget-mx-2026');
const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));

const COUNTRY_MAP = {
  Chile: { code: 'CL', name: 'Chile' },
  Uruguay: { code: 'UY', name: 'Uruguay' },
  Argentina: { code: 'AR', name: 'Argentina' },
  Colombia: { code: 'CO', name: 'Colombia' },
  'Rep.Dominicana': { code: 'DO', name: 'Rep.Dominicana' },
  'Trinidad y Tobago': { code: 'TT', name: 'Trinidad y Tobago' },
  Bahamas: { code: 'BS', name: 'Bahamas' },
  Barbados: { code: 'BB', name: 'Barbados' },
  Bermuda: { code: 'BM', name: 'Bermuda' },
  'Cayman Islands': { code: 'KY', name: 'Cayman Islands' },
};

const MONTH_FILE_TO_DB = {
  ENE: 'jan', FEB: 'feb', MAR: 'mar', ABR: 'apr', MAY: 'may', JUN: 'jun',
  JUL: 'jul', AGO: 'aug', SET: 'sep', OCT: 'oct', NOV: 'nov', DIC: 'dec',
};

// Current jan,feb for AR and CL from DB (product_name -> { jan, feb } per country)
const arClJanFeb = {
  AR: {
    'Genomind Profesional PGx': { jan: 0, feb: 0 },
    'mirTHYpe FULL excepcion': { jan: 2, feb: 3 },
    'Tempus xF + biopsia liquida': { jan: 0, feb: 1 },
    '4KSCORE': { jan: 0, feb: 3 },
    'AFIRMA': { jan: 0, feb: 1 },
    'DECIPHER': { jan: 0, feb: 0 },
    'Decision DX - UM': { jan: 0, feb: 0 },
    'Maternit 21 plus': { jan: 3, feb: 0 },
    'MATERNIT GENOME': { jan: 1, feb: 1 },
    'SENTIS MULTI CANCER': { jan: 1, feb: 1 },
    'Unity Básico': { jan: 7, feb: 8 },
    'Unity Complete': { jan: 1, feb: 1 },
  },
  CL: {
    'ONCOTYPE DX GPS (Próstata)': { jan: 0, feb: 0 },
    'Genomind Profesional PGx': { jan: 2, feb: 2 },
    'mirTHYpe FULL excepcion': { jan: 0, feb: 0 },
    'ONCOTYPE DX MAMA': { jan: 13, feb: 10 },
    'AFIRMA': { jan: 0, feb: 0 },
    'Decision DX - UM': { jan: 0, feb: 0 },
  },
};

function normalizeForMatch(name) {
  return name.replace(/\s+/g, ' ').trim().toLowerCase();
}

function findJanFeb(countryCode, fileProductName) {
  const map = arClJanFeb[countryCode];
  if (!map) return { jan: 0, feb: 0 };
  const n = normalizeForMatch(fileProductName);
  for (const [dbName, v] of Object.entries(map)) {
    if (normalizeForMatch(dbName) === n) return v;
  }
  // Partial: "unity" -> Unity Básico, "Genomind" -> Genomind Profesional PGx, "mirTHYpe" -> mirTHYpe FULL excepcion, "Decision DX UM" -> Decision DX - UM
  if (n === 'unity' && map['Unity Básico']) return map['Unity Básico'];
  if (n.includes('genomind') && map['Genomind Profesional PGx']) return map['Genomind Profesional PGx'];
  if (n.includes('mirthype') && map['mirTHYpe FULL excepcion']) return map['mirTHYpe FULL excepcion'];
  if (n.includes('decision dx') && map['Decision DX - UM']) return map['Decision DX - UM'];
  if (n.includes('4k score') && map['4KSCORE']) return map['4KSCORE'];
  if (n.includes('maternit genome') && map['MATERNIT GENOME']) return map['MATERNIT GENOME'];
  if (n.includes('maternit 21') && map['Maternit 21 plus']) return map['Maternit 21 plus'];
  if (n.includes('unity complete') && map['Unity Complete']) return map['Unity Complete'];
  if (n.includes('oncotype') && countryCode === 'CL' && map['ONCOTYPE DX MAMA']) return map['ONCOTYPE DX MAMA'];
  return { jan: 0, feb: 0 };
}

const rows = [];
for (const [countryLabel, products] of Object.entries(data)) {
  const c = COUNTRY_MAP[countryLabel];
  if (!c) continue;
  const isARorCL = c.code === 'AR' || c.code === 'CL';
  for (const [productName, months] of Object.entries(products)) {
    if (typeof months !== 'object' || Array.isArray(months)) continue;
    const m = { jan: 0, feb: 0, mar: 0, apr: 0, may: 0, jun: 0, jul: 0, aug: 0, sep: 0, oct: 0, nov: 0, dec: 0 };
    for (const [k, v] of Object.entries(months)) {
      const col = MONTH_FILE_TO_DB[k];
      if (col) m[col] = Number(v) || 0;
    }
    if (isARorCL) {
      const jf = findJanFeb(c.code, productName);
      m.jan = jf.jan;
      m.feb = jf.feb;
    }
    rows.push({
      country: c.name,
      country_code: c.code,
      product_name: productName,
      channel: 'Paciente',
      year: 2026,
      ...m,
    });
  }
}

// Output SQL: DELETE then INSERT (write UTF-8 file)
const escape = (s) => (s == null ? 'NULL' : `'${String(s).replace(/'/g, "''")}'`);
const lines = [];
lines.push('-- Delete budget 2026 for countries in file');
lines.push(`DELETE FROM budget WHERE year = 2026 AND country_code IN ('CL','UY','AR','CO','DO','TT','BS','BB','BM','KY');`);
lines.push('');
lines.push('-- Insert rows (product_id NULL; can be linked later)');
for (const r of rows) {
  lines.push(
    `INSERT INTO budget (id, country, country_code, product_id, product_name, year, jan, feb, mar, apr, may, jun, jul, aug, sep, oct, nov, dec, channel, created_at, updated_at) VALUES (gen_random_uuid(), ${escape(r.country)}, ${escape(r.country_code)}, NULL, ${escape(r.product_name)}, 2026, ${r.jan}, ${r.feb}, ${r.mar}, ${r.apr}, ${r.may}, ${r.jun}, ${r.jul}, ${r.aug}, ${r.sep}, ${r.oct}, ${r.nov}, ${r.dec}, 'Paciente', NOW(), NOW());`
  );
}
fs.writeFileSync(path.join(__dirname, 'budget-inserts.sql'), lines.join('\n'), 'utf8');
console.log('Written', rows.length, 'inserts to scripts/budget-inserts.sql');
