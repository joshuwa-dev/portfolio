#!/usr/bin/env node
import admin from 'firebase-admin';
import process from 'process';

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: node scripts/set-admin-by-email.mjs <email>');
    process.exit(1);
  }

  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64 || process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!b64) {
    console.error('FIREBASE_SERVICE_ACCOUNT_B64 or FIREBASE_SERVICE_ACCOUNT must be set in environment');
    process.exit(1);
  }

  let svc;
  try {
    try {
      svc = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
    } catch (e) {
      svc = JSON.parse(b64);
    }
  } catch (err) {
    console.error('Failed to parse service account JSON from environment:', err.message);
    process.exit(1);
  }

  try {
    admin.initializeApp({ credential: admin.credential.cert(svc) });
  } catch (e) {
    if (!admin.apps.length) {
      console.error('Failed to initialize firebase-admin:', e);
      process.exit(1);
    }
  }

  try {
    const user = await admin.auth().getUserByEmail(email);
    await admin.auth().setCustomUserClaims(user.uid, { admin: true });
    console.log(`✅ Set admin claim for ${email} (uid=${user.uid})`);
    process.exit(0);
  } catch (err) {
    console.error('Failed to set admin claim:', err.message || err);
    process.exit(1);
  }
}

main();
