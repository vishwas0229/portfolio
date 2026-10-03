const test = require("node:test");
const assert = require("node:assert/strict");

const {
  checkRateLimit,
  resetRateLimit,
  rateLimitHeaders
} = require("../netlify/functions/_shared/rate-limit");

test("rate limit blocks after the configured number of attempts", () => {
  const key = "test-login-limit-" + Date.now();
  const results = Array.from({ length: 6 }, () => checkRateLimit(key, 5, 60_000));
  assert.equal(results[0].allowed, true);
  assert.equal(results[4].allowed, true);
  assert.equal(results[5].allowed, false);
  assert.ok(results[5].retryAfter >= 1);
  resetRateLimit(key);
});

test("resetRateLimit clears a bucket immediately", () => {
  const key = "test-login-reset-" + Date.now();
  checkRateLimit(key, 5, 60_000);
  checkRateLimit(key, 5, 60_000);
  resetRateLimit(key);
  const fresh = checkRateLimit(key, 5, 60_000);
  assert.equal(fresh.remaining, 4);
  resetRateLimit(key);
});

test("rate-limit headers expose retry-after", () => {
  const headers = rateLimitHeaders({ remaining: 0, retryAfter: 42 }, 5);
  assert.equal(headers["retry-after"], "42");
  assert.equal(headers["x-ratelimit-limit"], "5");
  assert.equal(headers["x-ratelimit-remaining"], "0");
});
