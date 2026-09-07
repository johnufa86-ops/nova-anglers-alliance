type RateLimitRecord = { count: number; resetTime: number };
const limitsMap = new Map<string, RateLimitRecord>();

export function checkRateLimit(key: string, maxRequests: number = 5, windowMs: number = 3600000) {
  const now = Date.now();
  const record = limitsMap.get(key);
  if (!record || now > record.resetTime) {
    limitsMap.set(key, { count: 1, resetTime: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1 };
  }
  if (record.count >= maxRequests) {
    return { allowed: false, remaining: 0 };
  }
  record.count += 1;
  return { allowed: true, remaining: maxRequests - record.count };
}
