import { NextResponse } from "next/server";
import { defaultLimiter } from "../../../lib/inMemoryRateLimiter";

// Canonical event types supported by the ingestion pipeline.
const ALLOWED_EVENT_TYPES = new Set([
  "auth.login.success",
  "auth.login.failed",
  "auth.logout",
  "auth.password.reset",
  "auth.mfa.challenge",
  "auth.mfa.failed",
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
    // This allows logged-in users a dedicated quota while still protecting unauthenticated traffic.
    const rateKey = body.userId || clientIp;
    if (!defaultLimiter.tryConsume(rateKey)) {
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
      metadata: body.metadata || null,
    };

    // Write structured JSON to stdout so Cloud Logging can ingest it.
    // Cloud Logging will parse valid JSON lines into `jsonPayload` which
    // can be exported via a Log Sink to Pub/Sub or BigQuery.
    console.log(JSON.stringify({ log_type: "auth_event", ...event }));

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to publish auth event:", err);
    return NextResponse.json(
      { error: err?.message || "publish_failed" },
      { status: 500 },
    );
  }
}
