const { Pool } = require("pg");
const { config } = require("./config");

const TABLE_COLUMNS = Object.freeze({
  projects: ["id","title","slug","summary","description","tech_stack","repository_url","demo_url","image_url","featured","display_order","published","created_at","updated_at"],
  certificates: ["id","title","issuer","issued_on","credential_url","image_url","description","display_order","published","created_at","updated_at"],
  contact_messages: ["id","name","email","subject","message","page_url","status","email_status","email_error","created_at","read_at","archived_at"],
  analytics_events: ["id","event_name","event_date","section","project_slug","metadata","created_at"]
});

let pool;

const assertTable = (table) => {
  if (!Object.hasOwn(TABLE_COLUMNS, table)) throw new Error("Unsupported database table");
};

const hasLocalDatabase = () => Boolean(String(process.env.DATABASE_URL || "").trim());

function getDbConfig() {
  if (hasLocalDatabase()) return { driver: "postgres", url: String(process.env.DATABASE_URL).trim() };

  const url = String(process.env.SUPABASE_URL || "").trim().replace(/\/$/, "");
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !key) {
    const error = new Error("Database is not configured");
    error.code = "DB_NOT_CONFIGURED";
    throw error;
  }
  return { driver: "supabase-rest", url, key };
}

function getPool() {
  if (pool) return pool;
  pool = new Pool({
    connectionString: String(process.env.DATABASE_URL || "").trim(),
    max: Number(process.env.DB_POOL_MAX || 10),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    ssl: String(process.env.DATABASE_SSL || "").toLowerCase() === "true"
      ? { rejectUnauthorized: false }
      : undefined
  });
  return pool;
}

function parsePostgrestQuery(table, query = "") {
  assertTable(table);
  const allowed = new Set(TABLE_COLUMNS[table]);
  const params = new URLSearchParams(String(query || "").replace(/^\?/, ""));
  const selectParam = params.get("select") || "*";
  const columns = (selectParam === "*" ? TABLE_COLUMNS[table] : selectParam.split(","))
    .map(x => x.trim())
    .filter(x => /^[A-Za-z_][A-Za-z0-9_]*$/.test(x) && allowed.has(x));
  if (!columns.length) throw new Error("Invalid select list");

  const clauses = [];
  const values = [];

  for (const [column, raw] of params.entries()) {
    if (["select","order","limit"].includes(column)) continue;
    if (!allowed.has(column)) throw new Error("Unsupported query filter");

    const dot = raw.indexOf(".");
    if (dot < 1) throw new Error("Invalid query filter");
    const op = raw.slice(0, dot);
    const operand = raw.slice(dot + 1);

    if (op === "is" && operand === "null") {
      clauses.push(`"${column}" IS NULL`);
      continue;
    }

    const sqlOp = ({eq:"=",neq:"<>",gt:">",gte:">=",lt:"<",lte:"<="})[op];
    if (!sqlOp) throw new Error("Unsupported query operator");

    let value = operand;
    if (value === "true") value = true;
    else if (value === "false") value = false;
    else if (value === "null") value = null;

    if (value === null) {
      clauses.push(`"${column}" ${op === "eq" ? "IS" : "IS NOT"} NULL`);
    } else {
      values.push(value);
      clauses.push(`"${column}" ${sqlOp} $${values.length}`);
    }
  }

  let orderSql = "";
  const orderParam = params.get("order");
  if (orderParam) {
    orderSql = " ORDER BY " + orderParam.split(",").map(item => {
      const [column, direction = "asc"] = item.trim().split(".");
      if (!allowed.has(column) || !["asc","desc"].includes(direction)) throw new Error("Unsupported order");
      return `"${column}" ${direction.toUpperCase()}`;
    }).join(", ");
  }

  let limitSql = "";
  if (params.has("limit")) {
    const limit = Number(params.get("limit"));
    if (!Number.isInteger(limit) || limit < 1 || limit > 1000) throw new Error("Invalid limit");
    limitSql = " LIMIT " + limit;
  }

  return {
    selectSql: columns.map(column => `"${column}"`).join(", "),
    whereSql: clauses.length ? " WHERE " + clauses.join(" AND ") : "",
    orderSql,
    limitSql,
    values
  };
}

async function request(path, { method = "GET", body, query = "" } = {}) {
  const { url, key } = getDbConfig();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(`${url}/rest/v1/${path}${query}`, {
      method,
      signal: controller.signal,
      headers: {
        apikey: key,
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
        accept: "application/json",
        prefer: "return=representation",
        "user-agent": "Rahul-Portfolio/1.0"
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    });

    if (!response.ok) {
      const error = new Error(`Database request failed with HTTP ${response.status}`);
      error.statusCode = response.status;
      throw error;
    }

    return response.status === 204 ? null : response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function listPostgres(table, query = "") {
  const parsed = parsePostgrestQuery(table, query);
  const sql = `SELECT ${parsed.selectSql} FROM "${table}"${parsed.whereSql}${parsed.orderSql}${parsed.limitSql}`;
  return (await getPool().query(sql, parsed.values)).rows;
}

async function insertPostgres(table, records) {
  assertTable(table);
  const rows = Array.isArray(records) ? records : [records];
  const allowed = new Set(TABLE_COLUMNS[table]);
  const columns = [...new Set(rows.flatMap(row => Object.keys(row || {})).filter(column => allowed.has(column)))];
  if (!columns.length) throw new Error("No valid columns to insert");

  const values = [];
  const tuples = rows.map(row => "(" + columns.map(column => {
    values.push(row[column] === undefined ? null : row[column]);
    return "$" + values.length;
  }).join(", ") + ")");

  return (await getPool().query(
    `INSERT INTO "${table}" (${columns.map(c => `"${c}"`).join(", ")}) VALUES ${tuples.join(", ")} RETURNING *`,
    values
  )).rows;
}

async function updatePostgres(table, query, patch) {
  const parsed = parsePostgrestQuery(table, query);
  const allowed = new Set(TABLE_COLUMNS[table]);
  const columns = Object.keys(patch || {}).filter(column => allowed.has(column));
  if (!columns.length) throw new Error("No valid columns to update");

  const values = [];
  const setSql = columns.map(column => {
    values.push(patch[column] === undefined ? null : patch[column]);
    return `"${column}" = $${values.length}`;
  }).join(", ");

  const offset = values.length;
  const whereSql = parsed.whereSql.replace(/\$(\d+)/g, (_, n) => "$" + (Number(n) + offset));
  return (await getPool().query(
    `UPDATE "${table}" SET ${setSql}${whereSql}${parsed.limitSql} RETURNING *`,
    values.concat(parsed.values)
  )).rows;
}

async function removePostgres(table, query) {
  const parsed = parsePostgrestQuery(table, query);
  return (await getPool().query(
    `DELETE FROM "${table}"${parsed.whereSql} RETURNING *`,
    parsed.values
  )).rows;
}

async function list(table, query) {
  return hasLocalDatabase() ? listPostgres(table, query) : request(table, { query });
}

async function insert(table, records) {
  return hasLocalDatabase()
    ? insertPostgres(table, records)
    : request(table, { method: "POST", query: "?select=*", body: Array.isArray(records) ? records : [records] });
}

async function update(table, query, values) {
  return hasLocalDatabase() ? updatePostgres(table, query, values) : request(table, { method: "PATCH", query, body: values });
}

async function remove(table, query) {
  return hasLocalDatabase() ? removePostgres(table, query) : request(table, { method: "DELETE", query });
}

module.exports = { config, request, list, insert, update, remove, getDbConfig, parsePostgrestQuery };
