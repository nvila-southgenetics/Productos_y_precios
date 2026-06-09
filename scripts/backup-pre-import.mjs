/**
 * Respaldo de ventas + products antes de import n8n.
 * - Tablas _backup_* en Supabase (restauración rápida con restore-pre-import.mjs)
 * - JSON en exports/backups/<timestamp>/
 *
 * Uso: node scripts/backup-pre-import.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function loadEnv() {
  for (const f of [".env.local", ".env"]) {
    const p = resolve(root, f);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split("\n")) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  }
}

loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}

const supabase = createClient(url, key);

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

async function fetchAll(table, pageSize = 1000) {
  const rows = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

async function main() {
  const ts = timestamp();
  const ventasTable = `backup_ventas_pre_import_${ts}`;
  const productsTable = `backup_products_pre_import_${ts}`;

  console.log("Exportando ventas y products...");
  const [ventas, products] = await Promise.all([
    fetchAll("ventas"),
    fetchAll("products"),
  ]);

  const dir = resolve(root, "exports", "backups", `pre-import-${ts}`);
  mkdirSync(dir, { recursive: true });

  writeFileSync(resolve(dir, "ventas.json"), JSON.stringify(ventas, null, 0));
  writeFileSync(resolve(dir, "products.json"), JSON.stringify(products, null, 0));

  const manifest = {
    created_at: new Date().toISOString(),
    ventas_count: ventas.length,
    products_count: products.length,
    ventas_table: ventasTable,
    products_table: productsTable,
    restore_command: `node scripts/restore-pre-import.mjs --manifest exports/backups/pre-import-${ts}/manifest.json`,
    sql_restore_ventas: `TRUNCATE public.ventas; INSERT INTO public.ventas SELECT * FROM public.${ventasTable};`,
    sql_restore_products: `TRUNCATE public.products; INSERT INTO public.products SELECT * FROM public.${productsTable};`,
  };

  writeFileSync(
    resolve(dir, "manifest.json"),
    JSON.stringify(manifest, null, 2),
    "utf8"
  );

  // SQL para ejecutar en Supabase (tablas de respaldo en servidor)
  const sqlPath = resolve(dir, "create-backup-tables.sql");
  const sql = `-- Ejecutar en Supabase SQL Editor o: node scripts/apply-backup-sql.mjs
DROP TABLE IF EXISTS public.${ventasTable};
CREATE TABLE public.${ventasTable} AS SELECT * FROM public.ventas;

DROP TABLE IF EXISTS public.${productsTable};
CREATE TABLE public.${productsTable} AS SELECT * FROM public.products;

-- Verificación
SELECT '${ventasTable}' AS backup, count(*)::int AS filas FROM public.${ventasTable}
UNION ALL
SELECT '${productsTable}', count(*)::int FROM public.${productsTable};
`;
  writeFileSync(sqlPath, sql, "utf8");

  console.log("\n=== Respaldo local OK ===");
  console.log("Carpeta:", dir);
  console.log("  ventas:", ventas.length, "filas");
  console.log("  products:", products.length, "filas");
  console.log("\nTablas SQL sugeridas:");
  console.log("  public." + ventasTable);
  console.log("  public." + productsTable);
  console.log("\nSQL guardado en:", sqlPath);
  console.log("\nSiguiente: crear tablas en Supabase (MCP o SQL Editor).");
  console.log("Manifest:", resolve(dir, "manifest.json"));

  return { ts, ventasTable, productsTable, ventas: ventas.length, products: products.length };
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
