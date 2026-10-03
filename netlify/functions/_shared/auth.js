const crypto = require("node:crypto");
const { getClientIp } = require("./rate-limit");
const { config } = require("./config");

const SESSION_COOKIE = "portfolio_admin_session";
const CSRF_COOKIE = "portfolio_admin_csrf";
const SESSION_TTL_SECONDS = 8 * 60 * 60;

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

function buildSession(email) {
  const csrf = crypto.randomBytes(24).toString("base64url");
  return {
    payload: {
      sub: email,
      role: "admin",
      csrf,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS
    },
    csrf
  };
}

function cookie(name, value, maxAge, httpOnly) {
  return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; SameSite=Strict; Secure${httpOnly ? "; HttpOnly" : ""}`;
}

function clearCookie(name) {
  return `${name}=; Path=/; Max-Age=0; SameSite=Strict; Secure${name === SESSION_COOKIE ? "; HttpOnly" : ""}`;
}

function createLoginCookies(email) {
  const session = buildSession(email);
  const token = encode(session.payload);
  return [cookie(SESSION_COOKIE, token, SESSION_TTL_SECONDS, true), cookie(CSRF_COOKIE, session.csrf, SESSION_TTL_SECONDS, false)];
}

function getSession(event) {
  const cookies = parseCookies(event);
  return decode(cookies[SESSION_COOKIE]);
}

function requireAdmin(event) {
  const session = getSession(event);
  if (!session || session.role !== "admin" || !session.sub) {
    const error = new Error("Unauthorized");
    error.statusCode = 401;
    throw error;
  }
  return session;
}

function requireSameOrigin(event) {
  const origin = event?.headers?.origin || event?.headers?.Origin;
  if (origin && origin !== config.corsOrigin) {
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
  getSession,
  requireAdmin,
  requireSameOrigin,
  requireCsrf,
  clearCookie,
  getClientIp
};
