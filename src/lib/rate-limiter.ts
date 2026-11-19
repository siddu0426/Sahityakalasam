/**
 * Shared rate limiter for Vercel serverless environments.
 * 
 * Supports:
 * 1. Upstash Redis / Vercel KV via REST API (atomic INCR + EXPIRE pipeline across serverless instances)
 * 2. In-memory sliding window fallback (development & test environments only)
 * 
 * In production (NODE_ENV=production), fails closed if Upstash/KV is not configured.
 */

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
  message?: string;
}

const memoryStore = new Map<string, number[]>();
let hasLoggedProvider = false;

/**
 * Extracts client IP address from proxy headers (x-forwarded-for, x-real-ip)
 */
export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }
  return '127.0.0.1';
}

export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const windowSeconds = Math.ceil(windowMs / 1000);
  const isProduction = process.env.NODE_ENV === 'production';

  // 1. Upstash Redis / Vercel KV REST API (Shared cross-instance store)
  const isUpstash = !!process.env.UPSTASH_REDIS_REST_URL;
  const isKv = !!process.env.KV_REST_API_URL;
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

  if (!hasLoggedProvider) {
    if (isUpstash) {
      console.log('[RateLimiter] Detected shared store: Upstash Redis REST');
      hasLoggedProvider = true;
    } else if (isKv) {
      console.log('[RateLimiter] Detected shared store: Vercel KV REST');
      hasLoggedProvider = true;
    }
  }

  // STRICT PRODUCTION SAFETY: Fail closed if shared store is missing in production
  if (isProduction && (!upstashUrl || !upstashToken)) {
    console.error(
      '[RateLimiter] CRITICAL CONFIGURATION ERROR: Neither UPSTASH_REDIS_REST_* nor KV_REST_API_* is configured in production. Failing closed.'
    );
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 60,
      message: 'Rate limiting service is unconfigured in production. For system security, requests are blocked.',
    };
  }

  if (upstashUrl && upstashToken) {
    try {
      const pipelineRes = await fetch(`${upstashUrl}/pipeline`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${upstashToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([
          ['INCR', key],
          ['EXPIRE', key, windowSeconds, 'NX'],
          ['TTL', key],
        ]),
      });

      if (pipelineRes.ok) {
        const results = await pipelineRes.json();
        const currentCount = results[0]?.result ?? 1;
        const ttl = results[2]?.result ?? windowSeconds;

        if (currentCount > limit) {
          const retrySec = Math.max(1, ttl);
          return {
            allowed: false,
            remaining: 0,
            retryAfterSeconds: retrySec,
            message: `Too many requests. Please wait ${retrySec} seconds before trying again.`,
          };
        }

        return {
          allowed: true,
          remaining: Math.max(0, limit - currentCount),
          retryAfterSeconds: 0,
        };
      }
    } catch (redisErr) {
      if (isProduction) {
        console.error('[RateLimiter] Production Upstash/KV request failed. Failing closed:', redisErr);
        return {
          allowed: false,
          remaining: 0,
          retryAfterSeconds: 30,
          message: 'Rate limiting service is temporarily unavailable. For system security, please wait 30 seconds before retrying.',
        };
      }
      console.warn('[RateLimiter] Upstash Redis request failed, falling back to memory store in non-prod:', redisErr);
    }
  }

  // 2. In-memory sliding window (development & test fallback only)
  const now = Date.now();
  const timestamps = (memoryStore.get(key) || []).filter((t) => now - t < windowMs);

  if (timestamps.length >= limit) {
    const oldest = timestamps[0];
    const retryAfterSeconds = Math.ceil((oldest + windowMs - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, retryAfterSeconds),
    };
  }

  timestamps.push(now);
  memoryStore.set(key, timestamps);

  return {
    allowed: true,
    remaining: limit - timestamps.length,
    retryAfterSeconds: 0,
  };
}

export function resetRateLimitStore() {
  memoryStore.clear();
}
