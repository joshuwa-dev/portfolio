import fs from 'fs';
import path from 'path';
import maxmind from 'maxmind';

const CITY_DB_PATH = process.env.GEOIP_DB_PATH || path.join(process.cwd(), 'data', 'GeoLite2-City.mmdb');
const ASN_DB_PATH = process.env.GEOIP_ASN_DB_PATH || path.join(process.cwd(), 'data', 'GeoLite2-ASN.mmdb');

let cityReader = null;
let asnReader = null;
let cityLoaded = false;
let asnLoaded = false;
let attempted = false;

async function tryLoad() {
  if (attempted) return;
  attempted = true;
  try {
    if (fs.existsSync(CITY_DB_PATH)) {
      try {
        cityReader = await maxmind.open(CITY_DB_PATH);
        cityLoaded = true;
        console.info('geoipLocal: loaded City DB from', CITY_DB_PATH);
      } catch (e) {
        cityLoaded = false;
        console.warn('geoipLocal: failed to open City DB', e?.message || e);
      }
    } else {
      console.info('geoipLocal: City DB not found at', CITY_DB_PATH);
    }

    if (fs.existsSync(ASN_DB_PATH)) {
      try {
        asnReader = await maxmind.open(ASN_DB_PATH);
        asnLoaded = true;
        console.info('geoipLocal: loaded ASN DB from', ASN_DB_PATH);
      } catch (e) {
        asnLoaded = false;
        console.warn('geoipLocal: failed to open ASN DB', e?.message || e);
      }
    } else {
      console.info('geoipLocal: ASN DB not found at', ASN_DB_PATH);
    }
  } catch (err) {
    console.warn('geoipLocal: unexpected error during DB load', err?.message || err);
  }
}

export async function lookup(ip) {
  await tryLoad();

  if (!cityLoaded && !asnLoaded) {
    return { countryCode: null, countryName: null, source: 'db-missing' };
  }

  let cityRes = null;
  let asnRes = null;
  try {
    if (cityLoaded && cityReader) cityRes = cityReader.get(ip) || null;
  } catch (e) {
    console.warn('geoipLocal: city lookup error', e?.message || e);
  }
  try {
    if (asnLoaded && asnReader) asnRes = asnReader.get(ip) || null;
  } catch (e) {
    console.warn('geoipLocal: asn lookup error', e?.message || e);
  }

  const countryCode = cityRes?.country?.iso_code || cityRes?.registered_country?.iso_code || null;
  const countryName = cityRes?.country?.names?.en || cityRes?.registered_country?.names?.en || null;
  const cityName = cityRes?.city?.names?.en || null;
  const subdivision = cityRes?.subdivisions && cityRes.subdivisions[0]
    ? (cityRes.subdivisions[0].names?.en || cityRes.subdivisions[0].iso_code)
    : null;
  const latitude = cityRes?.location?.latitude || null;
  const longitude = cityRes?.location?.longitude || null;
  const time_zone = cityRes?.location?.time_zone || null;

  // ASN/ISP DBs sometimes return fields at top-level or under `traits`.
  // Prefer explicit ASN org or ISP values, falling back to city traits when present.
  const isp = asnRes?.traits?.isp || asnRes?.isp || asnRes?.autonomous_system_organization || cityRes?.traits?.isp || null;
  const organization = asnRes?.autonomous_system_organization || asnRes?.traits?.autonomous_system_organization || asnRes?.traits?.organization || cityRes?.traits?.organization || null;

  return {
    countryCode,
    countryName,
    cityName,
    subdivision,
    latitude,
    longitude,
    time_zone,
    isp,
    organization,
    source: (cityLoaded ? 'maxmind-city' : '') + (asnLoaded ? (cityLoaded ? '+asn' : 'maxmind-asn') : ''),
    raw: { city: cityRes || null, asn: asnRes || null },
  };
}

export function isAvailable() {
  return cityLoaded || asnLoaded;
}
