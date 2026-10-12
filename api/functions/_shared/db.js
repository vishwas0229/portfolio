const crypto = require("node:crypto");
const { config } = require("./config");

const TABLE_COLUMNS = Object.freeze({
  projects: ["id","title","slug","summary","description","tech_stack","repository_url","demo_url","image_url","featured","display_order","published","created_at","updated_at"],
  certificates: ["id","title","issuer","issued_on","credential_url","image_url","description","display_order","published","created_at","updated_at"],
  contact_messages: ["id","name","email","subject","message","page_url","status","created_at","read_at","archived_at"],
  analytics_events: ["id","event_name","event_date","section","project_slug","metadata","created_at"],
  admins: ["id","email","password_hash","role","active","session_version","created_at","updated_at"]
});

const JSON_COLUMNS = new Set(["tech_stack", "metadata"]);
const NUMERIC_COLUMNS = new Set(["display_order", "session_version"]);
const BOOLEAN_COLUMNS = new Set(["featured", "published", "active"]);
let firestore;

function getFirestore() {
  if (firestore) return firestore;
  const { getFirestore: createFirestore } = require("firebase-admin/firestore");
  const { getFirebaseAdminApp } = require("./firebase-admin");
  firestore = createFirestore(getFirebaseAdminApp());
  return firestore;
}

function assertTable(table) {
  if (!Object.hasOwn(TABLE_COLUMNS, table)) throw new Error("Unsupported collection");
}

function parseQuery(table, query = "") {
  assertTable(table);
  const allowed = new Set(TABLE_COLUMNS[table]);
  const params = new URLSearchParams(String(query || "").replace(/^\?/, ""));
  const requested = params.get("select") || "*";
  const columns = (requested === "*" ? TABLE_COLUMNS[table] : requested.split(","))
    .map(value => value.trim())
    .filter(value => /^[A-Za-z_][A-Za-z0-9_]*$/.test(value) && allowed.has(value));
  if (!columns.length) throw new Error("Invalid select list");

  const filters = [];
  for (const [field, raw] of params.entries()) {
    if (["select", "order", "limit"].includes(field)) continue;
    if (!allowed.has(field)) throw new Error("Unsupported query filter");
    const separator = raw.indexOf(".");
    if (separator < 1) throw new Error("Invalid query filter");
    const operator = raw.slice(0, separator);
    let value = raw.slice(separator + 1);
    if (operator === "is" && value === "null") {
      filters.push({ field, operator: "==", value: null });
      continue;
    }
    const firestoreOperator = ({ eq: "==", neq: "!=", gt: ">", gte: ">=", lt: "<", lte: "<=" })[operator];
    if (!firestoreOperator) throw new Error("Unsupported query operator");
    if (value === "true") value = true;
    else if (value === "false") value = false;
    else if (value === "null") value = null;
    else if (NUMERIC_COLUMNS.has(field) && value !== "" && Number.isFinite(Number(value))) value = Number(value);
    else if (BOOLEAN_COLUMNS.has(field) && (value === "1" || value === "0")) value = value === "1";
    filters.push({ field, operator: firestoreOperator, value });
  }

  const orderBy = [];
  const orderParam = params.get("order");
  if (orderParam) {
    for (const item of orderParam.split(",").filter(Boolean)) {
      const [field, direction = "asc"] = item.trim().split(".");
      if (!allowed.has(field) || !["asc", "desc"].includes(direction)) throw new Error("Unsupported order");
      orderBy.push({ field, direction });
    }
  }

  let limit = null;
  if (params.has("limit")) {
    limit = Number(params.get("limit"));
    if (!Number.isInteger(limit) || limit < 1 || limit > 1000) throw new Error("Invalid limit");
  }
  return { columns, filters, orderBy, limit };
}

function hydrateRow(data, columns) {
  const output = {};
  for (const column of columns) {
    if (data[column] !== undefined) output[column] = data[column];
  }
  for (const column of JSON_COLUMNS) {
    if (typeof output[column] === "string") {
      try { output[column] = JSON.parse(output[column]); } catch (_) {}
    }
  }
  return output;
}

function prepareRecord(table, row = {}) {
  assertTable(table);
  const allowed = new Set(TABLE_COLUMNS[table]);
  const output = {};
  for (const [key, value] of Object.entries(row)) {
    if (!allowed.has(key) || value === undefined) continue;
    output[key] = JSON_COLUMNS.has(key) && typeof value === "string"
      ? (() => { try { return JSON.parse(value); } catch (_) { return value; } })()
      : value;
  }
  if (!output.id) output.id = crypto.randomUUID();
  const now = new Date().toISOString();
  if (["projects", "certificates", "contact_messages", "analytics_events"].includes(table) && !output.created_at) output.created_at = now;
  if (["projects", "certificates"].includes(table) && !output.updated_at) output.updated_at = now;
  if (table === "analytics_events" && !output.event_date) output.event_date = now.slice(0, 10);
  if (table === "admins" && output.session_version === undefined) output.session_version = 1;
  return output;
}

function applyQuery(collection, parsed) {
  let query = collection;
  for (const filter of parsed.filters) query = query.where(filter.field, filter.operator, filter.value);
  for (const order of parsed.orderBy) query = query.orderBy(order.field, order.direction);
  if (parsed.limit) query = query.limit(parsed.limit);
  return query;
}

async function ping() {
  await getFirestore().collection("_health").limit(1).get();
  return true;
}

async function list(table, query = "") {
  const parsed = parseQuery(table, query);
  const snapshot = await applyQuery(getFirestore().collection(table), parsed).get();
  return snapshot.docs.map(doc => hydrateRow({ ...doc.data(), id: doc.data().id || doc.id }, parsed.columns));
}

async function insert(table, records) {
  const input = Array.isArray(records) ? records : [records];
  if (!input.length) return [];
  const db = getFirestore();
  const prepared = input.map(row => prepareRecord(table, row));
  const batch = db.batch();
  for (const row of prepared) batch.set(db.collection(table).doc(String(row.id)), row);
  await batch.commit();
  if (prepared.length === 1) {
    const saved = await db.collection(table).doc(String(prepared[0].id)).get();
    return [hydrateRow({ ...saved.data(), id: saved.id }, TABLE_COLUMNS[table])];
  }
  return list(table, "?select=*&limit=" + Math.min(prepared.length, 1000));
}

async function update(table, query, patch) {
  const parsed = parseQuery(table, query);
  const prepared = prepareRecord(table, patch);
  delete prepared.id;
  delete prepared.created_at;
  if (!Object.keys(prepared).length) throw new Error("No valid columns to update");
  const db = getFirestore();
  const snapshot = await applyQuery(db.collection(table), { ...parsed, columns: TABLE_COLUMNS[table] }).get();
  if (snapshot.empty) return [];
  const batch = db.batch();
  for (const doc of snapshot.docs) batch.update(doc.ref, { ...prepared, updated_at: new Date().toISOString() });
  await batch.commit();
  const updated = await Promise.all(snapshot.docs.map(doc => doc.ref.get()));
  return updated.map(doc => hydrateRow({ ...doc.data(), id: doc.id }, parsed.columns));
}

async function remove(table, query) {
  const parsed = parseQuery(table, query);
  const db = getFirestore();
  const snapshot = await applyQuery(db.collection(table), { ...parsed, columns: TABLE_COLUMNS[table] }).get();
  if (snapshot.empty) return [{ affectedRows: 0 }];
  const batch = db.batch();
  for (const doc of snapshot.docs) batch.delete(doc.ref);
  await batch.commit();
  return [{ affectedRows: snapshot.size }];
}

module.exports = { config, ping, list, insert, update, remove, parseQuery, prepareRecord };
