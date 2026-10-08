type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

/**
 * In-memory fixed-window rate limiter, keyed by a caller-supplied string
 * (e.g. `${endpoint}:${ip}`). Single-process only — fine for this app's
 * current single-instance deployment; a multi-instance deployment would
 * need a shared store (e.g. Redis) behind the load balancer instead.
 */
export function checkRateLimit(
  key: string,
  { max, windowMs }: { max: number; windowMs: number },
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now()
  const existing = buckets.get(key)

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowMs
    buckets.set(key, { count: 1, resetAt })
    setTimeout(() => {
      const current = buckets.get(key)
      if (current && current.resetAt <= Date.now()) buckets.delete(key)
    }, windowMs).unref?.()
    return { allowed: true, retryAfterSeconds: 0 }
  }

  if (existing.count >= max) {
    return { allowed: false, retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000) }
  }

  existing.count += 1
  return { allowed: true, retryAfterSeconds: 0 }
}
