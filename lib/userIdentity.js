import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "./Firebase";

function getProviderIds(user) {
  if (!user || !Array.isArray(user.providerData)) return [];
  const ids = user.providerData
    .map((entry) => entry?.providerId)
    .filter(Boolean);
  return Array.from(new Set(ids));
}

export async function upsertCanonicalUserProfile(user, options = {}) {
  if (!user?.uid) return;

  const userRef = doc(db, "users", user.uid);
  const existing = await getDoc(userRef);

  const providers = getProviderIds(user);
  const payload = {
    uid: user.uid,
    email: user.email || null,
    displayName: user.displayName || null,
    photoURL: user.photoURL || null,
    providers,
    appSegment: options.appSegment || "airvery",
    userType: options.userType || "traveler",
    updatedAt: serverTimestamp(),
    lastSeenAt: serverTimestamp(),
    lastLoginAt: serverTimestamp(),
  };

  if (!existing.exists()) {
    payload.createdAt = serverTimestamp();
  }

  await setDoc(userRef, payload, { merge: true });
}

export async function logUserEvent({
  uid,
  eventName,
  metadata = {},
  city = null,
  country = null,
  mood = null,
  moodTone = null,
}) {
  if (!uid || !eventName) return;

  const eventPayload = {
    eventName,
    metadata,
    city,
    country,
    mood,
    moodTone,
    createdAt: serverTimestamp(),
  };

  await addDoc(collection(db, "users", uid, "events"), eventPayload);
}
