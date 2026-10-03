const { config } = require("./config");

function getDbConfig() {
  const url = String(process.env.SUPABASE_URL || "").trim().replace(/\/$/, "");
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !key) {
    const error = new Error("Database is not configured");
    error.code = "DB_NOT_CONFIGURED";
    throw error;
  }
  return { url, key };
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
        "user-agent": "Rahul-Portfolio/1.0"
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    });

    if (!response.ok) {
      const error = new Error(`Database request failed with HTTP ${response.status}`);
      error.statusCode = response.status;
      throw error;
    }

    if (response.status === 204) return null;
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function list(table, query) {
  return request(table, { query });
}

async function insert(table, records) {
  return request(table, { method: "POST", query: "?select=*", body: Array.isArray(records) ? records : [records] });
}

async function update(table, query, values) {
  return request(table, { method: "PATCH", query, body: values });
}

async function remove(table, query) {
  return request(table, { method: "DELETE", query });
}

module.exports = { config, request, list, insert, update, remove, getDbConfig };
