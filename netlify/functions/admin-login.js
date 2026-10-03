const { json, options } = require("./_shared/http");
const { readJsonBody, validateEmail } = require("./_shared/validation");
const { checkRateLimit, getClientIp, rateLimitHeaders } = require("./_shared/rate-limit");
const { verifyPassword, createLoginCookies, requireSameOrigin, SESSION_TTL_SECONDS } = require("./_shared/auth");
const { list } = require("./_shared/db");

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

    if (!email.ok || password.length < 1) {
      return json(401, { ok: false, error: "Invalid email or password." }, event, rateLimitHeaders(limited, 5));
    }

    const rows = await list(
      "admins",
      `?select=email,role,password_hash,active,session_version&email=eq.${encodeURIComponent(email.value)}&limit=1`
    );
    const admin = Array.isArray(rows) ? rows[0] : null;
    const valid = Boolean(admin) &&
      Boolean(admin.active) &&
      admin.role === "admin" &&
      verifyPassword(password, admin.password_hash);

    if (!valid) {
      return json(401, { ok: false, error: "Invalid email or password." }, event, rateLimitHeaders(limited, 5));
    }

    return json(200, {
      ok: true,
      user: { email: admin.email, role: admin.role },
      expiresIn: SESSION_TTL_SECONDS
    }, event, {
      "set-cookie": createLoginCookies(admin.email, admin.session_version),
      "cache-control": "no-store"
    });
  } catch (error) {
    const status = error?.statusCode || (error?.code === "DB_NOT_CONFIGURED" ? 503 : 500);
    return json(status, {
      ok: false,
      error: status === 403
        ? "Request is not authorized."
        : status === 503
          ? "Database is not configured."
          : "Login request could not be processed."
    }, event);
  }
};
