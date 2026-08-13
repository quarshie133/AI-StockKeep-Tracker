/**
 * Minimal in-memory login attempt limiter (per-process only — resets on
 * cold start and is NOT shared across serverless instances). This is a
 * pragmatic mitigation for a single-shared-passcode app, not a substitute
 * for a distributed rate limiter (e.g. Redis/Upstash) in a multi-instance
 * production deployment. See Technical_Debt_Plan.pdf, TD-03.
 */

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 5 * 60 * 1000; // 5 minutes

type Bucket = { count: number; resetAt: number };
const attempts = new Map<string, Bucket>();

export function checkLoginRateLimit(key: string): { allowed: boolean; retryAfterSeconds?: number } {
  const now = Date.now();
  const bucket = attempts.get(key);

  if (!bucket || now > bucket.resetAt) {
    attempts.set(key, { count: 0, resetAt: now + WINDOW_MS });
    return { allowed: true };
  }

  if (bucket.count >= MAX_ATTEMPTS) {
    return { allowed: false, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) };
  }

  return { allowed: true };
}

export function recordFailedLogin(key: string) {
  const now = Date.now();
  const bucket = attempts.get(key);
  if (!bucket || now > bucket.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    bucket.count += 1;
  }
}

export function clearLoginAttempts(key: string) {
  attempts.delete(key);
}
