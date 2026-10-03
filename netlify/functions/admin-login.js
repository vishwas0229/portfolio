const { json, options } = require("./_shared/http");
const { readJsonBody, validateEmail } = require("./_shared/validation");
const { checkRateLimit, getClientIp, rateLimitHeaders } = require("./_shared/rate-limit");
const { verifyPassword, createLoginCookies, requireSameOrigin, SESSION_TTL_SECONDS } = require("./_shared/auth");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return options(event);
  if (event.httpMethod !== "POST") return json(405, { ok: false, error: "Method not allowed" }, event, { allow: "POST, OPTIONS" });

  const limited = checkRateLimit("admin-login:" + getClientIp(event), 5, 15 * 60 * 1000);
  if (!limited.allowed) return json(429, { ok: false, error: "Too many login attempts. Try again later." }, event, rateLimitHeaders(limited, 5));

  try {
    requireSameOrigin(event);
    const payload = readJsonBody(event, 4096);
    const email = validateEmail(payload.email, 160);
    const password = typeof payload.password === "string" ? payload.password : "";
    const configuredEmail = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
    const configuredHash = String(process.env.ADMIN_PASSWORD_HASH || "").trim();
    const valid = email.ok && password.length >= 1 && configuredEmail && configuredHash &&
      email.value === configuredEmail && verifyPassword(password, configuredHash);

    if (!valid) return json(401, { ok: false, error: "Invalid email or password." }, event, rateLimitHeaders(limited, 5));

    return json(200, {
      ok: true,
      user: { email: email.value, role: "admin" },
      expiresIn: SESSION_TTL_SECONDS
    }, event, {
      "set-cookie": createLoginCookies(email.value),
      "cache-control": "no-store"
    });
  } catch (_) {
    return json(400, { ok: false, error: "Login request could not be processed." }, event);
  }
};
