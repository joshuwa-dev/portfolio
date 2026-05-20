import fetch from 'node-fetch';

// Simple in-memory cache for local testing. Keyed by IP string.
const cache = new Map(); // ip -> { country, fetchedAt, expiresAt, raw }

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const IPAPI_TIMEOUT_MS = process.env.GEOIP_TIMEOUT_MS ? Number(process.env.GEOIP_TIMEOUT_MS) : 3000;

function now() {
  return Date.now();
}

async function lookupIp(ip) {
  const cached = cache.get(ip);
  if (cached && cached.expiresAt > now()) return { ok: true, ...cached };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IPAPI_TIMEOUT_MS);
  try {
    const res = await fetch(`https://ipapi.co/${ip}/json/`, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      // store a short negative cache to avoid immediate retries
      const shortExpire = now() + 10 * 60 * 1000; // 10m
      cache.set(ip, { country: null, raw: { status: res.status, text }, fetchedAt: now(), expiresAt: shortExpire });
      return { ok: false, status: res.status, text };
    }
    const json = await res.json().catch(() => ({}));
    const country = json && (json.country || json.country_name || json.country_code) ? (json.country || json.country_code || json.country_name) : null;
    const entry = { country, raw: json, fetchedAt: now(), expiresAt: now() + DEFAULT_TTL_MS };
    cache.set(ip, entry);
    return { ok: true, ...entry };
  } catch (err) {
    clearTimeout(timeout);
    const shortExpire = now() + 10 * 60 * 1000; // 10m
    cache.set(ip, { country: null, raw: { err: String(err) }, fetchedAt: now(), expiresAt: shortExpire });
    return { ok: false, err: String(err) };
  }
}

export async function GET(req) {
  // Allow query param ?ip=8.8.8.8 for testing, otherwise use x-forwarded-for header
  const url = new URL(req.url);
  const qIp = url.searchParams.get('ip');
  const forwarded = req.headers.get('x-forwarded-for');
  const clientIp = qIp || (forwarded ? forwarded.split(',')[0].trim() : null) || '8.8.8.8';

  const result = await lookupIp(clientIp);
  const body = {
    ip: clientIp,
    country: result.country || null,
    ok: Boolean(result.ok),
    raw: result.raw || null,
  };

  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

export async function POST(req) {
  // Accept a JSON body with { ip } to force lookup / refresh
  try {
    const data = await req.json();
    const ip = data && data.ip ? data.ip : null;
    if (!ip) return new Response(JSON.stringify({ error: 'missing ip' }), { status: 400 });
    const result = await lookupIp(ip);
    return new Response(JSON.stringify({ ip, country: result.country || null, ok: Boolean(result.ok), raw: result.raw || null }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

export const dynamic = 'force-dynamic';
