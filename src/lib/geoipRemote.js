// Lightweight remote GeoIP lookup with in-memory caching.
// Uses ipapi.co JSON endpoint and caches results for 1 hour.

const CACHE_TTL = 1000 * 60 * 60; // 1 hour
const REQUEST_TIMEOUT_MS = 1500; // don't block logging for too long

const cache = new Map();

async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

export async function lookup(ip) {
  if (!ip || ip === "unknown") return null;

  const now = Date.now();
  const cached = cache.get(ip);
  if (cached && cached.expiresAt > now) return cached.data;

  try {
    const url = `https://ipapi.co/${encodeURIComponent(ip)}/json/`;
    const res = await fetchWithTimeout(url, REQUEST_TIMEOUT_MS);
    if (!res || !res.ok) return null;
    const data = await res.json().catch(() => null);
    if (!data) return null;
    const entry = { data, expiresAt: now + CACHE_TTL };
    cache.set(ip, entry);
    return data;
  } catch (err) {
    return null;
  }
}

export function clearCache() {
  cache.clear();
}

export default { lookup, clearCache };
