import { NextResponse } from "next/server";
import { authLogsLimiter } from "../../../lib/inMemoryRateLimiter";
import {
  lookup as geoLookup,
  isAvailable as geoAvailable,
} from "../../../lib/geoipLocal";
import { Logging } from "@google-cloud/logging";
import admin from "firebase-admin";
import fs from "fs";
import path from "path";

function parseServiceAccountFromEnv(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    try {
      const decoded = Buffer.from(raw, "base64").toString("utf8");
      return JSON.parse(decoded);
    } catch (e2) {
      return null;
    }
  }
}

// Initialize Cloud Logging client. Uses ADC in Cloud Run or
// GOOGLE_APPLICATION_CREDENTIALS locally when available.
const logging = new Logging({
  projectId:
    process.env.GCP_PROJECT ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    "av-web-app-492623",
});
const authLog = logging.log("auth_event");

async function writeStructuredAuthLog(payload) {
  // If LOG_TO_STDOUT=1 is set, emit JSON to stdout so platform logging
  // agents (Cloud Run, GKE) capture the same structured payload without
  // requiring a service account with Logging permissions.
  if (process.env.LOG_TO_STDOUT === "1") {
    console.log(JSON.stringify(payload));
    return;
  }

  try {
    const entry = authLog.entry({ resource: { type: "global" } }, payload);
    await authLog.write(entry);
  } catch (err) {
    // Best-effort fallback to stdout so logs are still visible locally.
    console.warn(
      "Cloud Logging write failed, falling back to stdout:",
      err?.message || err,
    );
    console.log(JSON.stringify(payload));
  }
}

// Canonical event types supported by the ingestion pipeline.
const ALLOWED_EVENT_TYPES = new Set([
  "auth.login.success",
  "auth.login.failed",
  "auth.logout",
  "auth.password.reset",
  "auth.mfa.failed",
  "auth.mfa.challenge",
  "auth.account.unlocked",
  "auth.account.ratelimited",
  "auth.account.locked",
  "auth.token.refresh",
]);

function normalizeAndValidateEventType(input) {
  const v = String(input || "")
    .trim()
    .toLowerCase();
  if (!v) return "auth.unknown";
  if (ALLOWED_EVENT_TYPES.has(v)) return v;
  if (v === "signin" || v === "login" || v === "auth.login")
    return "auth.login.success";
  if (v === "signout" || v === "logout" || v === "auth.logout")
    return "auth.logout";
  console.warn(
    "auth-logs: unknown event_type received; normalizing to auth.unknown:",
    v,
  );
  return "auth.unknown";
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));

    // If client didn't provide identifying info (email/userId), try to
    // populate it from an Authorization: Bearer <idToken> header by
    // verifying with firebase-admin when available. This is best-effort
    // and silently skips verification if admin can't be initialized.
    let resolvedEmail = body.email || null;
    let resolvedUserId = body.userId || null;
    const authHeader = request.headers.get("authorization") || "";
    if ((!resolvedEmail || !resolvedUserId) && authHeader.startsWith("Bearer ")) {
      const idToken = authHeader.split("Bearer ")[1];
      try {
        if (!admin.apps.length) {
          const envSvcRaw =
            process.env.FIREBASE_SERVICE_ACCOUNT ||
            process.env.FIREBASE_SERVICE_ACCOUNT_B64;
          const envSvc = parseServiceAccountFromEnv(envSvcRaw);
          if (envSvc) {
            admin.initializeApp({
              credential: admin.credential.cert(envSvc),
              projectId: envSvc.project_id || envSvc.projectId,
            });
          } else {
            const svcPath = path.join(
              process.cwd(),
              ".gitignore",
              "cobary-ed770-firebase-adminsdk-fbsvc-14428ea066.json",
            );
            if (fs.existsSync(svcPath)) {
              const svc = JSON.parse(fs.readFileSync(svcPath, "utf8"));
              admin.initializeApp({
                credential: admin.credential.cert(svc),
                projectId: svc.project_id,
              });
            } else {
              // Fallback to application default credentials (ADC)
              try {
                admin.initializeApp({
                  credential: admin.credential.applicationDefault(),
                });
              } catch (e) {
                // ignore init error; verification below will be skipped
              }
            }
          }
        }

        if (admin.apps.length) {
          const decoded = await admin.auth().verifyIdToken(idToken).catch(() => null);
          if (decoded) {
            resolvedEmail = resolvedEmail || decoded.email || null;
            resolvedUserId = resolvedUserId || decoded.uid || null;
          }
        }
      } catch (e) {
        // best-effort: do not block logging if verification fails
        console.warn("auth-logs: idToken verify failed:", e?.message || e);
      }
    }

    const ipHeader =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip");
    const clientIp = ipHeader ? ipHeader.split(",")[0].trim() : "unknown";

    // Rate limiting keyed by authenticated userId when present, otherwise by IP.
    // Use a higher-capacity limiter for auth logs so observability isn't easily throttled.
    const rateKey = resolvedUserId || clientIp;
    if (!authLogsLimiter.tryConsume(rateKey)) {
      console.warn("auth-logs: rate_limited", { rateKey });
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }

    const userAgent = request.headers.get("user-agent") || "";

    // Instant GeoIP lookup via local MaxMind DB if available. Falls back to
    // the `/api/geoip` proxy when the DB is missing.
    let geo = null;
    try {
      const result = await geoLookup(clientIp);
      // Accept any maxmind-derived source (e.g. 'maxmind-city', 'maxmind-city+asn')
      if (
        result &&
        result.source &&
        String(result.source).includes("maxmind")
      ) {
        geo = result;
      } else if (result && result.source === "db-missing") {
        // Attempt fallback to internal proxy so deployments without the DB still work.
        try {
          const origin = new URL(request.url).origin;
          const fallback = await fetch(
            `${origin}/api/geoip?ip=${encodeURIComponent(clientIp)}`,
          );
          if (fallback.ok) {
            const j = await fallback.json().catch(() => null);
            geo = j ? { country: j.country, source: "proxy" } : null;
          }
        } catch (e) {
          /* ignore fallback errors */
        }
      }
    } catch (e) {
      console.warn("auth-logs: geo lookup error", e?.message || e);
    }

    // Optional debug logging — enable by setting DEBUG_AUTH_LOGS=1 or GEOIP_DEBUG=1
    const DEBUG_GEO =
      process.env.DEBUG_AUTH_LOGS === "1" || process.env.GEOIP_DEBUG === "1";
    if (DEBUG_GEO) {
      try {
        console.info("auth-logs: geoLookup result", { clientIp, geo });
      } catch (e) {
        /* ignore */
      }
    }

    const event = {
      event_timestamp: new Date().toISOString(),
      event_type: normalizeAndValidateEventType(body.eventType),

      user_id: resolvedUserId || null,
      email: resolvedEmail || null,

      ip_address: clientIp,
      country:
        (geo && (geo.countryCode || geo.country)) || body.country || null,
      city: (geo && (geo.cityName || geo.city)) || null,
      subdivision: (geo && geo.subdivision) || null,
      latitude: (geo && geo.latitude) || null,
      longitude: (geo && geo.longitude) || null,
      time_zone: (geo && geo.time_zone) || null,
      isp: (geo && geo.isp) || null,
      organization: (geo && geo.organization) || null,
      metadata: body.metadata || null,

      user_agent: userAgent,
      platform: body.platform || "web",

      provider: body.provider || null,
      app_version: body.appVersion || null,

      // Optional additional context for richer auth logs
      session_id: body.sessionId || null,
      device_id: body.deviceId || null,
      login_method: body.loginMethod || null,
      failure_reason: body.failureReason || null,

      metadata: body.metadata || null,
    };

    // Write structured log to Cloud Logging (preferred). Falls back to
    // stdout when the client fails so local dev still prints logs.
    await writeStructuredAuthLog({ log_type: "auth_event", ...event });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to publish auth event:", err);
    return NextResponse.json(
      { error: err?.message || "publish_failed" },
      { status: 500 },
    );
  }
}
