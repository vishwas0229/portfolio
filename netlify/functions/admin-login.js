const { json, options } = require("./_shared/http");
const { readJsonBody, validateAdminEmail } = require("./_shared/validation");
const { checkRateLimit, getClientIp, rateLimitHeaders, resetRateLimit } = require("./_shared/rate-limit");
const { verifyPassword, createLoginSession, requireSameOrigin, SESSION_TTL_SECONDS } = require("./_shared/auth");
const { list } = require("./_shared/db");
const { verifyFirebaseIdToken } = require("./_shared/firebase-auth");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return options(event);
  if (event.httpMethod !== "POST") return json(405, { ok: false, error: "Method not allowed" }, event, { allow: "POST, OPTIONS" });

  const rateKey = "admin-login:" + getClientIp(event);
  const limited = checkRateLimit(rateKey, 5, 15 * 60 * 1000);
  if (!limited.allowed) {
    return json(429, {
      ok: false,
      error: "Too many login attempts. Try again later.",
      retryAfter: limited.retryAfter
    }, event, rateLimitHeaders(limited, 5));
  }

  try {
    requireSameOrigin(event);
    const payload = readJsonBody(event, 8192);
    let email;
    let admin;
    const firebaseIdToken = typeof payload.firebaseIdToken === "string" ? payload.firebaseIdToken.trim() : "";

    if (firebaseIdToken) {
      let decoded;
      try {
        decoded = await verifyFirebaseIdToken(firebaseIdToken);
      } catch (error) {
        const status = error?.code === "FIREBASE_NOT_CONFIGURED" || error?.code === "FIREBASE_CONFIG_INVALID" ? 503 : 401;
        return json(status, {
          ok: false,
          error: status === 503
            ? "Firebase authentication is not configured on the backend."
            : "Firebase authentication failed."
        }, event, rateLimitHeaders(limited, 5));
      }

      const firebaseEmail = typeof decoded?.email === "string" ? decoded.email.trim().toLowerCase() : "";
      const emailCheck = validateAdminEmail(firebaseEmail, 160);
      if (!emailCheck.ok) {
        return json(401, { ok: false, error: "A valid Firebase admin email is required." }, event, rateLimitHeaders(limited, 5));
      }

      email = emailCheck;
      const rows = await list(
        "admins",
        `?select=email,role,password_hash,active,session_version&email=eq.${encodeURIComponent(email.value)}&limit=1`
      );
      admin = Array.isArray(rows) ? rows[0] : null;

      if (!admin || !Boolean(admin.active) || admin.role !== "admin") {
        return json(403, { ok: false, error: "This Firebase account is not authorized as a portfolio administrator." }, event, rateLimitHeaders(limited, 5));
      }
    } else {
      email = validateAdminEmail(payload.email, 160);
      const password = typeof payload.password === "string" ? payload.password : "";

      if (!email.ok || password.length < 1) {
        return json(401, { ok: false, error: "Invalid email or password." }, event, rateLimitHeaders(limited, 5));
      }

      const rows = await list(
        "admins",
        `?select=email,role,password_hash,active,session_version&email=eq.${encodeURIComponent(email.value)}&limit=1`
      );
      admin = Array.isArray(rows) ? rows[0] : null;
      const valid = Boolean(admin) &&
        Boolean(admin.active) &&
        admin.role === "admin" &&
        verifyPassword(password, admin.password_hash);

      if (!valid) {
        return json(401, { ok: false, error: "Invalid email or password." }, event, rateLimitHeaders(limited, 5));
      }
    }

    resetRateLimit(rateKey);
    const authSession = createLoginSession(admin.email, admin.session_version, event);

    return json(200, {
      ok: true,
      authenticated: true,
      user: { email: admin.email, role: admin.role },
      csrfToken: authSession.csrf,
      expiresIn: SESSION_TTL_SECONDS
    }, event, {
      "set-cookie": authSession.cookies,
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
