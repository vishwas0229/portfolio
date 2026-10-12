#!/usr/bin/env node
"use strict";
const TABLES = {
  projects: ["id","title","slug","summary","description","tech_stack","repository_url","demo_url","image_url","featured","display_order","published","created_at","updated_at"],
  certificates: ["id","title","issuer","issued_on","credential_url","image_url","description","display_order","published","created_at","updated_at"],
  contact_messages: ["id","name","email","subject","message","page_url","status","created_at","read_at","archived_at"],
  analytics_events: ["id","event_name","event_date","section","project_slug","metadata","created_at"],
  admins: ["id","email","password_hash","role","active","session_version","created_at","updated_at"]
};
function normalizeRow(table, row) {
  if (!TABLES[table]) throw new Error("Unsupported table");
  const out = {};
  for (const key of TABLES[table]) {
    let value = row[key];
    if (value === undefined) continue;
    if (value instanceof Date) value = value.toISOString();
    if (value === null) { out[key] = null; continue; }
    if (["tech_stack","metadata"].includes(key) && typeof value === "string") {
      try { value = JSON.parse(value); } catch (_) {}
    }
    if (["featured","published","active"].includes(key)) value = value === true || value === 1 || value === "1";
    if (["display_order","session_version"].includes(key) && Number.isFinite(Number(value))) value = Number(value);
    out[key] = value;
  }
  if (out.id === undefined || out.id === null || out.id === "") throw new Error("Source row is missing its primary id");
  out.id = String(out.id);
  return out;
}
async function main() {
  const apply = process.argv.includes("--apply");
  const overwrite = process.argv.includes("--overwrite");
  const raw = String(process.env.DATABASE_URL || "").trim();
  if (!raw) throw new Error("Set DATABASE_URL privately to the source MySQL database.");
  const url = new URL(raw);
  if (url.protocol !== "mysql:") throw new Error("DATABASE_URL must use mysql://");
  const mysql = require("mysql2/promise");
  const conn = await mysql.createConnection({
    host: url.hostname, port: Number(url.port || 3306),
    user: decodeURIComponent(url.username), password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.replace(/^\//, "")), connectTimeout: 10000
  });
  try {
    const source = {};
    const counts = {};
    for (const table of Object.keys(TABLES)) {
      const [rows] = await conn.query("SELECT * FROM `" + table + "`");
      source[table] = rows.map(row => normalizeRow(table, row));
      counts[table] = rows.length;
    }
    console.log("Source row counts:", JSON.stringify(counts, null, 2));
    if (!apply) {
      console.log("DRY RUN: no Firestore writes made. Back up MySQL and review counts first.");
      return;
    }
    const { getApps, initializeApp } = require("firebase-admin/app");
    const { getFirestore } = require("firebase-admin/firestore");
    const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || "portfolio-562da";
    const app = getApps()[0] || initializeApp({ projectId });
    const db = getFirestore(app);
    for (const table of Object.keys(TABLES)) {
      const existing = await db.collection(table).limit(1).get();
      if (!existing.empty && !overwrite) throw new Error("Collection " + table + " is not empty. Inspect it; use --overwrite only intentionally.");
    }
    for (const table of Object.keys(TABLES)) {
      const rows = source[table];
      for (let i = 0; i < rows.length; i += 400) {
        const batch = db.batch();
        for (const row of rows.slice(i, i + 400)) batch.set(db.collection(table).doc(row.id), row, { merge: overwrite });
        await batch.commit();
      }
      console.log("Imported", rows.length, "documents into", table);
    }
    console.log("Import done. Verify counts and API behavior before switching traffic.");
  } finally {
    await conn.end();
  }
}
module.exports = { normalizeRow, TABLES };
if (require.main === module) main().catch(error => { console.error("[migration]", error.message); process.exitCode = 1; });
