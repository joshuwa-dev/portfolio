import admin from "firebase-admin";
import { NextResponse } from "next/server";
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

if (!admin.apps.length) {
  try {
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
        admin.initializeApp({
          credential: admin.credential.applicationDefault(),
        });
      }
    }
  } catch (e) {
    console.error("Failed to initialize firebase-admin:", e);
  }
}

export async function POST(req) {
  try {
    const { idToken } = await req.json();
    if (!idToken)
      return NextResponse.json({ error: "missing_token" }, { status: 400 });

    // Verify token and extract email
    let decoded;
    try {
      decoded = await admin.auth().verifyIdToken(idToken);
    } catch (e) {
      return NextResponse.json({ error: "invalid_token" }, { status: 401 });
    }

    const email = decoded.email;
    if (!email)
      return NextResponse.json({ error: "no_email_in_token" }, { status: 400 });

    const adminDb = admin.firestore();
    const lockRef = adminDb
      .collection("otp_locks")
      .doc(String(email).toLowerCase());
    try {
      await lockRef.delete();
      // best-effort post to auth-logs that the account was unlocked via Google
      try {
        const host = req.headers.get("host") || "localhost:3000";
        const proto =
          req.headers.get("x-forwarded-proto") ||
          (process.env.NODE_ENV === "production" ? "https" : "http");
        const url = `${proto}://${host}/api/auth-logs`;
        const payload = {
          eventType: "auth.account.unlocked",
          userId: String(email).toLowerCase(),
          email: String(email).toLowerCase(),
          platform: "web",
          authSource: "google",
          metadata: { unlockedAt: new Date().toISOString(), method: "google" },
        };
        console.log(
          "EMIT auth.account.unlocked (unlock endpoint) ->",
          JSON.stringify(payload),
        );
        await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        // Follow-up: emit auth.login.success to indicate the user completed a Google sign-in
        try {
          const successPayload = {
            eventType: "auth.login.success",
            userId: String(email).toLowerCase(),
            email: String(email).toLowerCase(),
            platform: "web",
            provider: "google_oauth",
            metadata: {
              unlockedAt: new Date().toISOString(),
              method: "google",
            },
          };
          console.log(
            "EMIT auth.login.success (unlock endpoint) ->",
            JSON.stringify(successPayload),
          );
          await fetch(url, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(successPayload),
          });
        } catch (e2) {
          console.warn("postAuthLog login.success failed:", e2?.message || e2);
        }
      } catch (e) {
        console.warn("postAuthLog unlock failed:", e?.message || e);
      }
    } catch (e) {
      // best-effort
      console.warn(
        "Failed to clear otp lock on unlock endpoint:",
        e?.message || e,
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("OTP unlock error:", err);
    return NextResponse.json(
      { error: err?.message || "unlock_failed" },
      { status: 500 },
    );
  }
}
