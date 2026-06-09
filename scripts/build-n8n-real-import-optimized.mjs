/**
 * Crea "Real Import Productos (Optimized)" en n8n a partir del export del original.
 * No modifica ux5h4tbSHE6SfRXA.
 *
 * Uso: node scripts/build-n8n-real-import-optimized.mjs
 * Requiere N8N_API_KEY en env o .cursor/mcp.json
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const EXPORT_PATH = path.join(
  ROOT,
  "exports/n8n-real-import-productos-original.json"
);
const N8N_BASE = "https://n8n.srv908725.hstgr.cloud";

function uuid() {
  return crypto.randomUUID();
}

function loadApiKey() {
  if (process.env.N8N_API_KEY) return process.env.N8N_API_KEY;
  const mcpPath = path.join(ROOT, ".cursor/mcp.json");
  if (fs.existsSync(mcpPath)) {
    const mcp = JSON.parse(fs.readFileSync(mcpPath, "utf8"));
    return mcp.mcpServers?.n8n?.env?.N8N_API_KEY;
  }
  throw new Error("Falta N8N_API_KEY");
}

function pickNode(nodes, name) {
  const n = nodes.find((x) => x.name === name);
  if (!n) throw new Error(`Nodo no encontrado: ${name}`);
  return JSON.parse(JSON.stringify(n));
}

const CODE_EXTRACT_IDS = `const ventas = $('Code in JavaScript9').all().map((i) => i.json);
const partner_ids = [...new Set(ventas.map((v) => v.partner_id).filter((id) => id != null && id !== false))];
const referrer_ids = [...new Set(ventas.map((v) => v.referrer_id).filter((id) => id != null && id !== false))];
const producto_ids = [...new Set(ventas.map((v) => v.producto_id).filter((id) => id != null))];
const producto_names = [...new Set(ventas.map((v) => v.producto).filter((n) => n))];

const quote = (s) => '"' + String(s).replace(/"/g, '\\\\"') + '"';
const parts = [];
if (producto_ids.length) parts.push(\`id_odoo.in.(\${producto_ids.join(",")})\`);
if (producto_names.length) parts.push(\`name.in.(\${producto_names.map(quote).join(",")})\`);
const products_filter =
  parts.length > 1 ? \`or=(\${parts.join(",")})\` : parts[0] ?? "id_odoo=eq.-1";

return [{ json: { partner_ids, referrer_ids, producto_ids, producto_names, products_filter } }];`;

const CODE_PARSE_SUPABASE_ROWS = `function parseSupabaseRows(raw) {
  if (Array.isArray(raw)) return raw;
  if (!raw || typeof raw !== 'object') return [];
  if (Array.isArray(raw.body)) return raw.body;
  if (Array.isArray(raw.data)) return raw.data;
  if (raw.id) return [raw];
  return [];
}

/** n8n HTTP suele emitir 1 item por fila del JSON array; .first() solo ve 1 producto. */
function loadAllProductsFromHttp(nodeName) {
  const items = $(nodeName).all();
  const products = [];
  for (const item of items) {
    const rows = parseSupabaseRows(item.json);
    if (rows.length > 1) {
      products.push(...rows);
    } else if (rows.length === 1) {
      products.push(rows[0]);
    } else if (item.json?.id) {
      products.push(item.json);
    }
  }
  return products;
}`;

const CODE_BUILD_CACHES = `${CODE_PARSE_SUPABASE_ROWS}
const ventas = $('Code in JavaScript9').all().map((i) => i.json);
const batch = $input.first().json;
const partnerRows = batch.partnerRows ?? [];
const referrerRows = batch.referrerRows ?? [];
const productRows = parseSupabaseRows(batch.products);

function mapPartner(r) {
  return {
    id: r.id ?? null,
    nombre: r.name ?? "",
    institucion_id: Array.isArray(r.institucion_id) ? r.institucion_id[0] : null,
    institucion: Array.isArray(r.institucion_id) ? r.institucion_id[1] : "",
    parent_id: Array.isArray(r.parent_id) ? r.parent_id[0] : null,
    parent_nombre: Array.isArray(r.parent_id) ? r.parent_id[1] : "",
    commercial_partner_id: Array.isArray(r.commercial_partner_id) ? r.commercial_partner_id[0] : null,
    commercial_partner: Array.isArray(r.commercial_partner_id) ? r.commercial_partner_id[1] : "",
    country_id: Array.isArray(r.country_id) ? r.country_id[0] : null,
    country: Array.isArray(r.country_id) ? r.country_id[1] : "",
    company_name: r.company_name || "",
    is_company: r.is_company ?? false,
  };
}

const partnersById = Object.fromEntries(partnerRows.map((r) => [r.id, mapPartner(r)]));
const referrersById = Object.fromEntries(referrerRows.map((r) => [r.id, mapPartner(r)]));

const odooKey = (id) => (id == null || id === "" ? null : Number(id));

const productsByOdoo = {};
const productsByName = {};
const productsByAlias = {};
for (const p of productRows) {
  const k = odooKey(p.id_odoo);
  if (k != null && !Number.isNaN(k)) productsByOdoo[k] = p;
  if (p.name) productsByName[p.name] = p;
  if (p.alias) productsByAlias[p.alias] = p;
}

const missingByOdoo = new Map();
for (const v of ventas) {
  const pid = odooKey(v.producto_id);
  if (pid == null || Number.isNaN(pid)) continue;
  if (productsByOdoo[pid]) continue;
  const byName = productsByName[v.producto];
  if (byName) continue;
  if (!missingByOdoo.has(pid)) {
    missingByOdoo.set(pid, { producto_id: pid, producto: v.producto });
  }
}

const patchIdOdoo = [];
for (const v of ventas) {
  const pid = odooKey(v.producto_id);
  if (pid == null || Number.isNaN(pid)) continue;
  if (productsByOdoo[pid]) continue;
  const byName = productsByName[v.producto];
  if (byName && (byName.id_odoo == null || byName.id_odoo === "")) {
    patchIdOdoo.push({ id: byName.id, id_odoo: pid });
  }
}

return [
  {
    json: {
      ventas,
      partnersById,
      referrersById,
      products: productRows,
      productsByOdoo,
      productsByName,
      productsByAlias,
      patchIdOdoo,
      missing_products: [...missingByOdoo.values()],
      products_loaded: productRows.length,
    },
  },
];`;

const CODE_RUNTIME_CACHE = `function buildRuntimeCache() {
  const cache = $('Code Build Caches').first().json;
  const productsByOdoo = { ...cache.productsByOdoo };
  const productsByName = { ...cache.productsByName };
  const productsByAlias = { ...(cache.productsByAlias ?? {}) };

  function register(row) {
    if (!row?.id) return;
    const k = row.id_odoo == null || row.id_odoo === "" ? null : Number(row.id_odoo);
    if (k != null && !Number.isNaN(k)) productsByOdoo[k] = row;
    if (row.name) productsByName[row.name] = row;
    if (row.alias) productsByAlias[row.alias] = row;
  }

  for (const item of $('Loop Missing Products').all()) {
    register(item.json);
  }
  return { productsByOdoo, productsByName, productsByAlias };
}

function findByLabel(maps, label) {
  if (!label) return null;
  return maps.productsByName[label] || maps.productsByAlias[label] || null;
}

function resolveProductAction(odooId, label, maps) {
  const k = odooId == null || odooId === "" ? null : Number(odooId);
  const byOdoo = k != null && !Number.isNaN(k) ? maps.productsByOdoo[k] : null;
  if (byOdoo) {
    return { action: 'use_existing', existing_product: byOdoo };
  }
  const byName = findByLabel(maps, label);
  if (byName) {
    if (byName.id_odoo != null && byName.id_odoo !== '') {
      return { action: 'use_existing', existing_product: byName };
    }
    return {
      action: 'link_only',
      supabase_id: byName.id,
      id_odoo: odooId,
      existing_product: byName,
    };
  }
  return { action: 'create' };
}`;

const CODE_PRECHECK_PRODUCT = `${CODE_RUNTIME_CACHE}
${CODE_PARSE_SUPABASE_ROWS}

function mapsFromCache(cache) {
  const productsByOdoo = { ...(cache.productsByOdoo || {}) };
  const productsByName = { ...(cache.productsByName || {}) };
  const productsByAlias = { ...(cache.productsByAlias || {}) };
  for (const p of parseSupabaseRows(cache.products)) {
    const k = p.id_odoo == null || p.id_odoo === '' ? null : Number(p.id_odoo);
    if (k != null && !Number.isNaN(k)) productsByOdoo[k] = p;
    if (p.name) productsByName[p.name] = p;
    if (p.alias) productsByAlias[p.alias] = p;
  }
  return { productsByOdoo, productsByName, productsByAlias };
}

const item = $('Loop Missing Products').item.json;
const cache = $('Code Build Caches').first().json;
const maps = buildRuntimeCache();
const base = mapsFromCache(cache);
for (const k of Object.keys(base.productsByOdoo)) maps.productsByOdoo[k] = base.productsByOdoo[k];
for (const k of Object.keys(base.productsByName)) maps.productsByName[k] = base.productsByName[k];
for (const k of Object.keys(base.productsByAlias)) maps.productsByAlias[k] = base.productsByAlias[k];

const odooId = item.producto_id;
const resolved = resolveProductAction(odooId, item.producto, maps);

if (resolved.action === 'create') {
  return [{ json: { action: 'needs_odoo', ...item, _debug_products_loaded: cache.products_loaded } }];
}
return [{ json: resolved }];`;

const CODE_AFTER_ODOO_ROUTE = `${CODE_RUNTIME_CACHE}
${CODE_PARSE_SUPABASE_ROWS}

function mapsFromCache(cache) {
  const productsByOdoo = { ...(cache.productsByOdoo || {}) };
  const productsByName = { ...(cache.productsByName || {}) };
  const productsByAlias = { ...(cache.productsByAlias || {}) };
  for (const p of parseSupabaseRows(cache.products)) {
    const k = p.id_odoo == null || p.id_odoo === '' ? null : Number(p.id_odoo);
    if (k != null && !Number.isNaN(k)) productsByOdoo[k] = p;
    if (p.name) productsByName[p.name] = p;
    if (p.alias) productsByAlias[p.alias] = p;
  }
  return { productsByOdoo, productsByName, productsByAlias };
}

const odoo = $input.first().json;
const item = $('Code PreCheck Product').item.json;
const cache = $('Code Build Caches').first().json;
const maps = buildRuntimeCache();
const base = mapsFromCache(cache);
for (const k of Object.keys(base.productsByOdoo)) maps.productsByOdoo[k] = base.productsByOdoo[k];
for (const k of Object.keys(base.productsByName)) maps.productsByName[k] = base.productsByName[k];
for (const k of Object.keys(base.productsByAlias)) maps.productsByAlias[k] = base.productsByAlias[k];

const odooId = odoo.id;
const ref = odoo.partner_ref || odoo.name || '';

let out = resolveProductAction(odooId, item.producto, maps);
if (out.action === 'create') out = resolveProductAction(odooId, ref, maps);

if (out.action === 'create') {
  return [{ json: { action: 'create', odoo } }];
}
return [{ json: out }];`;

const CODE_NORMALIZE_PRODUCT = `${CODE_RUNTIME_CACHE}
function pickRow(data) {
  if (!data) return null;
  if (data.existing_product?.id) {
    return {
      ...data.existing_product,
      id_odoo: data.id_odoo ?? data.existing_product.id_odoo,
    };
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (row?.id) return row;
  return null;
}

for (const item of $input.all()) {
  const row = pickRow(item.json);
  if (row) return [{ json: row }];
}

const maps = buildRuntimeCache();
const route = $('Code After Odoo Route').first()?.json;
const pre = $('Code PreCheck Product').first()?.json;
const odooId =
  route?.odoo?.id ??
  route?.id_odoo ??
  pre?.id_odoo ??
  pre?.producto_id ??
  null;

if (route?.existing_product?.id) {
  return [{
    json: {
      ...route.existing_product,
      id_odoo: odooId ?? route.existing_product.id_odoo,
    },
  }];
}
if (pre?.existing_product?.id) {
  return [{
    json: {
      ...pre.existing_product,
      id_odoo: odooId ?? pre.existing_product.id_odoo,
    },
  }];
}
if (odooId != null && maps.productsByOdoo[odooId]) {
  return [{ json: maps.productsByOdoo[odooId] }];
}

const fetched = $('HTTP Get Product by id_odoo').first()?.json;
const fromFetch = pickRow(fetched);
if (fromFetch) return [{ json: fromFetch }];

throw new Error(
  'Normalize product: no existe en Supabase producto con id_odoo=' + odooId
);`;

const SUPABASE_HTTP_OPTS = {
  authentication: "predefinedCredentialType",
  nodeCredentialType: "supabaseApi",
  sendHeaders: true,
  headerParameters: {
    parameters: [
      { name: "Content-Type", value: "application/json" },
      { name: "Prefer", value: "return=representation" },
    ],
  },
};

const HTTP_LINK_PRODUCT_PARAMS = {
  method: "POST",
  url: "https://cdrmxjcdgxjyakrcpxnp.supabase.co/rest/v1/rpc/patch_product_id_odoo",
  ...SUPABASE_HTTP_OPTS,
  sendBody: true,
  specifyBody: "json",
  jsonBody:
    '={"p_id": "{{ $json.supabase_id }}", "p_id_odoo": {{ $json.id_odoo }} }',
  options: {},
};

function setVentasOdooDateRange(httpNode, fromDate, toDate) {
  const n = JSON.parse(JSON.stringify(httpNode));
  if (typeof n.parameters?.jsonBody === "string") {
    n.parameters.jsonBody = n.parameters.jsonBody
      .replace(
        /(\["invoice_date", ">=", ")[^"]+("\])/,
        `$1${fromDate}$2`
      )
      .replace(
        /(\["invoice_date", "<=", ")[^"]+("\])/,
        `$1${toDate}$2`
      );
  }
  return n;
}

const CODE_SPLIT_MISSING = `const { missing_products } = $input.first().json;
return (missing_products ?? []).map((m) => ({ json: m }));`;

function mergeProductCacheCode(loopExpr) {
  return `const base = $('Code Build Caches').first().json;
const productsByOdoo = { ...base.productsByOdoo };
const productsByName = { ...base.productsByName };
const productsByAlias = { ...(base.productsByAlias ?? {}) };

const loopItems = ${loopExpr};
for (const item of loopItems) {
  const p = item.json;
  const row = p.existing_product || p;
  const idOdoo = p.id_odoo ?? row.id_odoo;
  if (row?.id && idOdoo != null) {
    const merged = { ...row, id_odoo: idOdoo };
    productsByOdoo[idOdoo] = merged;
    if (merged.name) productsByName[merged.name] = merged;
    if (merged.alias) productsByAlias[merged.alias] = merged;
  }
}

return [
  {
    json: {
      ventas: base.ventas,
      partnersById: base.partnersById,
      referrersById: base.referrersById,
      productsByOdoo,
      productsByName,
      productsByAlias: base.productsByAlias ?? {},
      patchIdOdoo: base.patchIdOdoo,
    },
  },
];`;
}

const CODE_MERGE_PRODUCT_CACHE = mergeProductCacheCode(
  "$('Loop Missing Products').all()"
);
const CODE_MERGE_NO_LOOP = mergeProductCacheCode("[]");

const CODE_BUILD_VENTAS = `/** HTTP Patch devuelve un entero; no usar $input como cache. */
function loadImportCache() {
  const tryNode = (name) => {
    try {
      if (!$(name).isExecuted) return null;
      return $(name).first().json;
    } catch {
      return null;
    }
  };
  for (const name of [
    "Code Merge Product Cache",
    "Code Merge Cache No Loop",
    "Code Build Caches",
  ]) {
    const j = tryNode(name);
    if (j && Array.isArray(j.ventas)) return j;
  }
  throw new Error("No se encontró cache de import con ventas[]");
}

const {
  ventas,
  partnersById,
  referrersById,
  productsByOdoo,
  productsByName,
  productsByAlias,
  patchIdOdoo,
} = loadImportCache();

function resolvePartnerContext(v) {
  const partner = partnersById[v.partner_id] ?? {};
  const referrer = v.referrer_id ? referrersById[v.referrer_id] ?? {} : {};
  const country = partner.country || referrer.country || "";
  const institucion = referrer.institucion || null;
  return { country, institucion };
}

function resolveProduct(v) {
  const pid = v.producto_id == null ? null : Number(v.producto_id);
  if (pid != null && !Number.isNaN(pid) && productsByOdoo[pid]) return productsByOdoo[pid];
  const byName =
    productsByName[v.producto] || (productsByAlias && productsByAlias[v.producto]);
  if (byName) return byName;
  throw new Error(
    \`Producto no resuelto: odoo=\${pid} nombre=\${v.producto} partner=\${v.partner}\`
  );
}

const ventaRows = [];
let skippedZeroQty = 0;
for (const v of ventas) {
  const qty = Number(v.cantidad);
  if (!Number.isFinite(qty) || qty === 0) {
    skippedZeroQty++;
    continue;
  }
  const product = resolveProduct(v);
  const { country, institucion } = resolvePartnerContext(v);
  ventaRows.push({
    fecha: v.fecha_dia_inicio,
    test: product.alias || product.name,
    amount: v.precio_total,
    company: v.empresa,
    id_producto: product.id,
    partner: v.partner,
    quantity: qty,
    move_id: v.move_id,
    move_nombre: v.move_nombre,
    medico: v.referrer || null,
    institucion,
    pais: country || null,
  });
}

return [
  {
    json: {
      ventaRows,
      patchIdOdoo: patchIdOdoo ?? [],
      total: ventaRows.length,
      skipped_zero_qty: skippedZeroQty,
    },
  },
];`;

const CODE_SUMMARY = `const bulk = $('HTTP Bulk Upsert Ventas').first().json;
const built = $('Code Build Ventas Rows').first().json;
return [
  {
    json: {
      total_ventas: built.total ?? 0,
      skipped_zero_qty: built.skipped_zero_qty ?? 0,
      bulk_status: bulk?.status ?? bulk?.length ?? "ok",
      mensaje: "Import optimizado finalizado",
    },
  },
];`;

const ODOO_DB = "zanello1234-southgeneticsv17-main-10564043";
const ODOO_PASS = "@ALFON2004so";

const CODE_AFTER_BATCH_MERGE = `${CODE_PARSE_SUPABASE_ROWS}
const extract = $('Code Extract Unique IDs').first().json;
const partnerRows = $('HTTP Batch Partners').first().json.result ?? [];
const referrerRows = $('HTTP Batch Referrers').first().json.result ?? [];

const products = loadAllProductsFromHttp('HTTP Batch Products Supabase');

return [{ json: { ...extract, partnerRows, referrerRows, products, products_loaded: products.length } }];`;

function buildOptimizedWorkflow(original) {
  const origNodes = original.nodes;
  const schedule = pickNode(origNodes, "Schedule Trigger");
  const login = pickNode(origNodes, "login1");
  const httpVentas = setVentasOdooDateRange(
    pickNode(origNodes, "HTTP Request3"),
    "2025-01-01",
    "2026-12-31"
  );
  const code9 = pickNode(origNodes, "Code in JavaScript9");
  const code8 = pickNode(origNodes, "Code in JavaScript8");
  const code10 = pickNode(origNodes, "Code in JavaScript10");
  const editFields = origNodes.find((n) => n.name === "Edit Fields");
  const getOdooProduct = pickNode(origNodes, "Get an item");

  const supabaseCred = { supabaseApi: { id: "XHcaljVEAHxnAcxd", name: "P&L" } };
  const odooCred = getOdooProduct.credentials;

  const partnerFields = [
    "id",
    "name",
    "country_id",
    "parent_id",
    "commercial_partner_id",
    "company_name",
    "is_company",
    "institucion_id",
  ];

  const nodes = [
    schedule,
    login,
    httpVentas,
    code9,
    ...(editFields ? [editFields] : []),
    code8,
    code10,
    {
      parameters: { jsCode: CODE_EXTRACT_IDS },
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [880, 224],
      id: uuid(),
      name: "Code Extract Unique IDs",
    },
    {
      parameters: {
        url: "https://southgenetics.odoo.com/jsonrpc",
        sendBody: true,
        specifyBody: "json",
        jsonBody: `={
  "jsonrpc": "2.0",
  "method": "call",
  "params": {
    "service": "object",
    "method": "execute_kw",
    "args": [
      "${ODOO_DB}",
      193,
      "${ODOO_PASS}",
      "res.partner",
      "read",
      [{{ JSON.stringify($json.partner_ids) }}],
      { "fields": ${JSON.stringify(partnerFields)} }
    ]
  }
}`,
        options: {},
      },
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.4,
      position: [1104, 160],
      id: uuid(),
      name: "HTTP Batch Partners",
    },
    {
      parameters: {
        url: "https://southgenetics.odoo.com/jsonrpc",
        sendBody: true,
        specifyBody: "json",
        jsonBody: `={
  "jsonrpc": "2.0",
  "method": "call",
  "params": {
    "service": "object",
    "method": "execute_kw",
    "args": [
      "${ODOO_DB}",
      193,
      "${ODOO_PASS}",
      "res.partner",
      "read",
      [{{ JSON.stringify($json.referrer_ids) }}],
      {
        "fields": ${JSON.stringify(partnerFields)}
      }
    ]
  }
}`,
        options: {},
      },
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.4,
      position: [1104, 288],
      id: uuid(),
      name: "HTTP Batch Referrers",
    },
    {
      parameters: {
        method: "GET",
        url: "https://cdrmxjcdgxjyakrcpxnp.supabase.co/rest/v1/products?select=id,id_odoo,name,alias&limit=1000",
        authentication: "predefinedCredentialType",
        nodeCredentialType: "supabaseApi",
        sendHeaders: true,
        headerParameters: {
          parameters: [
            { name: "Accept", value: "application/json" },
            { name: "Prefer", value: "return=representation" },
          ],
        },
        options: { response: { response: { neverError: true } } },
      },
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.4,
      position: [1104, 416],
      id: uuid(),
      name: "HTTP Batch Products Supabase",
      credentials: supabaseCred,
    },
    {
      parameters: { mode: "append", numberInputs: 3 },
      type: "n8n-nodes-base.merge",
      typeVersion: 3.2,
      position: [1328, 288],
      id: uuid(),
      name: "Merge Batch Fetches",
    },
    {
      parameters: { jsCode: CODE_AFTER_BATCH_MERGE },
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [1552, 288],
      id: uuid(),
      name: "Code After Batch Merge",
    },
    {
      parameters: { jsCode: CODE_BUILD_CACHES },
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [1776, 288],
      id: uuid(),
      name: "Code Build Caches",
    },
    {
      parameters: {
        conditions: {
          options: { caseSensitive: true, leftValue: "", typeValidation: "strict", version: 3 },
          conditions: [
            {
              id: uuid(),
              leftValue: "={{ ($json.missing_products ?? []).length }}",
              rightValue: 0,
              operator: { type: "number", operation: "gt" },
            },
          ],
          combinator: "and",
        },
        options: {},
      },
      type: "n8n-nodes-base.if",
      typeVersion: 2.3,
      position: [2000, 288],
      id: uuid(),
      name: "If Missing Products",
    },
    {
      parameters: { jsCode: CODE_SPLIT_MISSING },
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [2224, 208],
      id: uuid(),
      name: "Code Split Missing Products",
    },
    {
      parameters: { options: {} },
      type: "n8n-nodes-base.splitInBatches",
      typeVersion: 3,
      position: [2448, 208],
      id: uuid(),
      name: "Loop Missing Products",
    },
    {
      parameters: { jsCode: CODE_PRECHECK_PRODUCT },
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [2448, 208],
      id: uuid(),
      name: "Code PreCheck Product",
    },
    {
      parameters: {
        conditions: {
          options: { caseSensitive: true, leftValue: "", typeValidation: "strict", version: 3 },
          conditions: [
            {
              id: uuid(),
              leftValue: "={{ $json.action }}",
              rightValue: "needs_odoo",
              operator: { type: "string", operation: "equals" },
            },
          ],
          combinator: "and",
        },
        options: {},
      },
      type: "n8n-nodes-base.if",
      typeVersion: 2.3,
      position: [2672, 208],
      id: uuid(),
      name: "If Needs Odoo",
    },
    {
      parameters: {
        conditions: {
          options: { caseSensitive: true, leftValue: "", typeValidation: "strict", version: 3 },
          conditions: [
            {
              id: uuid(),
              leftValue: "={{ $json.action }}",
              rightValue: "link_only",
              operator: { type: "string", operation: "equals" },
            },
          ],
          combinator: "and",
        },
        options: {},
      },
      type: "n8n-nodes-base.if",
      typeVersion: 2.3,
      position: [2896, 320],
      id: uuid(),
      name: "If Link Only PreCheck",
    },
    {
      parameters: HTTP_LINK_PRODUCT_PARAMS,
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.4,
      position: [3120, 128],
      id: uuid(),
      name: "HTTP Link Product id_odoo",
      alwaysOutputData: true,
      credentials: supabaseCred,
    },
    {
      ...getOdooProduct,
      position: [2896, 288],
      id: uuid(),
      name: "Get Odoo Product",
      parameters: {
        ...getOdooProduct.parameters,
        customResourceId: "={{ $json.producto_id }}",
      },
    },
    {
      parameters: { jsCode: CODE_AFTER_ODOO_ROUTE },
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [3120, 288],
      id: uuid(),
      name: "Code After Odoo Route",
    },
    {
      parameters: {
        conditions: {
          options: { caseSensitive: true, leftValue: "", typeValidation: "strict", version: 3 },
          conditions: [
            {
              id: uuid(),
              leftValue: "={{ $json.action }}",
              rightValue: "create",
              operator: { type: "string", operation: "equals" },
            },
          ],
          combinator: "and",
        },
        options: {},
      },
      type: "n8n-nodes-base.if",
      typeVersion: 2.3,
      position: [3344, 288],
      id: uuid(),
      name: "If Product Create",
    },
    {
      parameters: {
        conditions: {
          options: { caseSensitive: true, leftValue: "", typeValidation: "strict", version: 3 },
          conditions: [
            {
              id: uuid(),
              leftValue: "={{ $json.action }}",
              rightValue: "link_only",
              operator: { type: "string", operation: "equals" },
            },
          ],
          combinator: "and",
        },
        options: {},
      },
      type: "n8n-nodes-base.if",
      typeVersion: 2.3,
      position: [3568, 368],
      id: uuid(),
      name: "If Link Only After Odoo",
    },
    {
      parameters: {
        method: "POST",
        url: "https://cdrmxjcdgxjyakrcpxnp.supabase.co/rest/v1/products?on_conflict=id_odoo",
        authentication: "predefinedCredentialType",
        nodeCredentialType: "supabaseApi",
        sendHeaders: true,
        headerParameters: {
          parameters: [
            { name: "Content-Type", value: "application/json" },
            {
              name: "Prefer",
              value: "resolution=ignore-duplicates,return=representation",
            },
          ],
        },
        sendBody: true,
        specifyBody: "json",
        jsonBody: `=[{
  "name": {{ JSON.stringify($json.odoo.partner_ref) }},
  "base_price": {{ $json.odoo.sale_avg_price ?? 0 }},
  "currency": {{ JSON.stringify(Array.isArray($json.odoo.company_currency_id) ? $json.odoo.company_currency_id[1] : "") }},
  "user_id": "6d02200b-5a44-4883-a392-34ca35ce0b6d",
  "category": {{ JSON.stringify(Array.isArray($json.odoo.categ_id) ? $json.odoo.categ_id[1] : "") }},
  "alias": {{ JSON.stringify($json.odoo.partner_ref) }},
  "id_odoo": {{ $json.odoo.id }}
}]`,
        options: {},
      },
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.4,
      position: [3568, 208],
      id: uuid(),
      name: "HTTP Insert Product",
      alwaysOutputData: true,
      credentials: supabaseCred,
    },
    {
      parameters: {
        method: "GET",
        url: "=https://cdrmxjcdgxjyakrcpxnp.supabase.co/rest/v1/products?select=id,id_odoo,name,alias,base_price,currency,category,user_id,description,tipo&id_odoo=eq.{{ $('Code After Odoo Route').first().json.odoo.id }}&limit=1",
        authentication: "predefinedCredentialType",
        nodeCredentialType: "supabaseApi",
        sendHeaders: true,
        headerParameters: {
          parameters: [{ name: "Accept", value: "application/json" }],
        },
        options: { response: { response: { neverError: true } } },
      },
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.4,
      position: [3792, 208],
      id: uuid(),
      name: "HTTP Get Product by id_odoo",
      alwaysOutputData: true,
      credentials: supabaseCred,
    },
    {
      parameters: HTTP_LINK_PRODUCT_PARAMS,
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.4,
      position: [3568, 368],
      id: uuid(),
      name: "HTTP Link After Odoo",
      alwaysOutputData: true,
      credentials: supabaseCred,
    },
    {
      parameters: { jsCode: CODE_NORMALIZE_PRODUCT },
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [4016, 288],
      id: uuid(),
      name: "Code Normalize Product",
      alwaysOutputData: true,
    },
    {
      parameters: { jsCode: CODE_MERGE_PRODUCT_CACHE },
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [2224, 400],
      id: uuid(),
      name: "Code Merge Product Cache",
    },
    {
      parameters: { jsCode: CODE_MERGE_NO_LOOP },
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [2224, 520],
      id: uuid(),
      name: "Code Merge Cache No Loop",
    },
    {
      parameters: {
        conditions: {
          options: { caseSensitive: true, leftValue: "", typeValidation: "strict", version: 3 },
          conditions: [
            {
              id: uuid(),
              leftValue: "={{ ($json.patchIdOdoo ?? []).length }}",
              rightValue: 0,
              operator: { type: "number", operation: "gt" },
            },
          ],
          combinator: "and",
        },
        options: {},
      },
      type: "n8n-nodes-base.if",
      typeVersion: 2.3,
      position: [2448, 400],
      id: uuid(),
      name: "If Patch Products",
    },
    {
      parameters: {
        method: "POST",
        url: "https://cdrmxjcdgxjyakrcpxnp.supabase.co/rest/v1/rpc/bulk_patch_products_id_odoo",
        ...SUPABASE_HTTP_OPTS,
        sendBody: true,
        specifyBody: "json",
        jsonBody: '={"payload": {{ JSON.stringify($json.patchIdOdoo) }} }',
        options: {},
      },
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.4,
      position: [2672, 352],
      id: uuid(),
      name: "HTTP Patch Products id_odoo",
      alwaysOutputData: true,
      credentials: supabaseCred,
    },
    {
      parameters: { jsCode: CODE_BUILD_VENTAS },
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [2896, 400],
      id: uuid(),
      name: "Code Build Ventas Rows",
    },
    {
      parameters: {
        method: "POST",
        url: "https://cdrmxjcdgxjyakrcpxnp.supabase.co/rest/v1/ventas?on_conflict=company,fecha,move_id,id_producto,partner",
        authentication: "predefinedCredentialType",
        nodeCredentialType: "supabaseApi",
        sendHeaders: true,
        headerParameters: {
          parameters: [
            { name: "Content-Type", value: "application/json" },
            { name: "Prefer", value: "resolution=merge-duplicates,return=minimal" },
          ],
        },
        sendBody: true,
        specifyBody: "json",
        jsonBody: "={{ JSON.stringify($json.ventaRows) }}",
        options: {},
      },
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.4,
      position: [3120, 400],
      id: uuid(),
      name: "HTTP Bulk Upsert Ventas",
      credentials: supabaseCred,
    },
    {
      parameters: { jsCode: CODE_SUMMARY },
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [3344, 400],
      id: uuid(),
      name: "Code Summary",
    },
  ];

  // Reposition stats nodes
  code8.position = [624, 32];
  code10.position = [624, 416];

  const connections = {
    "Schedule Trigger": { main: [[{ node: "login1", type: "main", index: 0 }]] },
    login1: { main: [[{ node: "HTTP Request3", type: "main", index: 0 }]] },
    "HTTP Request3": {
      main: [[{ node: "Code in JavaScript9", type: "main", index: 0 }]],
    },
    "Code in JavaScript9": {
      main: [
        [
          { node: "Code in JavaScript8", type: "main", index: 0 },
          { node: "Code in JavaScript10", type: "main", index: 0 },
          { node: "Code Extract Unique IDs", type: "main", index: 0 },
        ],
      ],
    },
    "Code Extract Unique IDs": {
      main: [
        [
          { node: "HTTP Batch Partners", type: "main", index: 0 },
          { node: "HTTP Batch Referrers", type: "main", index: 0 },
          { node: "HTTP Batch Products Supabase", type: "main", index: 0 },
        ],
      ],
    },
    "HTTP Batch Partners": {
      main: [[{ node: "Merge Batch Fetches", type: "main", index: 0 }]],
    },
    "HTTP Batch Referrers": {
      main: [[{ node: "Merge Batch Fetches", type: "main", index: 1 }]],
    },
    "HTTP Batch Products Supabase": {
      main: [[{ node: "Merge Batch Fetches", type: "main", index: 2 }]],
    },
    "Merge Batch Fetches": {
      main: [[{ node: "Code After Batch Merge", type: "main", index: 0 }]],
    },
    "Code After Batch Merge": {
      main: [[{ node: "Code Build Caches", type: "main", index: 0 }]],
    },
    "Code Build Caches": {
      main: [[{ node: "If Missing Products", type: "main", index: 0 }]],
    },
    "If Missing Products": {
      main: [
        [{ node: "Code Split Missing Products", type: "main", index: 0 }],
        [{ node: "Code Merge Cache No Loop", type: "main", index: 0 }],
      ],
    },
    "Code Split Missing Products": {
      main: [[{ node: "Loop Missing Products", type: "main", index: 0 }]],
    },
    "Code Merge Cache No Loop": {
      main: [[{ node: "If Patch Products", type: "main", index: 0 }]],
    },
    "Loop Missing Products": {
      main: [
        [{ node: "Code Merge Product Cache", type: "main", index: 0 }],
        [{ node: "Code PreCheck Product", type: "main", index: 0 }],
      ],
    },
    "Code PreCheck Product": {
      main: [[{ node: "If Needs Odoo", type: "main", index: 0 }]],
    },
    "If Needs Odoo": {
      main: [
        [{ node: "Get Odoo Product", type: "main", index: 0 }],
        [{ node: "If Link Only PreCheck", type: "main", index: 0 }],
      ],
    },
    "If Link Only PreCheck": {
      main: [
        [{ node: "HTTP Link Product id_odoo", type: "main", index: 0 }],
        [{ node: "Code Normalize Product", type: "main", index: 0 }],
      ],
    },
    "HTTP Link Product id_odoo": {
      main: [[{ node: "Code Normalize Product", type: "main", index: 0 }]],
    },
    "Get Odoo Product": {
      main: [[{ node: "Code After Odoo Route", type: "main", index: 0 }]],
    },
    "Code After Odoo Route": {
      main: [[{ node: "If Product Create", type: "main", index: 0 }]],
    },
    "If Product Create": {
      main: [
        [{ node: "HTTP Insert Product", type: "main", index: 0 }],
        [{ node: "If Link Only After Odoo", type: "main", index: 0 }],
      ],
    },
    "If Link Only After Odoo": {
      main: [
        [{ node: "HTTP Link After Odoo", type: "main", index: 0 }],
        [{ node: "Code Normalize Product", type: "main", index: 0 }],
      ],
    },
    "HTTP Insert Product": {
      main: [[{ node: "HTTP Get Product by id_odoo", type: "main", index: 0 }]],
    },
    "HTTP Get Product by id_odoo": {
      main: [[{ node: "Code Normalize Product", type: "main", index: 0 }]],
    },
    "HTTP Link After Odoo": {
      main: [[{ node: "Code Normalize Product", type: "main", index: 0 }]],
    },
    "Code Normalize Product": {
      main: [[{ node: "Loop Missing Products", type: "main", index: 0 }]],
    },
    "Code Merge Product Cache": {
      main: [[{ node: "If Patch Products", type: "main", index: 0 }]],
    },
    "If Patch Products": {
      main: [
        [{ node: "HTTP Patch Products id_odoo", type: "main", index: 0 }],
        [{ node: "Code Build Ventas Rows", type: "main", index: 0 }],
      ],
    },
    "HTTP Patch Products id_odoo": {
      main: [[{ node: "Code Build Ventas Rows", type: "main", index: 0 }]],
    },
    "Code Build Ventas Rows": {
      main: [[{ node: "HTTP Bulk Upsert Ventas", type: "main", index: 0 }]],
    },
    "HTTP Bulk Upsert Ventas": {
      main: [[{ node: "Code Summary", type: "main", index: 0 }]],
    },
  };

  return {
    name: "Real Import Productos (Optimized)",
    nodes,
    connections,
    settings: { executionOrder: "v1" },
    staticData: null,
  };
}

const WORKFLOW_OPTIMIZED_ID = "6QBAVjroEr0o3Gqv";

async function main() {
  const apiKey = loadApiKey();
  const original = JSON.parse(fs.readFileSync(EXPORT_PATH, "utf8"));
  const payload = buildOptimizedWorkflow(original);

  const outPath = path.join(
    ROOT,
    "exports/n8n-real-import-productos-optimized.json"
  );
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");
  console.log("Export local:", outPath);

  const updateId = process.argv.includes("--update")
    ? process.argv[process.argv.indexOf("--update") + 1] || WORKFLOW_OPTIMIZED_ID
    : null;

  const url = updateId
    ? `${N8N_BASE}/api/v1/workflows/${updateId}`
    : `${N8N_BASE}/api/v1/workflows`;
  const method = updateId ? "PUT" : "POST";

  const res = await fetch(url, {
    method,
    headers: {
      "X-N8N-API-KEY": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  if (!res.ok) {
    console.error(`Error ${updateId ? "actualizando" : "creando"} workflow:`, res.status, text);
    process.exit(1);
  }

  const wf = JSON.parse(text);
  console.log(updateId ? "Workflow actualizado en n8n:" : "Workflow creado en n8n:");
  console.log("  id:", wf.id);
  console.log("  name:", wf.name);
  console.log("  URL:", `${N8N_BASE}/workflow/${wf.id}`);
  if (!updateId) {
    console.log("\nOriginal intacto: ux5h4tbSHE6SfRXA (Real Import Productos)");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
