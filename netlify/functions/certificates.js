const { json, options } = require("./_shared/http");
const { readJsonBody, validateString, validateUrl } = require("./_shared/validation");
const { list, insert, update, remove } = require("./_shared/db");
const { requireAdmin, requireSameOrigin, requireCsrf } = require("./_shared/auth");

function pathId(event) {
  const raw = String(event.path || "").split("/").filter(Boolean);
  const marker = raw.indexOf("certificates");
  return marker >= 0 ? raw[marker + 1] || null : null;
}

function validateCertificate(payload, partial = false) {
  const errors = {};
  const out = {};

  if (!partial || payload.title !== undefined) {
    const v = validateString(payload.title, { field: "title", min: 2, max: 160 });
    if (!v.ok) errors.title = v.error; else out.title = v.value;
  }
  if (payload.issuer !== undefined || !partial) {
    const v = validateString(payload.issuer || "", { field: "issuer", min: 0, max: 160 });
    if (!v.ok) errors.issuer = v.error; else out.issuer = v.value;
  }
  if (payload.issuedOn !== undefined && payload.issuedOn !== null && payload.issuedOn !== "") {
    const value = String(payload.issuedOn).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) errors.issuedOn = "issuedOn must use YYYY-MM-DD.";
    else out.issued_on = value;
  } else if (!partial && payload.issuedOn === null) {
    out.issued_on = null;
  }
  for (const [input, column] of [["credentialUrl","credential_url"],["imageUrl","image_url"]]) {
    if (payload[input] !== undefined) {
      const v = validateUrl(payload[input], { field: input, max: 500 });
      if (!v.ok) errors[input] = v.error; else out[column] = v.value;
    }
  }
  if (payload.description !== undefined) {
    const v = validateString(payload.description || "", { field: "description", min: 0, max: 2000 });
    if (!v.ok) errors.description = v.error; else out.description = v.value;
  }
  if (payload.displayOrder !== undefined) {
    const n = Number(payload.displayOrder);
    if (!Number.isInteger(n) || n < 0 || n > 10000) errors.displayOrder = "displayOrder must be an integer between 0 and 10000.";
    else out.display_order = n;
  }
  if (payload.published !== undefined) {
    if (typeof payload.published !== "boolean") errors.published = "published must be boolean.";
    else out.published = payload.published;
  }

  return { ok: Object.keys(errors).length === 0, errors, out };
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return options(event);

  try {
    const id = pathId(event);
    if (event.httpMethod === "GET") {
      const query = id
        ? `?select=*&id=eq.${encodeURIComponent(id)}&published=eq.true&limit=1`
        : "?select=*&published=eq.true&order=display_order.asc,created_at.desc";
      const rows = await list("certificates", query);
      if (id) {
        if (!rows?.[0]) return json(404, { ok: false, error: "Certificate not found." }, event);
        return json(200, { ok: true, data: rows[0] }, event);
      }
      return json(200, { ok: true, data: Array.isArray(rows) ? rows : [] }, event);
    }

    const session = requireAdmin(event);
    requireSameOrigin(event);
    requireCsrf(event, session);

    if (event.httpMethod === "POST") {
      const payload = readJsonBody(event, 12 * 1024);
      const validation = validateCertificate(payload);
      if (!validation.ok) return json(422, { ok: false, error: "Invalid certificate data.", fields: validation.errors }, event);
      const created = await insert("certificates", validation.out);
      return json(201, { ok: true, data: Array.isArray(created) ? created[0] : created }, event);
    }

    if (event.httpMethod === "PATCH") {
      if (!id) return json(400, { ok: false, error: "Certificate id is required." }, event);
      const payload = readJsonBody(event, 12 * 1024);
      const validation = validateCertificate(payload, true);
      if (!validation.ok) return json(422, { ok: false, error: "Invalid certificate data.", fields: validation.errors }, event);
      const changed = await update("certificates", `?id=eq.${encodeURIComponent(id)}&select=*`, {
        ...validation.out,
        updated_at: new Date().toISOString()
      });
      return json(200, { ok: true, data: Array.isArray(changed) ? changed[0] : changed }, event);
    }

    if (event.httpMethod === "DELETE") {
      if (!id) return json(400, { ok: false, error: "Certificate id is required." }, event);
      await remove("certificates", `?id=eq.${encodeURIComponent(id)}`);
      return json(200, { ok: true }, event);
    }

    return json(405, { ok: false, error: "Method not allowed" }, event, { allow: "GET,POST,PATCH,DELETE,OPTIONS" });
  } catch (error) {
    const status = error?.statusCode || (error?.code === "DB_NOT_CONFIGURED" ? 503 : 500);
    return json(status, {
      ok: false,
      error: status === 401 ? "Authentication required." : status === 403 ? "Request is not authorized." : "Certificate request could not be completed."
    }, event);
  }
};
