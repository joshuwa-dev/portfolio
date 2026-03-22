import { defaultLimiter } from "../src/lib/inMemoryRateLimiter.js";

function check() {
  const key = "check-ip";
  const first = defaultLimiter.tryConsume(key);
  const second = defaultLimiter.tryConsume(key);
  console.log("first", first ? "allowed" : "blocked");
  console.log("second", second ? "allowed" : "blocked");
  // expected: first allowed, second blocked
  if (first && !second) process.exit(0);
  else process.exit(2);
}

check();
