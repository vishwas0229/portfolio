const { json, options } = require("./_shared/http");
const { requireAdmin, requireSameOrigin, requireCsrf } = require("./_shared/auth");
const { list, update } = require("./_shared/db");
const { validateString } = require("./_shared/validation");

function messageId(event) {
  const parts = String(event.path || "").split("/").filter(Boolean);
  const marker = parts.indexOf("messages");
  return marker >= 0 ? parts[marker + 1] || null : null;
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return options(event);

  try {
    const session = await requireAdmin(event);
    const id = messageId(event);

    if (event.httpMethod === "GET") {
      const params = new URLSearchParams();
      params.set("select", "*");
      params.set("order", "created_at.desc");
      params.set("limit", String(Math.min(Math.max(Number(event.queryStringParameters?.limit || 100), 1), 100)));

      const status = String(event.queryStringParameters?.status || "").trim();
      if (["new", "read", "archived"].includes(status)) params.set("status", `eq.${status}`);

      const rows = await list("contact_messages", "?" + params.toString());
      return json(200, { ok: true, data: Array.isArray(rows) ? rows : [] }, event, { "cache-control": "no-store" });
    }

    requireSameOrigin(event);
    requireCsrf(event, session);

    if (event.httpMethod === "PATCH") {
      if (!id) return json(400, { ok: false, error: "Message id is required." }, event);
      const raw = event.body || "{}";
      let payload;
      try { payload = JSON.parse(raw); } catch (_) { return json(400, { ok: false, error: "Invalid JSON payload." }, event); }

      const status = validateString(payload.status, { field: "status", min: 1, max: 12 });
      if (!status.ok || !["new", "read", "archived"].includes(status.value)) {
        return json(422, { ok: false, error: "status must be new, read, or archived." }, event);
      }

      const now = new Date().toISOString().slice(0, 19).replace("T", " ");
      const changed = await update("contact_messages", `?id=eq.${encodeURIComponent(id)}&select=*`, {
        status: status.value,
        read_at: status.value === "new" ? null : now,
        archived_at: status.value === "archived" ? now : null
      });

      return json(200, { ok: true, data: Array.isArray(changed) ? changed[0] : changed }, event);
    }

    return json(405, { ok: false, error: "Method not allowed" }, event, { allow: "GET,PATCH,OPTIONS" });
  } catch (error) {
    const status = error?.statusCode || (error?.code === "DB_NOT_CONFIGURED" ? 503 : 500);
    return json(status, {
      ok: false,
      error: status === 401 ? "Authentication required." : status === 403 ? "Request is not authorized." : "Message request failed."
    }, event);
  }
};
