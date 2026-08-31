type RateLimitBucket = {
  count: number;
  resetsAt: number;
};

const buckets = new Map<string, RateLimitBucket>();

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
) {
  const now = Date.now();
  const current = buckets.get(key);

  if (!current || current.resetsAt <= now) {
    buckets.set(key, { count: 1, resetsAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (current.count >= limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetsAt - now) / 1000)),
    };
  }

  current.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

export function getRequestClientId(request: Request) {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip')?.trim() ||
    'local'
  );
}
