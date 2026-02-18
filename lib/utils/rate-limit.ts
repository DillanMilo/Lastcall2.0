/**
 * Simple in-memory rate limiter for API routes.
 * For production at scale, replace with Redis-based solution (e.g., Upstash).
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) {
      store.delete(key);
    }
  }
}, 5 * 60 * 1000);

interface RateLimitConfig {
  /** Maximum number of requests allowed in the window */
  limit: number;
  /** Time window in seconds */
  windowSeconds: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Check if a request should be rate-limited.
 * @param key - Unique identifier (e.g., `orgId:endpoint` or `ip:endpoint`)
 * @param config - Rate limit configuration
 */
export function checkRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    // Start a new window
    const resetAt = now + config.windowSeconds * 1000;
    store.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: config.limit - 1, resetAt };
  }

  if (entry.count >= config.limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { allowed: true, remaining: config.limit - entry.count, resetAt: entry.resetAt };
}

/** Rate limit presets for different endpoint types */
export const RATE_LIMITS = {
  /** Standard API endpoints: 100 req/min per org */
  standard: { limit: 100, windowSeconds: 60 },
  /** AI endpoints: 20 req/min per org */
  ai: { limit: 20, windowSeconds: 60 },
  /** Auth endpoints: 10 req/min per IP */
  auth: { limit: 10, windowSeconds: 60 },
  /** Email/invite endpoints: 10 req/min per org */
  email: { limit: 10, windowSeconds: 60 },
  /** Webhook endpoints: 200 req/min per source */
  webhook: { limit: 200, windowSeconds: 60 },
} as const;
