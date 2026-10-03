const crypto = require("node:crypto");
const mysql = require("mysql2/promise");
const { config } = require("./config");

const TABLE_COLUMNS = Object.freeze({
  projects: ["id","title","slug","summary","description","tech_stack","repository_url","demo_url","image_url","featured","display_order","published","created_at","updated_at"],
  certificates: ["id","title","issuer","issued_on","credential_url","image_url","description","display_order","published","created_at","updated_at"],
  contact_messages: ["id","name","email","subject","message","page_url","status","email_status","email_error","created_at","read_at","archived_at"],
  analytics_events: ["id","event_name","event_date","section","project_slug","metadata","created_at"],
  admins: ["id","email","password_hash","role","active","created_at","updated_at"]
});

const JSON_COLUMNS = new Set(["tech_stack","metadata"]);
let pool;

function getDatabaseUrl() {
  const raw = String(process.env.DATABASE_URL || "").trim();
  if (!raw) {
    const error = new Error("DATABASE_URL is not configured");
    error.code = "DB_NOT_CONFIGURED";
    throw error;
  }
  const url = new URL(raw);
  if (url.protocol !== "mysql:") {
    const error = new Error("DATABASE_URL must use mysql://");
    error.code = "DB_CONFIG_INVALID";
    throw error;
  }
  return url;
}

function getPool() {
  if (pool) return pool;
  const url = getDatabaseUrl();
  pool = mysql.createPool({
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.replace(/^\//, "")),
    waitForConnections: true,
    connectionLimit: Math.min(Math.max(Number(process.env.DB_POOL_MAX || 10), 1), 20),
    queueLimit: 0,
    connectTimeout: 10000,
    enableKeepAlive: true
  });
  return pool;
}

function assertTable(table) {
  if (!Object.hasOwn(TABLE_COLUMNS, table)) throw new Error("Unsupported database table");
}

function parseQuery(table, query = "") {
  assertTable(table);
  const allowed = new Set(TABLE_COLUMNS[table]);
  const params = new URLSearchParams(String(query || "").replace(/^\?/, ""));

  const requested = params.get("select") || "*";
  const columns = (requested === "*" ? TABLE_COLUMNS[table] : requested.split(","))
    .map(v => v.trim())
    .filter(v => /^[A-Za-z_][A-Za-z0-9_]*$/.test(v) && allowed.has(v));

  if (!columns.length) throw new Error("Invalid select list");

  const clauses = [];
  const values = [];

  for (const [column, raw] of params.entries()) {
    if (column === "select" || column === "order" || column === "limit") continue;
    if (!allowed.has(column)) throw new Error("Unsupported query filter");

    const separator = raw.indexOf(".");
    if (separator < 1) throw new Error("Invalid query filter");

    const operator = raw.slice(0, separator);
    const operand = raw.slice(separator + 1);

    if (operator === "is" && operand === "null") {
      clauses.push(column + " IS NULL");
      continue;
    }

    const sqlOperator = ({eq:"=",neq:"<>",gt:">",gte:">=",lt:"<",lte:"<="})[operator];
    if (!sqlOperator) throw new Error("Unsupported query operator");

    let value = operand;
    if (value === "true") value = 1;
    else if (value === "false") value = 0;
    else if (value === "null") value = null;

    if (value === null) {
      clauses.push(column + (operator === "eq" ? " IS NULL" : " IS NOT NULL"));
    } else {
      values.push(value);
      clauses.push(column + " " + sqlOperator + " ?");
    }
  }

  let orderSql = "";
  const orderParam = params.get("order");
  if (orderParam) {
    const pieces = orderParam.split(",").filter(Boolean).map(item => {
      const [column, direction = "asc"] = item.trim().split(".");
      if (!allowed.has(column) || !["asc","desc"].includes(direction)) throw new Error("Unsupported order");
      return column + " " + direction.toUpperCase();
    });
    orderSql = pieces.length ? " ORDER BY " + pieces.join(", ") : "";
  }

  let limitSql = "";
  if (params.has("limit")) {
    const n = Number(params.get("limit"));
    if (!Number.isInteger(n) || n < 1 || n > 1000) throw new Error("Invalid limit");
    limitSql = " LIMIT " + n;
  }

  return {
    selectSql: columns.join(", "),
    whereSql: clauses.length ? " WHERE " + clauses.join(" AND ") : "",
    orderSql,
    limitSql,
    values
  };
}

function hydrateRows(rows) {
  return rows.map(row => {
    const out = { ...row };
    for (const column of JSON_COLUMNS) {
      if (typeof out[column] === "string") {
        try { out[column] = JSON.parse(out[column]); } catch (_) {}
      }
    }
    return out;
  });
}

function prepareRecord(table, row) {
  assertTable(table);
  const allowed = new Set(TABLE_COLUMNS[table]);
  const out = {};
  if (["projects","certificates","contact_messages"].includes(table) && !row.id) {
    out.id = crypto.randomUUID();
  }
  for (const [key, value] of Object.entries(row || {})) {
    if (!allowed.has(key)) continue;
    out[key] = JSON_COLUMNS.has(key)
      ? JSON.stringify(value == null ? (key === "metadata" ? {} : []) : value)
      : value;
  }
  return out;
}

async function list(table, query = "") {
  const parsed = parseQuery(table, query);
  const sql = "SELECT " + parsed.selectSql + " FROM " + table + parsed.whereSql + parsed.orderSql + parsed.limitSql;
  const [rows] = await getPool().query(sql, parsed.values);
  return hydrateRows(rows);
}

async function insert(table, records) {
  const rows = (Array.isArray(records) ? records : [records]).map(row => prepareRecord(table, row));
  if (!rows.length) return [];

  const columns = [...new Set(rows.flatMap(row => Object.keys(row)))];
  const values = [];
  const tuples = rows.map(row => "(" + columns.map(column => {
    values.push(row[column] === undefined ? null : row[column]);
    return "?";
  }).join(", ") + ")");

  const sql = "INSERT INTO " + table + " (" + columns.join(", ") + ") VALUES " + tuples.join(", ");
  const [result] = await getPool().query(sql, values);

  if (!result.affectedRows) return [];
  if (rows.length === 1 && rows[0].id) {
    return list(table, "?select=*&id=eq." + encodeURIComponent(rows[0].id) + "&limit=1");
  }
  return list(table, "?select=*&limit=" + Math.min(rows.length, 1000) + "&order=created_at.desc");
}

async function update(table, query, patch) {
  const parsed = parseQuery(table, query);
  const prepared = prepareRecord(table, patch);
  const columns = Object.keys(prepared);
  if (!columns.length) throw new Error("No valid columns to update");

  const setSql = columns.map(column => column + " = ?").join(", ");
  const values = columns.map(column => prepared[column]);
  const [result] = await getPool().query(
    "UPDATE " + table + " SET " + setSql + parsed.whereSql + parsed.limitSql,
    values.concat(parsed.values)
  );

  if (!result.affectedRows) return [];
  const selectQuery = query.replace(/(^\?|&)select=[^&]*/g, "").replace(/^&/, "?select=*");
  return list(table, selectQuery.startsWith("?") ? selectQuery : "?" + selectQuery);
}

async function remove(table, query) {
  const parsed = parseQuery(table, query);
  const [result] = await getPool().query(
    "DELETE FROM " + table + parsed.whereSql,
    parsed.values
  );
  return [{ affectedRows: result.affectedRows }];
}

module.exports = { config, list, insert, update, remove, getDatabaseUrl, parseQuery };
