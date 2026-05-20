import admin from "firebase-admin";
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import crypto from "crypto";

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
    const { email, code } = await req.json();
    if (!email || !code) {
      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    }
    const adminDb = admin.firestore();
    // Helper: best-effort POST to the canonical auth-logs endpoint.
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

    // Avoid requiring a composite Firestore index by fetching matching docs
    // and selecting the latest one in memory.
    const snapAll = await adminDb
      .collection("email_otps")
      .where("email", "==", String(email).toLowerCase())
      .where("used", "==", false)
      .get();

    // Lockout keys and helpers
    const lockRef = adminDb
      .collection("otp_locks")
      .doc(String(email).toLowerCase());

    async function getLock() {
      const d = await lockRef.get();
      return d.exists ? d.data() : null;
    }

    async function recordFailedAttemptAndRespond(reason) {
      const now = admin.firestore.Timestamp.now();
      let locked = false;
      let failedCount = 1;

      await adminDb.runTransaction(async (tx) => {
        const doc = await tx.get(lockRef);
        if (!doc.exists) {
          tx.set(
            lockRef,
            { failedCount: 1, firstFailedAt: now },
            { merge: true },
          );
          failedCount = 1;
          return;
        }
        const data = doc.data();
        const prevCount = data.failedCount || 0;
        // Increment failure count; once threshold reached mark persistent lock.
        failedCount = prevCount + 1;
        const update = { failedCount };
        if (!data.firstFailedAt) update.firstFailedAt = now;
        if (failedCount >= 3) {
          update.locked = true;
          locked = true;
        }
        tx.set(lockRef, update, { merge: true });
      });

      try {
        await postAuthLog(req, {
          eventType: "auth.login.failed",
          userId: String(email).toLowerCase(),
          email: String(email).toLowerCase(),
          failureReason: reason,
          platform: "web",
          authSource: "email_otp",
        });
      } catch (e) {}

      if (locked) {
        // emit account locked event (no automatic unlock — requires Google sign-in)
        try {
          const payload = {
            eventType: "auth.account.locked",
            userId: String(email).toLowerCase(),
            email: String(email).toLowerCase(),
            platform: "web",
            authSource: "email_otp",
            metadata: {
              lockedAt: new Date().toISOString(),
              unlockWith: "google",
            },
          };
          console.log("EMIT auth.account.locked ->", JSON.stringify(payload));
          await postAuthLog(req, payload);
        } catch (e) {}
        return NextResponse.json(
          {
            error: "locked",
            message: "Account locked — unlock only via Google sign-in.",
            unlockWith: "google",
          },
          { status: 423 },
        );
      }

      return NextResponse.json(
        {
          error: "incorrect_otp",
          message: "Incorrect OTP.",
          remainingAttempts: Math.max(0, 3 - failedCount),
        },
        { status: 400 },
      );
    }

    // Check existing lock status before proceeding
    const existingLock = await getLock();
    if (existingLock && existingLock.locked) {
      try {
        await postAuthLog(req, {
          eventType: "auth.login.failed",
          userId: String(email).toLowerCase(),
          email: String(email).toLowerCase(),
          failureReason: "locked",
          platform: "web",
          authSource: "email_otp",
        });
      } catch (e) {}
      return NextResponse.json(
        {
          error: "locked",
          message: "Account locked — unlock only via Google sign-in.",
          unlockWith: "google",
        },
        { status: 423 },
      );
    }

    if (snapAll.empty) {
      return await recordFailedAttemptAndRespond("no_otp_found");
    }
    let otpDoc = snapAll.docs[0];
    for (const d of snapAll.docs) {
      const cur = d.data()?.createdAt;
      const best = otpDoc.data()?.createdAt;
      if (cur && best) {
        try {
          if (cur.toMillis() > best.toMillis()) otpDoc = d;
        } catch (e) {
          // ignore and keep current best
        }
      }
    }
    const otpDocData = otpDoc.data();
    const now = admin.firestore.Timestamp.now();

    if (
      otpDocData.expiresAt &&
      otpDocData.expiresAt.toMillis &&
      otpDocData.expiresAt.toMillis() < Date.now()
    ) {
      return await recordFailedAttemptAndRespond("expired");
    }

    const codeHash = crypto
      .createHash("sha256")
      .update(String(code))
      .digest("hex");
    // Enforce numeric 6-digit codes only
    if (!/^[0-9]{6}$/.test(String(code))) {
      return await recordFailedAttemptAndRespond("invalid_format");
    }
    if (codeHash !== otpDocData.codeHash) {
      return await recordFailedAttemptAndRespond("invalid_code");
    }

    // mark used
    await otpDoc.ref.update({ used: true, usedAt: now });

    // Ensure user exists
    let userRecord;
    try {
      userRecord = await admin
        .auth()
        .getUserByEmail(String(email).toLowerCase());
    } catch (e) {
      // create user
      userRecord = await admin
        .auth()
        .createUser({ email: String(email).toLowerCase() });
    }

    const customToken = await admin.auth().createCustomToken(userRecord.uid);

    // On successful login, clear any failed-attempt lock so attempts reset.
    try {
      // capture whether there was an active lock so we can emit an "unlocked" event
      const hadLock = !!(existingLock && existingLock.locked);
      await lockRef.delete();
      if (hadLock) {
        try {
          const payload = {
            eventType: "auth.account.unlocked",
            userId: String(email).toLowerCase(),
            email: String(email).toLowerCase(),
            platform: "web",
            authSource: "email_otp",
            metadata: {
              unlockedAt: new Date().toISOString(),
              method: "otp_verify",
            },
          };
          console.log("EMIT auth.account.unlocked ->", JSON.stringify(payload));
          await postAuthLog(req, payload);
        } catch (e) {}
      }
    } catch (e) {
      // best-effort
      console.warn("Failed to clear otp lock:", e?.message || e);
    }

    // Emit auth.login.success for successful OTP login (regardless of prior lock).
    try {
      await postAuthLog(req, {
        eventType: "auth.login.success",
        userId: String(email).toLowerCase(),
        email: String(email).toLowerCase(),
        platform: "web",
        provider: "email_otp",
        metadata: { method: "otp_verify" },
      });
    } catch (e) {}

    return NextResponse.json({ token: customToken });
  } catch (err) {
    console.error("OTP verify error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
