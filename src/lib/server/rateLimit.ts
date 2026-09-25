import 'server-only';
import { ApiError } from '../errors';

// Fixed-window limiter kept in process memory. Suitable for a single instance; swap for Redis/Upstash
// when running multiple instances (Backend doc §8).
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 10_000) {
      for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
    }
    return;
  }
  bucket.count++;
  if (bucket.count > limit) {
    const retry = Math.ceil((bucket.resetAt - now) / 1000);
    throw new ApiError(429, 'RATE_LIMITED', `Too many requests. Try again in ${retry}s.`);
  }
}
