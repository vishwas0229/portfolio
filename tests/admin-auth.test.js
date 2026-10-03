const test = require("node:test");
const assert = require("node:assert/strict");

process.env.ADMIN_SESSION_SECRET = "unit-test-secret-that-is-long-enough-123456";
process.env.CORS_ORIGIN = "http://localhost:8888";
process.env.COOKIE_SECURE = "false";

const {
  hashPassword,
  verifyPassword,
  createLoginCookies,
  getSession
} = require("../netlify/functions/_shared/auth");

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

test("session endpoint accepts a correctly signed cookie", () => {
  const cookies = createLoginCookies("admin@example.com");
  const sessionCookie = cookies[0].split(";")[0];
  const event = { headers: { cookie: sessionCookie } };
  const session = getSession(event);
  assert.equal(session.sub, "admin@example.com");
  assert.equal(session.role, "admin");
});
