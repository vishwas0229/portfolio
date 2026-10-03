const { json, options } = require("./_shared/http");
const { readJsonBody, validateString } = require("./_shared/validation");
const { checkRateLimit, getClientIp, rateLimitHeaders } = require("./_shared/rate-limit");
const { insert } = require("./_shared/db");

const EVENT_NAMES = new Set([
  "visit", "section_view", "project_click", "repo_click", "demo_click",
  "contact_start", "contact_submit", "game_start", "game_complete"
]);
const LIMIT = 30;
const WINDOW_MS = 60_000;

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return options(event);
  if (event.httpMethod !== "POST") return json(405, { ok: false, error: "Method not allowed" }, event, { allow: "POST, OPTIONS" });

  const limited = checkRateLimit("analytics:" + getClientIp(event), LIMIT, WINDOW_MS);
  if (!limited.allowed) {
    return json(429, { ok: false, error: "Too many analytics events. Please retry later." }, event, rateLimitHeaders(limited, LIMIT));
  }

  const contentType = String(event.headers?.["content-type"] || event.headers?.["Content-Type"] || "").toLowerCase();
  if (!contentType.includes("application/json")) {
    return json(415, { ok: false, error: "Content-Type must be application/json." }, event, rateLimitHeaders(limited, LIMIT));
  }

  try {
    const payload = readJsonBody(event, 4096);
    const name = validateString(payload.event, { field: "event", min: 1, max: 40 });
    if (!name.ok || !EVENT_NAMES.has(name.value)) {
      return json(422, { ok: false, error: "Unsupported analytics event." }, event, rateLimitHeaders(limited, LIMIT));
    }

    const section = validateString(payload.section || "", { field: "section", min: 0, max: 80 });
    const project = validateString(payload.projectSlug || "", { field: "projectSlug", min: 0, max: 100 });
    if (!section.ok || !project.ok) {
      return json(422, { ok: false, error: "Invalid analytics dimensions." }, event, rateLimitHeaders(limited, LIMIT));
    }

    const metadata = payload.metadata && typeof payload.metadata === "object" && !Array.isArray(payload.metadata)
      ? payload.metadata
      : {};
    const compactMetadata = Object.fromEntries(Object.entries(metadata).slice(0, 10).map(([k, v]) => [String(k).slice(0, 40), String(v).slice(0, 120)]));

    await insert("analytics_events", {
      event_name: name.value,
      section: section.value || null,
      project_slug: project.value || null,
      metadata: compactMetadata
      // event_date/created_at are assigned by PostgreSQL; client timestamps are ignored.
    });

    return json(202, { ok: true }, event, rateLimitHeaders(limited, LIMIT));
  } catch (_) {
    return json(503, { ok: false, error: "Analytics service is temporarily unavailable." }, event, rateLimitHeaders(limited, LIMIT));
  }
};
