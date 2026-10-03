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

function isHoneypotFilled(value) {
  return trimString(value).length > 0;
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
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    return parsed;
  } catch (_) {
    const error = new Error("Invalid JSON payload");
    error.statusCode = 400;
    throw error;
  }
}

module.exports = { trimString, validateString, validateEmail, isHoneypotFilled, readJsonBody };
