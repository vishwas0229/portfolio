const { config } = require("./config");

const buckets = new Map();

function getClientIp(event) {
  const headers = event?.headers || {};
  const forwarded = headers["x-forwarded-for"] || headers["X-Forwarded-For"] || "";
  const candidate = String(forwarded).split(",")[0].trim();
  return candidate || String(headers["client-ip"] || headers["Client-Ip"] || "unknown").trim() || "unknown";
}

function checkRateLimit(key, limit = config.apiRateLimitMax, windowMs = config.apiRateLimitWindowMs) {
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }

  bucket.count += 1;
  const remaining = Math.max(0, limit - bucket.count);
  const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));

  if (bucket.count > limit) {
    return { allowed: false, remaining: 0, retryAfter };
  }
  return { allowed: true, remaining, retryAfter };
}

function rateLimitHeaders(result, limit = config.apiRateLimitMax) {
  return {
    "x-ratelimit-limit": String(limit),
    "x-ratelimit-remaining": String(result.remaining),
    "retry-after": String(result.retryAfter)
  };
}

function pruneRateLimitBuckets(maxAgeMs = 3600000) {
  const cutoff = Date.now() - maxAgeMs;
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt < cutoff) buckets.delete(key);
  }
}

setInterval(() => pruneRateLimitBuckets(), 15 * 60 * 1000).unref?.();

module.exports = { getClientIp, checkRateLimit, rateLimitHeaders, pruneRateLimitBuckets };
