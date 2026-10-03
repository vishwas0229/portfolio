const test = require("node:test");
const assert = require("node:assert/strict");

const { validateString, validateEmail, isHoneypotFilled } = require("../netlify/functions/_shared/validation");
const { checkRateLimit } = require("../netlify/functions/_shared/rate-limit");

test("validateString trims input and enforces max length", () => {
  assert.equal(validateString("  Rahul  ", { field: "name", max: 10 }).value, "Rahul");
  assert.equal(validateString("", { field: "name" }).ok, false);
  assert.equal(validateString("123456", { field: "name", max: 5 }).ok, false);
});

test("validateEmail accepts valid email and rejects malformed values", () => {
  assert.equal(validateEmail(" Rahul@Example.COM ").value, "rahul@example.com");
  assert.equal(validateEmail("not-an-email").ok, false);
});

test("honeypot flags non-empty bot fields", () => {
  assert.equal(isHoneypotFilled(""), false);
  assert.equal(isHoneypotFilled("https://bot.example"), true);
});

test("rate limiter throttles requests after the configured threshold", () => {
  const key = "test-rate-limit-" + Date.now() + "-" + Math.random();
  assert.equal(checkRateLimit(key, 2, 60000).allowed, true);
  assert.equal(checkRateLimit(key, 2, 60000).allowed, true);
  assert.equal(checkRateLimit(key, 2, 60000).allowed, false);
});
