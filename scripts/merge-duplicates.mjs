import admin from "firebase-admin";
import fs from "fs";
import path from "path";
import { mergeDocsArray } from "../src/lib/mergeDuplicates.js";

function parseServiceAccountFromEnv(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {}
  try {
    return JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
  } catch (e) {}
  return null;
}

async function initAdmin() {
  if (admin.apps.length) return admin.app();
  const envRaw =
    process.env.FIREBASE_SERVICE_ACCOUNT ||
    process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  const svc = parseServiceAccountFromEnv(envRaw);
  if (svc) {
    admin.initializeApp({
      credential: admin.credential.cert(svc),
      projectId: svc.project_id || svc.projectId,
    });
    return admin.app();
  }
  // try GOOGLE_APPLICATION_CREDENTIALS
  if (
    process.env.GOOGLE_APPLICATION_CREDENTIALS &&
    fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)
  ) {
    admin.initializeApp({ credential: admin.credential.applicationDefault() });
    return admin.app();
  }
  throw new Error(
    "No service account credentials found. Set FIREBASE_SERVICE_ACCOUNT_B64 or GOOGLE_APPLICATION_CREDENTIALS",
  );
}

async function findAndMerge(collectionName, db, apply = false) {
  console.log("Scanning collection", collectionName);
  const col = db.collection(collectionName);
  const all = await col.get();
  const byEmail = new Map();
  all.forEach((doc) => {
    const data = doc.data();
    const email = data.email || "__no_email__";
    const arr = byEmail.get(email) || [];
    arr.push({ id: doc.id, data });
    byEmail.set(email, arr);
  });

  let mergedCount = 0;
  for (const [email, docs] of byEmail.entries()) {
    if (docs.length <= 1) continue;
    const { merged, toDelete } = mergeDocsArray(docs);
    console.log(
      "Would merge",
      docs.length,
      "docs for",
      email,
      "-> keep",
      merged.id,
      "delete",
      toDelete,
    );
    if (apply) {
      // prepare update
      const primaryRef = col.doc(merged.id);
      const updated = {
        name: merged.name,
        email: merged.email,
        interest: merged.interest,
        messages: merged.messages.map((m) => ({
          text: m.text,
          timestamp: m.timestamp,
        })),
        previousMessage: merged.previousMessage,
        lastMessage: merged.lastMessage,
        createdAt: merged.createdAt,
        updatedAt: merged.updatedAt,
      };
      await primaryRef.set(updated, { merge: true });
      for (const id of toDelete) {
        await col.doc(id).delete();
      }
      mergedCount += 1;
    }
  }
  return mergedCount;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const collections = process.argv
    .filter(
      (a) =>
        !a.startsWith("-") &&
        a !== "node" &&
        a !== fileURLToPath(import.meta.url),
    )
    .slice(2);
  // default target collections
  const target = collections.length
    ? collections
    : ["collab", "airvery", "not_specified"];
  await initAdmin();
  const db = admin.firestore();
  let total = 0;
  for (const c of target) {
    const n = await findAndMerge(c, db, apply);
    total += n;
  }
  console.log(
    "Done. Merged groups in",
    total,
    "collections (applied=",
    apply,
    ")",
  );
}

// small helper for import.meta.url handling on node older/newer
function fileURLToPath(url) {
  try {
    return new URL(url).pathname;
  } catch (e) {
    return url;
  }
}

main().catch((err) => {
  console.error("Migration aborted:", err);
  process.exit(1);
});
