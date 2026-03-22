// app/api/contact/route.js (or wherever this file is)
import admin from "firebase-admin";
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

function parseServiceAccountFromEnv(raw) {
  if (!raw) return null;
  // Try raw JSON first
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
    // 1) Prefer FIREBASE_SERVICE_ACCOUNT env var (raw JSON or base64 encoded JSON)
    const envSvcRaw = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT_B64;
    const envSvc = parseServiceAccountFromEnv(envSvcRaw);
    if (envSvc) {
      console.log("Initializing firebase-admin from FIREBASE_SERVICE_ACCOUNT env var");
      admin.initializeApp({
        credential: admin.credential.cert(envSvc),
        projectId: envSvc.project_id || envSvc.projectId,
      });
    } else {
      // 2) Repo-local service account file (convenient for local dev)
      const svcPath = path.join(
        process.cwd(),
        ".gitignore",
        "cobary-ed770-firebase-adminsdk-fbsvc-14428ea066.json",
      );
      console.log(
        "Attempting to load service account from:",
        svcPath,
        "exists=",
        fs.existsSync(svcPath),
      );
      if (fs.existsSync(svcPath)) {
        const svc = JSON.parse(fs.readFileSync(svcPath, "utf8"));
        admin.initializeApp({
          credential: admin.credential.cert(svc),
          projectId: svc.project_id,
        });
      } else {
        // 3) Fallback to ADC / GOOGLE_APPLICATION_CREDENTIALS
        console.log("Falling back to applicationDefault() credentials (ADC)");
        admin.initializeApp({
          credential: admin.credential.applicationDefault(),
        });
      }
    }
  } catch (e) {
    console.error("Failed to initialize firebase-admin:", e);
    // let initialization fail — later calls will throw a descriptive error
  }
}

export async function POST(req) {
  try {
    if (!admin.apps.length) {
      console.error(
        "firebase-admin not initialized; admin.apps.length=",
        admin.apps.length,
      );
      return NextResponse.json(
        { error: "firebase-admin-not-initialized" },
        { status: 500 },
      );
    }

    // If an app exists but lacks a projectId, try re-initializing using
    // FIREBASE_SERVICE_ACCOUNT env var first, then repo-local service account.
    const existingApp = admin.apps[0];
    const existingProjectId = existingApp?.options?.projectId;
    if (!existingProjectId) {
      try {
        // Try env var first
        const envSvcRaw = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT_B64;
        const envSvc = parseServiceAccountFromEnv(envSvcRaw);
        if (envSvc) {
          await admin.app().delete();
          admin.initializeApp({
            credential: admin.credential.cert(envSvc),
            projectId: envSvc.project_id || envSvc.projectId,
          });
          console.log(
            "Reinitialized firebase-admin from FIREBASE_SERVICE_ACCOUNT, projectId=",
            envSvc.project_id || envSvc.projectId,
          );
        } else {
          const svcPath = path.join(
            process.cwd(),
            ".gitignore",
            "cobary-ed770-firebase-adminsdk-fbsvc-14428ea066.json",
          );
          if (fs.existsSync(svcPath)) {
            const svc = JSON.parse(fs.readFileSync(svcPath, "utf8"));
            await admin.app().delete();
            admin.initializeApp({
              credential: admin.credential.cert(svc),
              projectId: svc.project_id,
            });
            console.log(
              "Reinitialized firebase-admin with local service account, projectId=",
              svc.project_id,
            );
          } else {
            console.warn("No local service account found at", svcPath);
          }
        }
      } catch (e) {
        console.error("Failed to reinitialize firebase-admin:", e);
      }
    }

    const adminDb = admin.firestore();
    const { name, email, message, interest } = await req.json();

    if (!name || !email) {
      return NextResponse.json(
        { error: "Name and email are required" },
        { status: 400 },
      );
    }

    let docRef;

    if (interest === "collaboration") {
      docRef = await adminDb.collection("collab").add({
        name,
        email,
        message,
        timestamp: new Date(),
      });
    } else if (interest === "airvery") {
      docRef = await adminDb.collection("airvery").add({
        name,
        email,
        message,
        timestamp: new Date(),
      });
    } else {
      docRef = await adminDb.collection("not_specified").add({
        name,
        email,
        message,
        interest: "unspecified",
        timestamp: new Date(),
      });
    }

    return NextResponse.json(
      { message: "Saved!", id: docRef.id },
      { status: 201 },
    );
  } catch (err) {
    console.error("Error saving to Firestore:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
