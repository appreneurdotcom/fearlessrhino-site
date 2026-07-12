/**
 * Minimal in-memory rate limiter for the public form endpoints — enough to
 * blunt naive spam bots without adding an external dependency or a database.
 * Not meant to withstand a determined attacker (there's no shared state
 * across multiple server instances), just day-to-day noise.
 */
const hits = new Map(); // key -> array of timestamps (ms)

function isRateLimited(key, { max = 5, windowMs = 10 * 60 * 1000 } = {}) {
  const now = Date.now();
  const existing = (hits.get(key) || []).filter((t) => now - t < windowMs);
  existing.push(now);
  hits.set(key, existing);
  return existing.length > max;
}

// Periodically forget stale keys so this map can't grow forever.
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of hits.entries()) {
    const fresh = timestamps.filter((t) => now - t < 60 * 60 * 1000);
    if (fresh.length) hits.set(key, fresh);
    else hits.delete(key);
  }
}, 30 * 60 * 1000).unref();

module.exports = { isRateLimited };
