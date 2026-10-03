const { config } = require("./config");

const cache = new Map();
const inflight = new Map();

function read(key, ttlMs, staleMs = config.cacheStaleMs) {
  const entry = cache.get(key);
  if (!entry) return { state: "miss", value: null };
  const age = Date.now() - entry.cachedAt;
  if (age <= ttlMs) return { state: "fresh", value: entry.value, ageMs: age };
  if (age <= staleMs) return { state: "stale", value: entry.value, ageMs: age };
  cache.delete(key);
  return { state: "miss", value: null };
}

async function getOrLoad(key, loader, ttlMs, staleMs = config.cacheStaleMs) {
  const current = read(key, ttlMs, staleMs);
  if (current.state === "fresh") return { value: current.value, cache: current };
  if (inflight.has(key)) {
    try {
      const value = await inflight.get(key);
      return { value, cache: { state: "fresh", value, ageMs: 0 } };
    } catch (error) {
      if (current.state === "stale") return { value: current.value, cache: current, fallback: true };
      throw error;
    }
  }
  const promise = Promise.resolve().then(loader);
  inflight.set(key, promise);
  try {
    const value = await promise;
    cache.set(key, { value, cachedAt: Date.now() });
    return { value, cache: { state: "fresh", value, ageMs: 0 } };
  } catch (error) {
    if (current.state === "stale") return { value: current.value, cache: current, fallback: true };
    throw error;
  } finally {
    inflight.delete(key);
  }
}

module.exports = { read, getOrLoad };
