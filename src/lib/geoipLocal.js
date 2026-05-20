import fs from 'fs';
import path from 'path';
import maxmind from 'maxmind';

const DB_PATH = process.env.GEOIP_DB_PATH || path.join(process.cwd(), 'data', 'GeoLite2-Country.mmdb');
let reader = null;
let loaded = false;

async function tryLoad() {
  if (loaded) return;
  try {
    if (fs.existsSync(DB_PATH)) {
      reader = await maxmind.open(DB_PATH);
      loaded = true;
    } else {
      loaded = false;
    }
  } catch (err) {
    console.warn('geoipLocal: failed to open DB', err?.message || err);
    loaded = false;
  }
}

export async function lookup(ip) {
  await tryLoad();
  if (!loaded || !reader) {
    return { countryCode: null, countryName: null, source: 'db-missing' };
  }
  try {
    const res = reader.get(ip);
    const countryCode = res?.country?.iso_code || null;
    const countryName = res?.country?.names?.en || null;
    return { countryCode, countryName, source: 'maxmind', raw: res || null };
  } catch (err) {
    return { countryCode: null, countryName: null, source: 'error', err: String(err) };
  }
}

export function isAvailable() {
  return loaded && !!reader;
}
