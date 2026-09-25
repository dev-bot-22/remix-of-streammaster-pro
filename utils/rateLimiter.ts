interface RateLimitRecord {
  timestamps: number[];
}

const tokenCache = new Map<string, RateLimitRecord>();

// Periodically clean up old entries to prevent memory leaks
if (typeof global !== "undefined") {
  if (!(global as any).rateLimitCleanupInterval) {
    (global as any).rateLimitCleanupInterval = setInterval(() => {
      const now = Date.now();
      const expirationMs = 15 * 60 * 1000; // 15 mins
      for (const [ip, record] of tokenCache.entries()) {
        const activeTimestamps = record.timestamps.filter(
          (t) => now - t < expirationMs
        );
        if (activeTimestamps.length === 0) {
          tokenCache.delete(ip);
        } else {
          record.timestamps = activeTimestamps;
        }
      }
    }, 5 * 60 * 1000); // Clean every 5 mins
  }
}

/**
 * Checks if a request from an IP exceeds the specified limit in the given window.
 * Returns true if the request is ALLOWED, and false if the limit is EXCEEDED.
 */
export function rateLimit(
  ip: string,
  limit: number = 5,
  windowMs: number = 15 * 60 * 1000
): boolean {
  const now = Date.now();
  const record = tokenCache.get(ip) || { timestamps: [] };

  // Filter timestamps within the window
  const activeTimestamps = record.timestamps.filter(
    (time) => now - time < windowMs
  );

  if (activeTimestamps.length >= limit) {
    return false; // Limit exceeded
  }

  activeTimestamps.push(now);
  record.timestamps = activeTimestamps;
  tokenCache.set(ip, record);
  return true;
}
