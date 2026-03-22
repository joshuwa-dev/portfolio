import assert from "assert";
import { InMemoryRateLimiter } from "../src/lib/inMemoryRateLimiter.js";

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  console.log("Starting in-memory rate limiter tests");
  const limiter = new InMemoryRateLimiter({
    tokensPerInterval: 5,
    intervalMs: 1000,
  });
  const key = "test-ip";

  // consume 5 tokens -> should succeed
  for (let i = 0; i < 5; i++) {
    const ok = limiter.tryConsume(key);
    assert.strictEqual(ok, true, `expected tryConsume(${i}) to succeed`);
  }

  // 6th should fail
  const sixth = limiter.tryConsume(key);
  assert.strictEqual(sixth, false, "expected 6th consume to be rate-limited");
  console.log("First window behaved as expected (5 allowed, then blocked)");

  // wait for refill (just over 1s)
  await sleep(1100);
  const after = limiter.tryConsume(key);
  assert.strictEqual(after, true, "expected token available after refill");
  console.log("Refill worked; token available after interval");

  console.log("All tests passed");
}

run().catch((err) => {
  console.error("Tests failed:", err);
  process.exit(1);
});
