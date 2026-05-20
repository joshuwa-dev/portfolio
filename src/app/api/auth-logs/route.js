import { NextResponse } from "next/server";
import { authLogsLimiter } from "../../../lib/inMemoryRateLimiter";
import { Logging } from "@google-cloud/logging";

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

    const ipHeader =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip");
    const clientIp = ipHeader ? ipHeader.split(",")[0].trim() : "unknown";

    // Rate limiting keyed by authenticated userId when present, otherwise by IP.
    // Use a higher-capacity limiter for auth logs so observability isn't easily throttled.
    const rateKey = body.userId || clientIp;
    if (!authLogsLimiter.tryConsume(rateKey)) {
      console.warn("auth-logs: rate_limited", { rateKey });
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }

    const userAgent = request.headers.get("user-agent") || "";

    const event = {
      event_timestamp: new Date().toISOString(),
      event_type: normalizeAndValidateEventType(body.eventType),

      user_id: body.userId || null,
      email: body.email || null,

      ip_address: clientIp,
      country: body.country || null,

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
