export async function sendAuthEvent(payload) {
  try {
    await fetch("/api/auth-logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    // best-effort: don't block UX
    // console.warn("Auth event send failed", err);
  }
}
