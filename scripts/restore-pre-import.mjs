/**
 * Restaura ventas y/o products desde tablas backup_* o JSON local.
 *
 * Uso:
 *   node scripts/restore-pre-import.mjs --manifest exports/backups/pre-import-YYYYMMDD_HHMMSS/manifest.json
 *   node scripts/restore-pre-import.mjs --manifest ... --only ventas
 *   node scripts/restore-pre-import.mjs --json exports/backups/pre-import-.../ventas.json --table ventas
 *
 * Requiere SUPABASE_SERVICE_ROLE_KEY (operación destructiva: TRUNCATE + INSERT).
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
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

const args = process.argv.slice(2);
const manifestIdx = args.indexOf("--manifest");
const onlyIdx = args.indexOf("--only");
const manifestPath =
  manifestIdx >= 0 ? resolve(root, args[manifestIdx + 1]) : null;
const only = onlyIdx >= 0 ? args[onlyIdx + 1] : "both";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Falta SUPABASE_SERVICE_ROLE_KEY en .env.local (necesario para restaurar).");
  process.exit(1);
}

const supabase = createClient(url, key);

async function execSql(query) {
  const { error } = await supabase.rpc("exec_sql", { query });
  if (error?.message?.includes("exec_sql")) {
    throw new Error(
      "RPC exec_sql no disponible. Usá el SQL del manifest en Supabase SQL Editor:\n" + query
    );
  }
  if (error) throw error;
}

async function restoreFromBackupTable(target, backupTable) {
  const sql = `TRUNCATE public.${target} RESTART IDENTITY CASCADE; INSERT INTO public.${target} SELECT * FROM public.${backupTable};`;
  console.log("Ejecutando:", sql.slice(0, 120) + "...");
  const { error } = await supabase.from(target).delete().neq("id", "00000000-0000-0000-0000-000000000000");
  // delete all via filter won't work for all rows - must use SQL
  if (error) console.warn("delete fallback:", error.message);
  throw new Error(
    "Restauración desde tabla backup requiere SQL en Supabase. Copiá y ejecutá:\n\n" + sql
  );
}

async function restoreFromJson(table, jsonPath) {
  const rows = JSON.parse(readFileSync(jsonPath, "utf8"));
  console.log(`Restaurando ${table} desde JSON (${rows.length} filas)...`);

  const { error: delErr } = await supabase.from(table).delete().gte("created_at", "1970-01-01");
  // ventas may not have created_at - use different approach

  if (table === "ventas") {
    const { count } = await supabase.from("ventas").select("*", { count: "exact", head: true });
    console.log("Filas actuales en ventas:", count);
  }

  // Batch delete: not supported well - use SQL truncate via REST is not available
  // Chunk insert after manual truncate instruction
  const batch = 500;
  for (let i = 0; i < rows.length; i += batch) {
    const chunk = rows.slice(i, i + batch);
    const { error } = await supabase.from(table).insert(chunk);
    if (error) throw new Error(`${table} insert lote ${i}: ${error.message}`);
    console.log(`  insertadas ${Math.min(i + batch, rows.length)} / ${rows.length}`);
  }
}

async function main() {
  if (!manifestPath || !existsSync(manifestPath)) {
    console.error("Uso: node scripts/restore-pre-import.mjs --manifest exports/backups/.../manifest.json");
    process.exit(1);
  }

  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const baseDir = dirname(manifestPath);

  console.log("=== Restaurar desde respaldo ===");
  console.log("Creado:", manifest.created_at);
  console.log("Ventas en backup:", manifest.ventas_count);
  console.log("Products en backup:", manifest.products_count);

  console.log("\n--- OPCIÓN A (recomendada): SQL en Supabase ---\n");
  if (only === "both" || only === "ventas") {
    console.log(manifest.sql_restore_ventas);
  }
  if (only === "both" || only === "products") {
    console.log(manifest.sql_restore_products);
  }

  console.log("\n--- OPCIÓN B: JSON (después de TRUNCATE manual) ---\n");
  console.log("1. TRUNCATE public.ventas;  (y products si aplica)");
  console.log("2. node scripts/restore-pre-import.mjs --json", resolve(baseDir, "ventas.json"), "--table ventas");
  console.log("\nTablas backup en servidor (si las creaste):");
  console.log("  ", manifest.ventas_table);
  console.log("  ", manifest.products_table);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
