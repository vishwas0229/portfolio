const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

function trimString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function validateString(value, { field, min = 1, max = 255 }) {
  const normalized = trimString(value);
  if (normalized.length < min) return { ok: false, field, error: `${field} is required.` };
  if (normalized.length > max) return { ok: false, field, error: `${field} is too long.` };
  return { ok: true, value: normalized };
}

function validateEmail(value, max = 160) {
  const normalized = trimString(value).toLowerCase();
  if (!normalized || normalized.length > max || !EMAIL_RE.test(normalized)) {
    return { ok: false, error: "Please provide a valid email address." };
  }
  return { ok: true, value: normalized };
}

function validateAdminEmail(value, max = 160) {
  const normalized = trimString(value).toLowerCase();
  const at = normalized.lastIndexOf("@");
  const localPart = at > 0 ? normalized.slice(0, at) : "";
  const domain = at > 0 ? normalized.slice(at + 1) : "";

  const validPublic = EMAIL_RE.test(normalized);
  const validLocal = Boolean(localPart) && /^[a-z0-9](?:[a-z0-9._+-]*[a-z0-9])?$/i.test(localPart)
    && /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)$/i.test(domain);

  if (!normalized || normalized.length > max || (!validPublic && !validLocal)) {
    return { ok: false, error: "Please provide a valid admin email address." };
  }
  return { ok: true, value: normalized };
}

function isHoneypotFilled(value) {
  return trimString(value).length > 0;
}

function validateUrl(value, { field, required = false, max = 500 } = {}) {
  const normalized = trimString(value);
  if (!normalized && !required) return { ok: true, value: null };
  if (!normalized || normalized.length > max) return { ok: false, error: required ? `${field} is required.` : `${field} is too long.` };
  try {
    const url = new URL(normalized);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error();
    return { ok: true, value: url.toString() };
  } catch (_) {
    return { ok: false, error: `${field} must be a valid HTTP(S) URL.` };
  }
}

function validateStringArray(value, { field, maxItems = 20, itemMax = 60 } = {}) {
  if (value == null) return { ok: true, value: [] };
  if (!Array.isArray(value) || value.length > maxItems) return { ok: false, error: `${field} must be a short list.` };
  const out = [];
  for (const item of value) {
    const normalized = trimString(item);
    if (!normalized || normalized.length > itemMax) return { ok: false, error: `${field} contains an invalid item.` };
    out.push(normalized);
  }
  return { ok: true, value: [...new Set(out)] };
}

function readJsonBody(event, maxBytes = 16384) {
  const body = event?.body || "";
  const raw = event?.isBase64Encoded ? Buffer.from(body, "base64").toString("utf8") : String(body);
  if (Buffer.byteLength(raw, "utf8") > maxBytes) {
    const error = new Error("Payload too large");
    error.statusCode = 413;
    throw error;
  }
  if (!raw) return {};

  const headers = event?.headers || {};
  const contentType = String(headers["content-type"] || headers["Content-Type"] || "").toLowerCase().split(";")[0].trim();

  try {
    if (contentType === "application/x-www-form-urlencoded") {
      const parsed = Object.fromEntries(new URLSearchParams(raw).entries());
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
      return parsed;
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    return parsed;
  } catch (_) {
    const error = new Error("Invalid request payload");
    error.statusCode = 400;
    throw error;
  }
}

module.exports = { trimString, validateString, validateEmail, validateAdminEmail, validateUrl, validateStringArray, isHoneypotFilled, readJsonBody };
