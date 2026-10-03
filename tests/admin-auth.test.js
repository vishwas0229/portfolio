const test = require("node:test");
const assert = require("node:assert/strict");

process.env.ADMIN_SESSION_SECRET = "unit-test-secret-that-is-long-enough-123456";
process.env.CORS_ORIGIN = "http://localhost:8888";
process.env.COOKIE_SECURE = "false";

const {
  hashPassword,
  verifyPassword,
  createLoginCookies,
  getSession,
  requireSameOrigin,
  requestIsHttps,
  SESSION_TTL_SECONDS
} = require("../netlify/functions/_shared/auth");
const { validateEmail, validateAdminEmail } = require("../netlify/functions/_shared/validation");

test("public email validation remains strict", () => {
  assert.equal(validateEmail("admin@admin").ok, false);
  assert.equal(validateEmail("admin@example.com").ok, true);
});

test("admin email validation accepts local admin addresses", () => {
  assert.equal(validateAdminEmail("admin@admin").ok, true);
  assert.equal(validateAdminEmail("admin@localhost").ok, true);
  assert.equal(validateAdminEmail("admin@example.com").ok, true);
  assert.equal(validateAdminEmail("not-an-email").ok, false);
});

test("admin password hashing is one-way and verifiable", () => {
  const encoded = hashPassword("Correct Horse Battery Staple");
  assert.match(encoded, /^pbkdf2\$sha256\$\d+\$[^$]+\$[^$]+$/);
  assert.equal(verifyPassword("Correct Horse Battery Staple", encoded), true);
  assert.equal(verifyPassword("wrong password", encoded), false);
});

test("login cookies include signed session and CSRF token", () => {
  const cookies = createLoginCookies("admin@example.com");
  assert.equal(cookies.length, 2);
  assert.match(cookies[0], /portfolio_admin_session=/);
  assert.match(cookies[0], /HttpOnly/);
  assert.match(cookies[1], /portfolio_admin_csrf=/);
});

test("session contains a database session version", () => {
  const cookies = createLoginCookies("admin@example.com", 7);
  const sessionCookie = cookies[0].split(";")[0];
  const event = { headers: { cookie: sessionCookie } };
  const session = getSession(event);
  assert.equal(session.sessionVersion, 7);
});

test("session endpoint accepts a correctly signed cookie", () => {
  const cookies = createLoginCookies("admin@example.com");
  const sessionCookie = cookies[0].split(";")[0];
  const event = { headers: { cookie: sessionCookie } };
  const session = getSession(event);
  assert.equal(session.sub, "admin@example.com");
  assert.equal(session.role, "admin");
  assert.equal(session.sessionVersion, 1);
});

test("admin session TTL is finite and configurable", () => {
  assert.equal(SESSION_TTL_SECONDS, 1800);
});

test("secure cookies follow proxied HTTPS requests", () => {
  const cookies = createLoginCookies("admin@example.com", 1, {
    headers: { "x-forwarded-proto": "https" }
  });
  assert.match(cookies[0], /; Secure/);
  assert.equal(requestIsHttps({ headers: { "x-forwarded-proto": "https" } }), true);
  assert.equal(requestIsHttps({ headers: { "x-forwarded-proto": "http" } }), false);
});

test("development Cloudflare Tunnel origin is allowed", () => {
  assert.doesNotThrow(() => requireSameOrigin({
    headers: {
      origin: "https://example.trycloudflare.com",
      "cf-connecting-ip": "203.0.113.10"
    }
  }));
});
