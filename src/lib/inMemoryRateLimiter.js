// Simple in-memory token-bucket rate limiter keyed by client identifier (IP)
export class InMemoryRateLimiter {
  constructor({ tokensPerInterval = 5, intervalMs = 60_000 } = {}) {
    this.tokensPerInterval = tokensPerInterval;
    this.intervalMs = intervalMs;
    this.refillRatePerMs = tokensPerInterval / intervalMs;
    this.bucketSize = tokensPerInterval;
    this.map = new Map();
  }

  _now() {
    return Date.now();
  }

  tryConsume(key, count = 1) {
    if (!key) key = "unknown";
    let entry = this.map.get(key);
    const now = this._now();
    if (!entry) {
      entry = { tokens: this.bucketSize, last: now };
      this.map.set(key, entry);
    }

    // refill
    const delta = Math.max(0, now - entry.last);
    const refill = delta * this.refillRatePerMs;
    entry.tokens = Math.min(this.bucketSize, entry.tokens + refill);
    entry.last = now;

    if (count <= entry.tokens) {
      entry.tokens -= count;
      return true;
    }
    return false;
  }
}

// Export a default shared limiter instance suitable for local/dev use.
export const defaultLimiter = new InMemoryRateLimiter({
  tokensPerInterval: 1,
  intervalMs: 120_000,
});
