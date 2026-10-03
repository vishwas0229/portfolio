const { json, options } = require("./_shared/http");
const { checkRateLimit, getClientIp, rateLimitHeaders } = require("./_shared/rate-limit");
const { readJsonBody, validateString, validateEmail, isHoneypotFilled } = require("./_shared/validation");
const { insert } = require("./_shared/db");

const LIMIT = 5;
const WINDOW_MS = 60_000;

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return options(event);
  if (event.httpMethod !== "POST") {
    return json(405, { ok: false, error: "Method not allowed" }, event, { allow: "POST, OPTIONS" });
  }

  const limited = checkRateLimit(`contact:${getClientIp(event)}`, LIMIT, WINDOW_MS);
  if (!limited.allowed) {
    return json(429, {
      ok: false,
      error: "Too many contact attempts. Please retry later."
    }, event, rateLimitHeaders(limited, LIMIT));
  }

  const contentType = String(event.headers?.["content-type"] || event.headers?.["Content-Type"] || "").toLowerCase();
  if (!contentType.includes("application/json")) {
    return json(415, { ok: false, error: "Content-Type must be application/json." }, event, rateLimitHeaders(limited, LIMIT));
  }

  try {
    const payload = readJsonBody(event, 12 * 1024);
    if (isHoneypotFilled(payload.website || payload.botField || payload["bot-field"])) {
      return json(204, null, event, rateLimitHeaders(limited, LIMIT));
    }

    const name = validateString(payload.name, { field: "name", min: 2, max: 70 });
    const email = validateEmail(payload.email, 160);
    const subject = validateString(payload.subject || "", { field: "subject", min: 0, max: 160 });
    const message = validateString(payload.message, { field: "message", min: 8, max: 1400 });
    const pageUrl = validateString(payload.pageUrl || "", { field: "pageUrl", min: 0, max: 500 });

    const errors = {};
    if (!name.ok) errors.name = name.error;
    if (!email.ok) errors.email = email.error;
    if (!subject.ok) errors.subject = subject.error;
    if (!message.ok) errors.message = message.error;
    if (!pageUrl.ok) errors.pageUrl = pageUrl.error;
    if (Object.keys(errors).length) {
      return json(422, { ok: false, error: "Please correct the highlighted fields.", fields: errors }, event, rateLimitHeaders(limited, LIMIT));
    }

    const saved = await insert("contact_messages", {
      name: name.value,
      email: email.value,
      subject: subject.value,
      message: message.value,
      page_url: pageUrl.value || null,
      status: "new"
    });

    const row = Array.isArray(saved) ? saved[0] : saved;
    if (!row?.id) throw new Error("Message was not saved");

    return json(201, {
      ok: true,
      message: "Your message was received.",
      data: { id: row.id }
    }, event, rateLimitHeaders(limited, LIMIT));
  } catch (error) {
    const status = error?.statusCode === 413 ? 413 : error?.code === "DB_NOT_CONFIGURED" ? 503 : 500;
    return json(status, {
      ok: false,
      error: status === 413
        ? "Message payload is too large."
        : status === 503
          ? "Contact service is temporarily unavailable."
          : "Your message could not be submitted right now."
    }, event, rateLimitHeaders(limited, LIMIT));
  }
};
