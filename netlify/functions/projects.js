const { json, options } = require("./_shared/http");
const { readJsonBody, validateString, validateUrl, validateStringArray } = require("./_shared/validation");
const { list, insert, update, remove } = require("./_shared/db");
const { requireAdmin, requireSameOrigin, requireCsrf } = require("./_shared/auth");

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function pathId(event) {
  const queryId = event.queryStringParameters?.slug;
  if (queryId) return String(queryId).trim();
  const raw = String(event.path || "").split("/").filter(Boolean);
  const marker = raw.indexOf("projects");
  return marker >= 0 ? raw[marker + 1] || null : null;
}

function validateProject(payload, partial = false) {
  const errors = {};
  const out = {};

  if (!partial || payload.title !== undefined) {
    const v = validateString(payload.title, { field: "title", min: 2, max: 120 });
    if (!v.ok) errors.title = v.error; else out.title = v.value;
  }

  if (!partial || payload.slug !== undefined) {
    const v = validateString(payload.slug, { field: "slug", min: 2, max: 100 });
    if (!v.ok) errors.slug = v.error;
    else if (!SLUG_RE.test(v.value)) errors.slug = "slug must use lowercase letters, numbers and hyphens.";
    else out.slug = v.value;
  }

  if (!partial || payload.summary !== undefined) {
    const v = validateString(payload.summary, { field: "summary", min: 5, max: 280 });
    if (!v.ok) errors.summary = v.error; else out.summary = v.value;
  }

  if (payload.description !== undefined) {
    const v = validateString(payload.description || "", { field: "description", min: 0, max: 5000 });
    if (!v.ok) errors.description = v.error; else out.description = v.value;
  }

  if (payload.techStack !== undefined) {
    const v = validateStringArray(payload.techStack, { field: "techStack", maxItems: 20, itemMax: 60 });
    if (!v.ok) errors.techStack = v.error; else out.tech_stack = v.value;
  }

  for (const [input, column] of [
    ["repositoryUrl", "repository_url"],
    ["demoUrl", "demo_url"],
    ["imageUrl", "image_url"]
  ]) {
    if (payload[input] !== undefined) {
      const v = validateUrl(payload[input], { field: input, max: 500 });
      if (!v.ok) errors[input] = v.error; else out[column] = v.value;
    }
  }

  if (payload.featured !== undefined) {
    if (typeof payload.featured !== "boolean") errors.featured = "featured must be boolean.";
    else out.featured = payload.featured;
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
      const adminList = event.queryStringParameters?.admin === "1";
      if (adminList) requireAdmin(event);
      const query = id
        ? `?select=*&slug=eq.${encodeURIComponent(id)}${adminList ? "" : "&published=eq.true"}&limit=1`
        : (adminList
          ? "?select=*&order=display_order.asc,created_at.desc"
          : "?select=*&published=eq.true&order=display_order.asc,created_at.desc");
      const rows = await list("projects", query);
      if (id) {
        if (!rows?.[0]) return json(404, { ok: false, error: "Project not found." }, event);
        return json(200, { ok: true, data: rows[0] }, event);
      }
      return json(200, { ok: true, data: Array.isArray(rows) ? rows : [] }, event);
    }

    const session = requireAdmin(event);
    requireSameOrigin(event);
    requireCsrf(event, session);

    if (event.httpMethod === "POST") {
      const payload = readJsonBody(event, 16 * 1024);
      const validation = validateProject(payload);
      if (!validation.ok) return json(422, { ok: false, error: "Invalid project data.", fields: validation.errors }, event);

      const created = await insert("projects", validation.out);
      return json(201, { ok: true, data: Array.isArray(created) ? created[0] : created }, event);
    }

    if (event.httpMethod === "PATCH") {
      if (!id) return json(400, { ok: false, error: "Project slug is required." }, event);
      const payload = readJsonBody(event, 16 * 1024);
      const validation = validateProject(payload, true);
      if (!validation.ok) return json(422, { ok: false, error: "Invalid project data.", fields: validation.errors }, event);

      const current = await list("projects", `?select=id,slug&slug=eq.${encodeURIComponent(id)}&limit=1`);
      if (!current?.[0]) return json(404, { ok: false, error: "Project not found." }, event);
      const changed = await update("projects", `?id=eq.${encodeURIComponent(current[0].id)}&select=*`, {
        ...validation.out,
        updated_at: new Date().toISOString()
      });
      return json(200, { ok: true, data: Array.isArray(changed) ? changed[0] : changed }, event);
    }

    if (event.httpMethod === "DELETE") {
      if (!id) return json(400, { ok: false, error: "Project slug is required." }, event);
      await remove("projects", `?slug=eq.${encodeURIComponent(id)}`);
      return json(200, { ok: true }, event);
    }

    return json(405, { ok: false, error: "Method not allowed" }, event, { allow: "GET,POST,PATCH,DELETE,OPTIONS" });
  } catch (error) {
    const status = error?.statusCode || (error?.code === "DB_NOT_CONFIGURED" ? 503 : 500);
    const conflict = status === 409;
    return json(status, {
      ok: false,
      error: conflict ? "A project with that slug already exists." : status === 401 ? "Authentication required." : status === 403 ? "Request is not authorized." : "Project request could not be completed."
    }, event);
  }
};
