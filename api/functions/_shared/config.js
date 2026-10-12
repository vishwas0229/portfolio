const intEnv = (name, fallback, min = 0, max = Number.MAX_SAFE_INTEGER) => {
  const value = Number.parseInt(process.env[name] || "", 10);
  return Number.isFinite(value) ? Math.min(Math.max(value, min), max) : fallback;
};

const trimEnv = (name, fallback) => {
  const value = String(process.env[name] || "").trim();
  return value || fallback;
};

const config = Object.freeze({
  siteUrl: trimEnv("PORTFOLIO_SITE_URL", "https://portfolio.postlyfi.in").replace(/\/$/, ""),
  corsOrigin: trimEnv("CORS_ORIGIN", trimEnv("PORTFOLIO_SITE_URL", "https://portfolio.postlyfi.in")).replace(/\/$/, ""),
  githubUsername: trimEnv("GITHUB_USERNAME", "vishwas0229"),
  leetcodeUsername: trimEnv("LEETCODE_USERNAME", "vishwas0229"),
  githubCacheTtlMs: intEnv("GITHUB_CACHE_TTL_SECONDS", 300, 15, 86400) * 1000,
  leetcodeCacheTtlMs: intEnv("LEETCODE_CACHE_TTL_SECONDS", 300, 15, 86400) * 1000,
  cacheStaleMs: intEnv("API_CACHE_STALE_SECONDS", 3600, 60, 604800) * 1000,
  apiRateLimitWindowMs: intEnv("API_RATE_LIMIT_WINDOW_SECONDS", 60, 10, 3600) * 1000,
  apiRateLimitMax: intEnv("API_RATE_LIMIT_MAX", 60, 1, 600),
  appVersion: trimEnv("APP_VERSION", process.env.COMMIT_REF || process.env.COMMIT_SHA || "dev"),
  secureCookies: String(process.env.COOKIE_SECURE || "true").toLowerCase() !== "false",
  adminSessionTtlSeconds: intEnv("ADMIN_SESSION_TTL_SECONDS", 1800, 300, 86400)
});

module.exports = { config };
