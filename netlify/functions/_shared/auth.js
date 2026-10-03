const crypto = require("node:crypto");
const { getClientIp } = require("./rate-limit");
const { config } = require("./config");
const { list } = require("./db");

const SESSION_COOKIE = "portfolio_admin_session";
const CSRF_COOKIE = "portfolio_admin_csrf";
const SESSION_TTL_SECONDS = config.adminSessionTtlSeconds;

function getSecret() {
  const secret = String(process.env.ADMIN_SESSION_SECRET || "").trim();
  if (secret.length < 32) throw new Error("Admin session secret is not configured");
  return secret;
}

function parseCookies(event) {
  const raw = event?.headers?.cookie || event?.headers?.Cookie || "";
  return Object.fromEntries(
    raw.split(";").map(part => part.trim()).filter(Boolean).map(part => {
      const idx = part.indexOf("=");
      return idx === -1 ? [part, ""] : [part.slice(0, idx), decodeURIComponent(part.slice(idx + 1))];
    })
  );
}

function sign(value) {
  return crypto.createHmac("sha256", getSecret()).update(value).digest("base64url");
}

function encode(payload) {
  const data = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${data}.${sign(data)}`;
}

function decode(token) {
  if (!token || typeof token !== "string") return null;
  const [data, signature] = token.split(".");
  if (!data || !signature) return null;

  const expected = sign(data);
  const sig = Buffer.from(signature);
  const exp = Buffer.from(expected);
  if (sig.length !== exp.length || !crypto.timingSafeEqual(sig, exp)) return null;

  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8"));
    return payload.exp > Math.floor(Date.now() / 1000) ? payload : null;
  } catch (_) {
    return null;
  }
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("base64url")) {
  const iterations = 210000;
  const hash = crypto.pbkdf2Sync(password, salt, iterations, 32, "sha256").toString("base64url");
  return `pbkdf2$sha256$${iterations}$${salt}$${hash}`;
}

function verifyPassword(password, encoded) {
  try {
    const [scheme, digest, iterationsText, salt, expectedHash] = String(encoded).split("$");
    if (scheme !== "pbkdf2" || digest !== "sha256") return false;
    const iterations = Number(iterationsText);
    if (!Number.isInteger(iterations) || iterations < 100000 || iterations > 1000000 || !salt || !expectedHash) return false;
    const actual = crypto.pbkdf2Sync(password, salt, iterations, 32, "sha256");
    const expected = Buffer.from(expectedHash, "base64url");
    return expected.length === actual.length && crypto.timingSafeEqual(actual, expected);
  } catch (_) {
    return false;
  }
}

function buildSession(email, sessionVersion = 1) {
  const csrf = crypto.randomBytes(24).toString("base64url");
  return {
    payload: {
      sub: email,
      role: "admin",
      sessionVersion: Number(sessionVersion) || 1,
      csrf,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS
    },
    csrf
  };
}

function requestIsHttps(event) {
  const headers = event?.headers || {};
  const forwardedProto = String(headers["x-forwarded-proto"] || headers["X-Forwarded-Proto"] || "").split(",")[0].trim().toLowerCase();
  if (forwardedProto) return forwardedProto === "https";

  const cfVisitor = headers["cf-visitor"] || headers["CF-Visitor"];
  if (cfVisitor) {
    try { return JSON.parse(cfVisitor).scheme === "https"; } catch (_) {}
  }

  const origin = headers.origin || headers.Origin || "";
  try { return new URL(origin).protocol === "https:"; } catch (_) {}
  return false;
}

function shouldSecureCookie(event) {
  return config.secureCookies || requestIsHttps(event);
}

function cookie(name, value, maxAge, httpOnly, secure = config.secureCookies) {
  return name + "=" + encodeURIComponent(value) + "; Path=/; Max-Age=" + maxAge + "; SameSite=Strict" + (secure ? "; Secure" : "") + (httpOnly ? "; HttpOnly" : "");
}

function clearCookie(name, event) {
  return name + "=; Path=/; Max-Age=0; SameSite=Strict" + (shouldSecureCookie(event) ? "; Secure" : "") + (name === SESSION_COOKIE ? "; HttpOnly" : "");
}

function createLoginSession(email, sessionVersion = 1, event) {
  const session = buildSession(email, sessionVersion);
  const token = encode(session.payload);
  const secure = shouldSecureCookie(event);
  return {
    cookies: [
      cookie(SESSION_COOKIE, token, SESSION_TTL_SECONDS, true, secure),
      cookie(CSRF_COOKIE, session.csrf, SESSION_TTL_SECONDS, false, secure)
    ],
    csrf: session.csrf
  };
}

function createLoginCookies(email, sessionVersion = 1, event) {
  return createLoginSession(email, sessionVersion, event).cookies;
}

function getSession(event) {
  const cookies = parseCookies(event);
  return decode(cookies[SESSION_COOKIE]);
}

async function requireAdmin(event) {
  const session = getSession(event);
  if (!session || session.role !== "admin" || !session.sub) {
    console.warn("[auth] admin session rejected: no valid session cookie");
    const error = new Error("Unauthorized");
    error.statusCode = 401;
    throw error;
  }

  const rows = await list(
    "admins",
    `?select=email,role,active,session_version&email=eq.${encodeURIComponent(session.sub)}&limit=1`
  );
  const admin = Array.isArray(rows) ? rows[0] : null;
  if (!admin) {
    console.warn("[auth] admin session rejected: account not found");
    const error = new Error("Unauthorized");
    error.statusCode = 401;
    throw error;
  }
  if (!Boolean(admin.active) || admin.role !== "admin") {
    console.warn("[auth] admin session rejected: account inactive or role invalid");
    const error = new Error("Unauthorized");
    error.statusCode = 401;
    throw error;
  }
  if (Number(admin.session_version || 1) !== Number(session.sessionVersion || 0)) {
    console.warn("[auth] admin session rejected: session version mismatch");
    const error = new Error("Unauthorized");
    error.statusCode = 401;
    throw error;
  }

  return session;
}

function requireSameOrigin(event) {
  const origin = event?.headers?.origin || event?.headers?.Origin;
  if (!origin) return;

  const normalizedOrigin = String(origin).replace(/\/$/, "");
  const allowed = new Set([config.corsOrigin]);

  if (String(process.env.NODE_ENV || "").toLowerCase() === "development") {
    allowed.add("http://localhost:8888");
    allowed.add("http://127.0.0.1:8888");

    const cloudflareRequest = Boolean(
      event?.headers?.["cf-connecting-ip"] ||
      event?.headers?.["CF-Connecting-IP"] ||
      event?.headers?.["cf-ray"] ||
      event?.headers?.["CF-Ray"]
    );
    if (cloudflareRequest && normalizedOrigin.startsWith("https://")) {
      allowed.add(normalizedOrigin);
    }

    const forwardedHost = event?.headers?.["x-forwarded-host"] || event?.headers?.["X-Forwarded-Host"];
    const forwardedProto = event?.headers?.["x-forwarded-proto"] || event?.headers?.["X-Forwarded-Proto"];
    const host = forwardedHost || event?.headers?.host || event?.headers?.Host;
    const proto = String(forwardedProto || "http").split(",")[0].trim().toLowerCase();
    if (host && (proto === "http" || proto === "https")) {
      allowed.add(proto + "://" + String(host).split(",")[0].trim());
    }
  }

  if (!allowed.has(normalizedOrigin)) {
    const error = new Error("Forbidden");
    error.statusCode = 403;
    throw error;
  }
}

function requireCsrf(event, session) {
  const cookies = parseCookies(event);
  const header = event?.headers?.["x-csrf-token"] || event?.headers?.["X-CSRF-Token"] || "";
  if (!header || !cookies[CSRF_COOKIE] || header !== cookies[CSRF_COOKIE] || header !== session.csrf) {
    const error = new Error("Invalid CSRF token");
    error.statusCode = 403;
    throw error;
  }
}

module.exports = {
  SESSION_COOKIE,
  CSRF_COOKIE,
  SESSION_TTL_SECONDS,
  hashPassword,
  verifyPassword,
  createLoginCookies,
  createLoginSession,
  getSession,
  requireAdmin,
  requireSameOrigin,
  requireCsrf,
  clearCookie,
  requestIsHttps,
  getClientIp
};
