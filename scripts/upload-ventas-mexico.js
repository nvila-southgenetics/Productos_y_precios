/**
 * Sube ventas de México desde JSON (años/meses/producto -> cantidad).
 * Mapea nombres del JSON a productos existentes e inserta en ventas (company = SouthGenetics LLC México).
 * Uso: node scripts/upload-ventas-mexico.js
 */

const fs = require('fs');
const path = require('path');

// Cargar datos (poner el JSON en este archivo o en ventas-mexico.json)
const DATA = {
  "2025": {
    "Enero": { "ONCOTYPE": 52, "INVITAE": 7, "MIRTHYPE FULL": 1, "AFIRMA GSC": 2 },
    "Febrero": { "ONCOTYPE": 41, "INVITAE": 3, "SENTIS (B)": 1 },
    "Marzo": { "ONCOTYPE": 52, "INVITAE": 9, "AFIRMA GSC": 1 },
    "Abril": { "ONCOTYPE": 36, "INVITAE": 3, "SENTIS (B)": 1, "AFIRMA GSC": 1 },
    "Mayo": { "ONCOTYPE": 46, "INVITAE": 3, "SENTIS (T)": 2, "SENTIS (B)": 2, "CELL SEARCH CTC": 1 },
    "Junio": { "ONCOTYPE": 48, "INVITAE": 4, "SENTIS (B)": 1 },
    "Julio": { "ONCOTYPE": 41, "INVITAE": 2, "GPS": 1, "UNITY": 1 },
    "Agosto": { "ONCOTYPE": 31, "INVITAE": 3, "SENTIS (B)": 1, "TEMPUS (XF+)": 1, "MIRTHYPE TARGET": 1 },
    "Setiembre": { "ONCOTYPE": 41, "INVITAE": 6, "SENTIS (T)": 2 },
    "Octubre": { "ONCOTYPE": 44, "INVITAE": 2, "SENTIS (B)": 1, "MELANOMA (DX)": 1, "SELECT": 1, "TEMPUS (XF+)": 1, "TEMPUS (XT+XR)": 1 },
    "Noviembre": { "ONCOTYPE": 36, "INVITAE": 1, "SENTIS (T)": 1, "UNITY": 2, "MIRTHYPE FULL": 1, "AFIRMA GSC": 1 },
    "Diciembre": { "ONCOTYPE": 31, "INVITAE": 2, "TEMPUS (XF+)": 1, "TEMPUS (XT+XR)": 2, "AFIRMA GSC": 1 }
  },
  "2026": {
    "Enero": { "ONCOTYPE": 44, "INVITAE": 5, "SENTIS (T)": 1, "SENTIS (B)": 1 },
    "Febrero": { "ONCOTYPE": 56, "INVITAE": 6, "SENTIS (B)": 2, "TEMPUS (XT+XR)": 1, "MIRTHYPE FULL": 1 }
  }
};

const MES_A_NUM = {
  Enero: 1, Febrero: 2, Marzo: 3, Abril: 4, Mayo: 5, Junio: 6,
  Julio: 7, Agosto: 8, Setiembre: 9, Octubre: 10, Noviembre: 11, Diciembre: 12
};

// Mapeo nombre en JSON -> { id: product_id, name: nombre para ventas.test }
const PRODUCT_MAP = {
  'ONCOTYPE':                    { id: 'ae9fed61-3248-4724-ac83-1225b45bc0a1', name: '[Oncotype Dx Mama] ONCOTYPE DX MAMA' },
  'INVITAE':                     { id: 'ff287b85-f758-4dc8-99bd-69bb3a529a76', name: 'Invitae Canceres Heredit Comunes' },
  'MIRTHYPE FULL':               { id: 'b770226e-86a9-41b0-a7b1-0eb091a2865f', name: '[mirTHYpe FULL] mirTHYpe FULL' },
  'AFIRMA GSC':                  { id: 'afb86443-5098-4eb8-bb85-ea2c75621311', name: 'Afirma GSC' },
  'SENTIS (B)':                  { id: 'e0e6e69c-6dea-4d36-8923-27e7f94e8f28', name: 'Sentis Cancer + Discovery (B)' },
  'SENTIS (T)':                  { id: '9c3dc084-e6a9-4cae-b0db-e9c774684706', name: 'Sentis Cancer + Discovery (T)' },
  'CELL SEARCH CTC':             { id: 'b353a438-2f38-4ea1-9081-fe441a5a5c47', name: '[CellSearch CTC] CellSearch CTC' },
  'GPS':                         { id: 'f74f11bd-f611-49e0-ab6f-9455010c9828', name: '[Genomic Prostate Score (GPS)] Genomic Prostate Score' },
  'UNITY':                       { id: 'a6e31566-433b-4d8d-ab73-9468cbe1b228', name: 'Unity Básico' },
  'TEMPUS (XF+)':                { id: '4f45857a-86bb-4479-8b3f-720490c11b0d', name: '[Tempus xF +] Tempus xF + biopsia liquida ' },
  'MIRTHYPE TARGET':             { id: '1eaa3f87-08fb-4075-96c8-c3ca3f776891', name: '[MirThype Target] MirThype Target' },
  'MELANOMA (DX)':               { id: 'bf185900-2dca-4fc7-a25b-2f0b865ae4cb', name: '[DecisionDx Melanoma] DecisionDx Melanoma' },
  'SELECT':                      { id: 'fa57457f-6445-46d6-9ca1-cd2ba9c3a381', name: '[SelectMDX] SELECTMDX' },
  'TEMPUS (XT+XR)':             { id: '2755a6c9-1014-4e5f-b04c-fd98e0944c01', name: '[XT + XR] Tempus XT + XR Tejido ' }
};

const COMPANY_MX = 'SouthGenetics LLC México';

function buildRows() {
  const rows = [];
  for (const [yearStr, months] of Object.entries(DATA)) {
    const year = parseInt(yearStr, 10);
    for (const [mesLabel, products] of Object.entries(months)) {
      const month = MES_A_NUM[mesLabel];
      if (!month) {
        console.warn('Mes desconocido:', mesLabel);
        continue;
      }
      const fecha = `${year}-${String(month).padStart(2, '0')}-01`;
      for (const [productKey, qty] of Object.entries(products)) {
        const mapped = PRODUCT_MAP[productKey];
        if (!mapped) {
          console.warn('Producto no mapeado:', productKey);
          continue;
        }
        for (let i = 0; i < qty; i++) {
          rows.push({
            fecha,
            test: mapped.name,
            amount: 0,
            company: COMPANY_MX,
            id_producto: mapped.id
          });
        }
      }
    }
  }
  return rows;
}

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = val.replace(/^["']|["']$/g, '');
  }
}

async function main() {
  const rows = buildRows();
  console.log('Filas a insertar:', rows.length);

  loadEnv();
  const { createClient } = require('@supabase/supabase-js');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error('Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY/NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local');
    process.exit(1);
  }
  const supabase = createClient(url, key);

  const BATCH = 200;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const { error } = await supabase.from('ventas').insert(chunk);
    if (error) {
      console.error('Error insertando lote:', error);
      process.exit(1);
    }
    console.log('Insertadas', Math.min(i + BATCH, rows.length), 'de', rows.length);
  }
  console.log('Listo. Total insertado:', rows.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
