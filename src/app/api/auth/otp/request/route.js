import admin from "firebase-admin";
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { defaultLimiter } from "../../../../../lib/inMemoryRateLimiter";

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
    const ipHeader =
      req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip");
    const clientIp = ipHeader ? ipHeader.split(",")[0].trim() : "unknown";
    if (!defaultLimiter.tryConsume(clientIp)) {
      return NextResponse.json(
        {
          error: "rate_limited",
          message: "Too many OTP codes requested - Sign in with Google",
          showGoogleLink: true,
        },
        { status: 429 },
      );
    }

    const { email, isResend } = await req.json();
    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "invalid_email" }, { status: 400 });
    }

    const emailLower = String(email).toLowerCase();

    const adminDb = admin.firestore();

    // Check for existing OTP lock (prevent resends while locked)
    const lockRef = adminDb.collection("otp_locks").doc(emailLower);
    try {
      const lockDoc = await lockRef.get();
      if (lockDoc.exists) {
        const data = lockDoc.data();
        if (data && data.locked) {
          try {
            await postAuthLog(req, {
              eventType: "auth.account.locked",
              userId: emailLower,
              email: emailLower,
              platform: "web",
              provider: "email_otp",
              metadata: { reason: "attempt_request_on_locked_account" },
            });
          } catch (e) {
            /* non-blocking */
          }

          return NextResponse.json(
            {
              error: "locked",
              message: "Account locked — unlock only via Google sign-in.",
              unlockWith: "google",
            },
            { status: 423 },
          );
        }
        // If resends are locked (resendLockedUntil) and still in effect, block resends
        if (
          isResend &&
          data &&
          data.resendLockedUntil &&
          data.resendLockedUntil.toMillis &&
          data.resendLockedUntil.toMillis() > Date.now()
        ) {
          return NextResponse.json(
            {
              error: "rate_limited",
              message: "Too many OTP resends — try again later.",
              showGoogleLink: true,
            },
            { status: 429 },
          );
        }
      }
    } catch (e) {
      console.warn("Failed to check otp lock:", e?.message || e);
    }

    // Best-effort POST to canonical auth-logs endpoint to record MFA challenge
    async function postAuthLog(req, payload) {
      try {
        const host = req.headers.get("host") || "localhost:3000";
        const proto =
          req.headers.get("x-forwarded-proto") ||
          (process.env.NODE_ENV === "production" ? "https" : "http");
        const url = `${proto}://${host}/api/auth-logs`;
        await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
      } catch (e) {
        console.warn("postAuthLog failed:", e?.message || e);
      }
    }

    // If no Firebase Auth user exists for this email, tell the client to
    // prompt the user to continue with Google sign-in to create an account.
    try {
      await admin.auth().getUserByEmail(emailLower);
    } catch (e) {
      // user-not-found -> suggest Google sign-in flow instead of OTP
      if (
        e?.code === "auth/user-not-found" ||
        (e?.message || "").includes("user-not-found")
      ) {
        return NextResponse.json({ needsGoogle: true }, { status: 404 });
      }
      // For other errors, log and continue to avoid blocking legitimate requests
      console.error("Error checking user existence:", e);
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const codeHash = crypto.createHash("sha256").update(code).digest("hex");
    const now = admin.firestore.Timestamp.now();
    const expiresAt = admin.firestore.Timestamp.fromMillis(
      Date.now() + 10 * 60 * 1000,
    ); // 10 minutes

    // If this is a resend attempt, increment resend counters and possibly lock resends for 24 hours
    if (isResend) {
      let willLockResends = false;
      // Rolling window: 1 hour (resends counted within this window)
      const WINDOW_MS = 60 * 60 * 1000;
      await adminDb.runTransaction(async (tx) => {
        const doc = await tx.get(lockRef);
        const existing = doc.exists ? doc.data() : {};
        const prev = existing.resendCount || 0;
        let firstResendAt = existing.firstResendAt || now;

        // Normalize firstResendAt to millis when possible
        let firstMillis = null;
        if (firstResendAt && typeof firstResendAt.toMillis === "function") {
          firstMillis = firstResendAt.toMillis();
        } else if (typeof firstResendAt === "number") {
          firstMillis = firstResendAt;
        }

        let next;
        if (firstMillis && firstMillis + WINDOW_MS <= Date.now()) {
          // Window expired — reset counter
          next = 1;
          firstResendAt = now;
        } else if (!firstMillis) {
          // No prior window — start one
          next = 1;
          firstResendAt = now;
        } else {
          next = prev + 1;
        }

        const update = { resendCount: next, firstResendAt };
        if (next >= 5) {
          const LOCK_MS = 24 * 60 * 60 * 1000;
          update.resendLockedUntil = admin.firestore.Timestamp.fromMillis(
            Date.now() + LOCK_MS,
          );
          willLockResends = true;
        }
        tx.set(lockRef, update, { merge: true });
      });

      if (willLockResends) {
        try {
          await postAuthLog(req, {
            eventType: "auth.account.ratelimited",
            userId: emailLower,
            email: emailLower,
            platform: "web",
            provider: "email_otp",
            metadata: { reason: "resend_threshold", threshold: 5 },
          });
        } catch (e) {
          // non-blocking
        }

        return NextResponse.json(
          {
            error: "rate_limited",
            message: "Too many OTP resends — try again later.",
            showGoogleLink: true,
          },
          { status: 429 },
        );
      }
    }

    await adminDb.collection("email_otps").add({
      email: emailLower,
      codeHash,
      createdAt: now,
      expiresAt,
      used: false,
    });
    // Send email: if SMTP configured, send via nodemailer; otherwise log for developer.
    if (process.env.SMTP_HOST) {
      try {
        const nodemailer = await import("nodemailer");
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT) || 587,
          secure: process.env.SMTP_SECURE === "1",
          auth: process.env.SMTP_USER
            ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
            : undefined,
        });

        await transporter.sendMail({
          to: email,
          from:
            process.env.SMTP_FROM ||
            `no-reply@${process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "localhost"}`,
          subject: "Your sign-in code",
          text: `Your sign-in code is: ${code} (valid for 10 minutes)`,
        });
      } catch (e) {
        console.error("Failed to send OTP email:", e);
      }
    } else {
      console.log(`OTP for ${email}: ${code}`);
    }

    // Emit auth.mfa.challenge for observability (best-effort)
    try {
      await postAuthLog(req, {
        eventType: "auth.mfa.challenge",
        userId: emailLower,
        email: emailLower,
        platform: "web",
        provider: "email_otp",
        metadata: { isResend: !!isResend },
      });
      if (isResend) {
        await postAuthLog(req, {
          eventType: "auth.token.refresh",
          userId: emailLower,
          email: emailLower,
          platform: "web",
          provider: "email_otp",
          metadata: { isResend: true },
        });
      }
    } catch (e) {
      // non-blocking
    }

    // For local debugging, optionally return the generated code in the response

    // For local debugging, optionally return the generated code in the response
    if (process.env.OTP_DEBUG === "1" || process.env.OTP_DEBUG === "true") {
      return NextResponse.json({ ok: true, debugCode: code });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("OTP request error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
